import { Plugin, PluginSettingTab, App, Setting, Notice } from 'obsidian';
import { DatePickerModal, DateRange } from './date-picker-modal';
import { FolderPickerModal, FolderPickerModalResult } from './folder-picker-modal';
import { NoteFilterService, NoteFilterResult } from './note-filter';
import { TokenEstimator, TokenEstimate } from './token-estimator';
import { ConfirmationModal, ConfirmationData } from './confirmation-modal';
import { OpenAIService, OpenAIConfig, OpenAIError } from './openai-service';
import { SummaryGenerator, SummaryProgress, SummaryResult } from './summary-generator';
import { FileService, SaveResult } from './file-service';

interface InsightCompanionSettings {
	lastDateRange: DateRange | null;
	outputFolder: string;
	openaiApiKey: string;
}

const DEFAULT_SETTINGS: InsightCompanionSettings = {
	lastDateRange: null,
	outputFolder: 'Summaries',
	openaiApiKey: ''
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

		// Add command to generate summary by date
		this.addCommand({
			id: 'generate-insight-summary',
			name: 'Generate Summary',
			callback: () => {
				this.openDatePicker();
			}
		});

		// Add command to generate summary by folder
		this.addCommand({
			id: 'generate-insight-summary-folder',
			name: 'Summarise by Folder',
			callback: () => {
				this.openFolderPicker();
			}
		});

		// Add settings tab
		this.addSettingTab(new InsightCompanionSettingTab(this.app, this));
	}

	private openDatePicker() {
		console.log('Opening date picker modal...');
		
		const modal = new DatePickerModal(
			this.app,
			this.settings.lastDateRange,
			(dateRange: DateRange) => {
				this.handleDateSelection(dateRange);
			}
		);
		
		modal.open();
	}

	private async handleDateSelection(dateRange: DateRange) {
		console.log('Date range selected:', dateRange);
		
		// Cache the selected date range
		this.settings.lastDateRange = dateRange;
		await this.saveSettings();
		
		try {
			// Filter notes by date range
			console.log('Filtering notes by date range...');
			const filterResult: NoteFilterResult = await this.noteFilterService.filterNotesByDateRange(dateRange);
			
			if (filterResult.totalCount === 0) {
				console.log('No notes found in the selected date range');
				new Notice('No notes found in the selected date range', 5000);
				return;
			}

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
				() => {
					// User confirmed - proceed with summary generation
					console.log('User confirmed summary generation');
					this.proceedWithSummaryGeneration(filterResult, tokenEstimate);
				},
				() => {
					// User cancelled
					console.log('User cancelled summary generation');
				}
			);

			confirmationModal.open();

		} catch (error) {
			console.error('Error processing date selection:', error);
			new Notice(`Error processing date selection: ${error instanceof Error ? error.message : 'Unknown error'}`, 8000);
		}
	}

	private async proceedWithSummaryGeneration(filterResult: NoteFilterResult, tokenEstimate: TokenEstimate) {
		console.log('Proceeding with summary generation...');
		console.log(`Processing ${filterResult.totalCount} notes with ${tokenEstimate.totalTokens} estimated tokens`);
		
		// Ensure OpenAI services are initialized
		if (!this.openaiService || !this.summaryGenerator) {
			new Notice('❌ OpenAI services not available. Please check your API key in settings.', 8000);
			return;
		}

		// Show initial progress notification
		let progressNotice: Notice | null = new Notice('🔄 Starting summary generation...', 0);

		try {
			// Generate the summary with progress tracking
			const summaryResult = await this.summaryGenerator.generateSummary(
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
			// Hide progress notification
			if (progressNotice) {
				progressNotice.hide();
			}

			const openaiError = error as OpenAIError;
			console.error('Summary generation failed:', openaiError);
			
			// Show appropriate error message based on error type
			this.handleSummaryGenerationError(openaiError);
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