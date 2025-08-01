import { Plugin, PluginSettingTab, App, Setting, Notice } from 'obsidian';
import { DatePickerModal, DateRange } from './date-picker-modal';
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

		// Initialize services
		this.noteFilterService = new NoteFilterService(this.app);

		// Add command to generate summary
		this.addCommand({
			id: 'generate-insight-summary',
			name: 'Generate Summary',
			callback: () => {
				this.openDatePicker();
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
				// TODO: Show user notification about no notes found
				return;
			}

			// Estimate token count
			console.log('Estimating token count...');
			const tokenEstimate: TokenEstimate = TokenEstimator.estimateTokens(filterResult.notes);
			
			// Check token limits and provide recommendations
			const limitCheck = TokenEstimator.checkTokenLimits(tokenEstimate.totalTokens);
			
			// Estimate cost
			const costEstimate = TokenEstimator.estimateCost(tokenEstimate.totalTokens);

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
			// TODO: Show user-friendly error notification
		}
	}

	private async proceedWithSummaryGeneration(filterResult: NoteFilterResult, tokenEstimate: TokenEstimate) {
		console.log('Proceeding with summary generation...');
		console.log(`Processing ${filterResult.totalCount} notes with ${tokenEstimate.totalTokens} estimated tokens`);
		
		// TODO: Implement actual LLM API call and summary generation
		// For now, just log that we would proceed
		console.log('This is where the LLM API call would happen');
		console.log('Summary would be generated and saved to:', this.settings.outputFolder);
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