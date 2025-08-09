import { Plugin, PluginSettingTab, App, Setting, Notice } from 'obsidian';
import { DatePickerModal, DateRange } from './date-picker-modal';
import { FolderPickerModal, FolderPickerModalResult } from './folder-picker-modal';
import { UnifiedSummaryModal, UnifiedSummaryResult } from './unified-summary-modal';
import { NoteFilterService, NoteFilterResult } from './note-filter';
import { TokenEstimator, TokenEstimate } from './token-estimator';
import { ConfirmationModal, ConfirmationData, ConfirmationResult } from './confirmation-modal';
import { OpenAIService, OpenAIConfig, OpenAIError } from './openai-service';
import { SummaryGenerator, SummaryProgress, SummaryResult } from './summary-generator';
import { FileService, SaveResult } from './file-service';

interface InsightCompanionSettings {
	lastDateRange: DateRange | null;
	outputFolder: string;
	openaiApiKey: string;
	lastExcludedMetadata: string[];
	maxNotesPerRun?: number;
	trends?: {
		include: boolean;
		maxTerms: number;
		minMentions: number;
		entityHeuristics: boolean;
		deltaEnabled: boolean;
	};
	hasCompletedOnboarding?: boolean;
}

const DEFAULT_SETTINGS: InsightCompanionSettings = {
	lastDateRange: null,
	outputFolder: 'Summaries',
	openaiApiKey: '',
	lastExcludedMetadata: ['summarise: false'],
	maxNotesPerRun: 300,
	trends: { include: false, maxTerms: 10, minMentions: 2, entityHeuristics: true, deltaEnabled: true },
	hasCompletedOnboarding: false
};

export default class InsightCompanionPlugin extends Plugin {
	settings: InsightCompanionSettings;
	private noteFilterService: NoteFilterService;
	private openaiService: OpenAIService | null = null;
	private summaryGenerator: SummaryGenerator | null = null;
	private fileService: FileService;

	async onload() {
		console.log('Insight Companion plugin loaded');

		await this.loadSettings();

		// Initialize core services
		this.noteFilterService = new NoteFilterService(this.app);
		this.fileService = new FileService(this.app, {
			outputFolder: this.settings.outputFolder
		});

		// Initialize OpenAI services if API key is available
		this.initializeOpenAIServices();

		// Add unified command to generate summary
		this.addCommand({
			id: 'summarise-notes',
			name: 'Summarise Notes',
			callback: () => {
				const apiKeyMissing = !this.settings.openaiApiKey || this.settings.openaiApiKey.trim() === '';
				this.openUnifiedSummaryModal(
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					apiKeyMissing
				);
			}
		});

		// Add settings tab
		this.addSettingTab(new InsightCompanionSettingTab(this.app, this));

		// First-run onboarding toast
		if (!this.settings.hasCompletedOnboarding) {
			new Notice('Insight Companion: Setup required. Open Settings → Insight Companion to add your OpenAI key.', 8000);

			// Best-effort: create Getting Started doc on first run (guarded for tests)
			try {
				const vault: any = (this.app as any).vault;
				if (vault && typeof vault.getAbstractFileByPath === 'function') {
					const docPath = 'Insights/_Docs/Getting Started.md';
					const existing = vault.getAbstractFileByPath(docPath);
					if (!existing) {
						// Ensure parent folder(s)
						const insightsFolder = 'Insights';
						const docsFolder = 'Insights/_Docs';
						if (!vault.getAbstractFileByPath(insightsFolder)) {
							await vault.createFolder(insightsFolder);
						}
						if (!vault.getAbstractFileByPath(docsFolder)) {
							await vault.createFolder(docsFolder);
						}
						await vault.create(docPath, '# Getting Started\n\n1. Open Settings → Insight Companion and add your OpenAI API key.\n2. Open the command palette and run “Summarise Notes”.\n3. Pick a date range or folder (or both).\n4. Review the confirmation (note count, token/cost estimate, exclusions).\n5. Confirm to generate; the summary appears in the Summaries folder.\n\nPrivacy & Data\n- Only excerpts are sent to the model.\n- Use filters and exclusions (front‑matter, tags) to limit scope.');
					}
				}
			} catch (_) {
				// ignore in tests/air-gapped envs
			}

			this.settings.hasCompletedOnboarding = true;
			await this.saveSettings();
		}
	}

	private openUnifiedSummaryModal(
		defaultDateRange?: DateRange | null,
		defaultFolderPath?: string,
		defaultInsightStyle?: 'structured' | 'freeform' | 'succinct',
		defaultDateSource?: 'created' | 'modified',
		defaultExcludedMetadata?: string[],
		showApiKeyError?: boolean,
		onOpenSettings?: () => void
	) {
		console.log('Opening unified summary modal...');
		
		const modal = new UnifiedSummaryModal(
			this.app,
			defaultDateRange || this.settings.lastDateRange,
			defaultFolderPath,
			defaultInsightStyle,
			defaultDateSource,
			defaultExcludedMetadata || this.settings.lastExcludedMetadata,
			(result: UnifiedSummaryResult) => {
				this.handleUnifiedSelection(result);
			},
			showApiKeyError,
			onOpenSettings
		);
		
		modal.open();
	}

	private async handleUnifiedSelection(result: UnifiedSummaryResult) {
		console.log('Unified selection:', result);
		
		// Cache the selected date range if provided
		if (result.dateRange) {
			this.settings.lastDateRange = result.dateRange;
		}
		
		// Cache the excluded metadata
		this.settings.lastExcludedMetadata = result.excludedMetadata;
		await this.saveSettings();
		
		try {
			// Use the unified filtering method
			console.log('Filtering notes with unified criteria...');
			const filterResult: NoteFilterResult = await this.noteFilterService.filterNotes(
				result.dateRange,
				result.folderPath,
				result.folderName,
				result.insightStyle,
				result.excludedMetadata
			);
			
			if (filterResult.totalCount === 0) {
				console.log('No notes found matching the selected criteria');
				new Notice('No notes found matching the selected criteria', 5000);
				return;
			}

			await this.showConfirmationAndProceed(filterResult, result);

		} catch (error) {
			console.error('Error processing unified selection:', error);
			new Notice(`Error processing selection: ${error instanceof Error ? error.message : 'Unknown error'}`, 8000);
		}
	}

	private async showConfirmationAndProceed(filterResult: NoteFilterResult, originalSelection: UnifiedSummaryResult) {
		// Enforce batch cap if configured
		const maxNotes = this.settings.maxNotesPerRun ?? (DEFAULT_SETTINGS as any).maxNotesPerRun;
		let notesForRun = filterResult.notes;
		let capInfo: { cappedTo: number; total: number } | undefined;
		if (typeof maxNotes === 'number' && maxNotes > 0 && filterResult.totalCount > maxNotes) {
			notesForRun = filterResult.notes.slice(0, maxNotes);
			capInfo = { cappedTo: notesForRun.length, total: filterResult.totalCount };
			new Notice(`Processing first ${notesForRun.length} of ${filterResult.totalCount} notes. Refine filters or increase the cap in Settings → Advanced.`, 8000);
		}

		// Estimate token count for the actual batch to run
		console.log('Estimating token count...');
		const tokenEstimate: TokenEstimate = TokenEstimator.estimateTokens(notesForRun);
		
		// Check token limits and provide recommendations
		const limitCheck = TokenEstimator.checkTokenLimits(tokenEstimate.totalTokens);
		
		// Estimate cost based on current model
		const currentModel = this.openaiService?.getCurrentModel();
		const costEstimate = TokenEstimator.estimateCost(tokenEstimate.totalTokens, currentModel);

		// Build effective filter result used for confirmation and run (apply cap if present)
		const effectiveFilterResult: NoteFilterResult = {
			...filterResult,
			notes: notesForRun,
			totalCount: notesForRun.length
		};

		// Show confirmation dialog with note count and token estimate
		const confirmationData: ConfirmationData = {
			filterResult: effectiveFilterResult,
			tokenEstimate,
			costEstimate,
			limitCheck,
			capInfo
		};

		const consentNeeded = (capInfo?.cappedTo ?? effectiveFilterResult.totalCount) > 0;
		const confirmationModal = new ConfirmationModal(
			this.app,
			confirmationData,
			(result: ConfirmationResult) => {
				if (result.confirmed) {
					// User confirmed - proceed with summary generation
					console.log('User confirmed summary generation');
					this.proceedWithSummaryGeneration(effectiveFilterResult, tokenEstimate, originalSelection.insightStyle);
				} else {
					// User cancelled - return to filter modal with previous values
					console.log('User cancelled summary generation, returning to filter modal');
					this.openUnifiedSummaryModal(
						originalSelection.dateRange,
						originalSelection.folderPath,
						originalSelection.insightStyle,
						originalSelection.dateSource,
						originalSelection.excludedMetadata
					);
				}
			},
			consentNeeded
		);

		confirmationModal.open();
	}

	private async proceedWithSummaryGeneration(filterResult: NoteFilterResult, tokenEstimate: TokenEstimate, insightStyle?: 'structured' | 'freeform' | 'succinct') {
		console.log('Proceeding with summary generation...');
		console.log(`Processing ${filterResult.totalCount} notes with ${tokenEstimate.totalTokens} estimated tokens`);
		
		// Ensure OpenAI services are initialized
		if (!this.openaiService || !this.summaryGenerator) {
			new Notice('❌ OpenAI services not available. Please check your API key in settings.', 8000);
			return;
		}

		// Create a new SummaryGenerator with the specific insightStyle config
		const summaryConfig = {
			promptConfig: { insightStyle },
			trendOptions: {
				include: !!this.settings.trends?.include,
				maxTerms: this.settings.trends?.maxTerms ?? 10,
				minMentions: this.settings.trends?.minMentions ?? 2,
				entityHeuristics: this.settings.trends?.entityHeuristics ?? true,
				dateSource: filterResult.dateSource
			}
		};
		const configuredSummaryGenerator = new SummaryGenerator(this.openaiService, summaryConfig);

		// Show initial progress notification
		let progressNotice: Notice | null = new Notice('🔄 Starting summary generation...', 0);

		try {
			// Generate the summary with progress tracking
			const summaryResult = await configuredSummaryGenerator.generateSummary(
				filterResult, 
				(progress: SummaryProgress) => {
					this.updateProgressNotification(progressNotice, progress);
				}
			);

			// Dismiss progress notification
			if (progressNotice) {
				progressNotice.hide();
				progressNotice = null;
			}

			// Save the summary to the vault
			const saveResult = await this.fileService.saveSummary(summaryResult);
			
			// Show final notification
			this.fileService.showSaveNotification(saveResult);

			// Log success details
			console.log('Summary generation completed:', {
				notesAnalyzed: summaryResult.metadata.notesAnalyzed,
				tokensUsed: summaryResult.metadata.tokensUsed.total,
				processingTime: summaryResult.metadata.generationTime,
				filePath: saveResult.filePath
			});

		} catch (error) {
			// Dismiss progress notification on error
			if (progressNotice) {
				progressNotice.hide();
				progressNotice = null;
			}

			console.error('Error generating summary:', error);
			new Notice(`❌ Error generating summary: ${error instanceof Error ? error.message : 'Unknown error'}`, 10000);
		}
	}

	/**
	 * Initialize OpenAI services when API key is available
	 */
	public initializeOpenAIServices() {
		if (!this.settings.openaiApiKey || this.settings.openaiApiKey.trim() === '') {
			console.log('No OpenAI API key provided, OpenAI services disabled');
			this.openaiService = null;
			this.summaryGenerator = null;
			return;
		}

		try {
			// Initialize OpenAI service
			const openaiConfig: OpenAIConfig = {
				apiKey: this.settings.openaiApiKey,
				model: 'gpt-4',
				maxTokens: 4096,
				temperature: 0.7
			};

			this.openaiService = new OpenAIService(openaiConfig);
			this.summaryGenerator = new SummaryGenerator(this.openaiService);

			console.log('OpenAI services initialized successfully');
		} catch (error) {
			console.error('Failed to initialize OpenAI services:', error);
			this.openaiService = null;
			this.summaryGenerator = null;
		}
	}

	/**
	 * Update progress notification during summary generation
	 */
	private updateProgressNotification(notice: Notice | null, progress: SummaryProgress) {
		if (!notice) return;

		let emoji = '🔄';
		switch (progress.stage) {
			case 'chunking':
				emoji = '📊';
				break;
			case 'generating':
				emoji = '🧠';
				break;
			case 'combining':
				emoji = '🔗';
				break;
			case 'complete':
				emoji = '✅';
				break;
			case 'error':
				emoji = '❌';
				break;
		}

		const progressText = progress.totalChunks > 1 
			? `${emoji} ${progress.message} (${progress.currentChunk}/${progress.totalChunks})`
			: `${emoji} ${progress.message}`;

		notice.setMessage(progressText);
	}

	/**
	 * Handle errors during summary generation with appropriate user messaging
	 */
	private handleSummaryGenerationError(error: OpenAIError) {
		let message = '';
		let duration = 8000;

		switch (error.type) {
			case 'authentication':
				message = '❌ Authentication failed. Please check your OpenAI API key in settings.';
				duration = 10000;
				break;
			case 'rate_limit':
				message = `❌ Rate limit exceeded. ${error.retryAfter ? `Try again in ${error.retryAfter} seconds.` : 'Please try again later.'}`;
				duration = 10000;
				break;
			case 'token_limit':
				message = '❌ Content too large for API. Try selecting fewer notes or a smaller date range.';
				duration = 10000;
				break;
			case 'network':
				message = '❌ Network error. Please check your internet connection and try again.';
				duration = 8000;
				break;
			default:
				message = `❌ Summary generation failed: ${error.message}`;
				duration = 8000;
				break;
		}

		new Notice(message, duration);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		console.log('Insight Companion plugin unloaded');
	}
}

class InsightCompanionSettingTab extends PluginSettingTab {
	plugin: InsightCompanionPlugin;

	constructor(app: App, plugin: InsightCompanionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Insight Companion Settings' });
		containerEl.createEl('div', { text: 'Generate thematic insights across your notes with cost and token awareness. Requires an OpenAI API key.' });
		containerEl.createEl('div', { text: 'Docs: /Insights/_Docs/Getting Started.md' });

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API key for generating summaries')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.openaiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.openaiApiKey = value;
					await this.plugin.saveSettings();
					// Reinitialize OpenAI services when API key changes
					this.plugin.initializeOpenAIServices();
				}));

		new Setting(containerEl)
			.setName('Output Folder')
			.setDesc('Folder where generated summaries will be saved')
			.addText(text => text
				.setPlaceholder('Summaries')
				.setValue(this.plugin.settings.outputFolder)
				.onChange(async (value) => {
					this.plugin.settings.outputFolder = value;
					await this.plugin.saveSettings();
				}));

		// Advanced options
		containerEl.createEl('h3', { text: 'Advanced' });
		containerEl.createEl('div', { text: 'These settings help with performance on large vaults.' });
		new Setting(containerEl)
			.setName('Max Notes Per Run')
			.setDesc('Caps how many notes are processed per run (helps performance).')
			.addText(text => text
				.setPlaceholder(String((DEFAULT_SETTINGS as any).maxNotesPerRun))
				.setValue(String(this.plugin.settings.maxNotesPerRun ?? (DEFAULT_SETTINGS as any).maxNotesPerRun))
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					this.plugin.settings.maxNotesPerRun = isNaN(parsed) || parsed <= 0 ? (DEFAULT_SETTINGS as any).maxNotesPerRun : parsed;
					await this.plugin.saveSettings();
				}));

			// Trends settings
			containerEl.createEl('h3', { text: 'Trends (beta)' });
			new Setting(containerEl)
				.setName('Include Trends')
				.setDesc('Add a Trends & Recurring Topics section to summaries')
				.addDropdown(dd => dd
					.addOption('true', 'Enabled')
					.addOption('false', 'Disabled')
					.setValue(String(!!this.plugin.settings.trends?.include))
					.onChange(async v => {
						this.plugin.settings.trends = this.plugin.settings.trends || (DEFAULT_SETTINGS as any).trends;
						this.plugin.settings.trends!.include = v === 'true';
						await this.plugin.saveSettings();
					}));
			new Setting(containerEl)
				.setName('Max Terms (Top N)')
				.setDesc('How many top terms to include')
				.addText(t => t
					.setPlaceholder('10')
					.setValue(String(this.plugin.settings.trends?.maxTerms ?? 10))
					.onChange(async v => {
						const n = parseInt(v, 10);
						this.plugin.settings.trends = this.plugin.settings.trends || (DEFAULT_SETTINGS as any).trends;
						this.plugin.settings.trends!.maxTerms = isNaN(n) ? 10 : n;
						await this.plugin.saveSettings();
					}));
			new Setting(containerEl)
				.setName('Noise Threshold (min mentions)')
				.setDesc('Minimum mentions required for a term to be included')
				.addText(t => t
					.setPlaceholder('2')
					.setValue(String(this.plugin.settings.trends?.minMentions ?? 2))
					.onChange(async v => {
						const n = parseInt(v, 10);
						this.plugin.settings.trends = this.plugin.settings.trends || (DEFAULT_SETTINGS as any).trends;
						this.plugin.settings.trends!.minMentions = isNaN(n) ? 2 : n;
						await this.plugin.saveSettings();
					}));
			new Setting(containerEl)
				.setName('Entity Heuristics')
				.setDesc('Lightweight detection of People/Projects (front-matter People:, #project/*)')
				.addDropdown(dd => dd
					.addOption('true', 'Enabled')
					.addOption('false', 'Disabled')
					.setValue(String(this.plugin.settings.trends?.entityHeuristics ?? true))
					.onChange(async v => {
						this.plugin.settings.trends = this.plugin.settings.trends || (DEFAULT_SETTINGS as any).trends;
						this.plugin.settings.trends!.entityHeuristics = v === 'true';
						await this.plugin.saveSettings();
					}));

		// Display last used date range if available
		if (this.plugin.settings.lastDateRange) {
			const lastRange = this.plugin.settings.lastDateRange;
			containerEl.createEl('div', {
				text: `Last used date range: ${lastRange.startDate} to ${lastRange.endDate}`,
				attr: { style: 'margin-top: 20px; padding: 10px; background: var(--background-secondary); border-radius: 4px;' }
			});
		}
	}
} 

// Lightweight helper to trigger settings UI in-app (no-op in tests)
(InsightCompanionPlugin.prototype as any).openSettingsTab = function() {
    try {
        const tab = new InsightCompanionSettingTab(this.app, this);
        this.addSettingTab(tab);
        tab.display();
    } catch (e) {
        console.warn('Open settings not supported in this environment');
    }
};