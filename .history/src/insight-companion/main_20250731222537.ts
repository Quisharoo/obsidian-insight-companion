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
}

const DEFAULT_SETTINGS: InsightCompanionSettings = {
	lastDateRange: null,
	outputFolder: 'Summaries',
	openaiApiKey: '',
	lastExcludedMetadata: ['summarise: false']
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
				this.openUnifiedSummaryModal();
			}
		});

		// Add settings tab
		this.addSettingTab(new InsightCompanionSettingTab(this.app, this));
	}

	private openUnifiedSummaryModal(
		defaultDateRange?: DateRange | null,
		defaultFolderPath?: string,
		defaultInsightStyle?: 'structured' | 'freeform' | 'succinct',
		defaultDateSource?: 'created' | 'modified',
		defaultExcludedMetadata?: string[]
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
			}
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
		// Estimate token count
		console.log('Estimating token count...');
		const tokenEstimate: TokenEstimate = TokenEstimator.estimateTokens(filterResult.notes);
		
		// Check token limits and provide recommendations
		const limitCheck = TokenEstimator.checkTokenLimits(tokenEstimate.totalTokens);
		
		// Estimate cost based on current model
		const currentModel = this.openaiService?.getCurrentModel();
		const costEstimate = TokenEstimator.estimateCost(tokenEstimate.totalTokens, currentModel);

		// Show confirmation dialog with note count and token estimate
		const confirmationData: ConfirmationData = {
			filterResult,
			tokenEstimate,
			costEstimate,
			limitCheck
		};

		const confirmationModal = new ConfirmationModal(
			this.app,
			confirmationData,
			(result: ConfirmationResult) => {
				if (result.confirmed) {
					// User confirmed - proceed with summary generation
					console.log('User confirmed summary generation');
					this.proceedWithSummaryGeneration(filterResult, tokenEstimate, originalSelection.insightStyle);
				} else {
					// User cancelled - return to filter modal with previous values
					console.log('User cancelled summary generation, returning to filter modal');
					this.openUnifiedSummaryModal(
						originalSelection.dateRange,
						originalSelection.folderPath,
						originalSelection.insightStyle
					);
				}
			}
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
			promptConfig: { insightStyle }
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