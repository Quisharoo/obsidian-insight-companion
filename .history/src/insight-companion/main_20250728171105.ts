import { Plugin, PluginSettingTab, App, Setting } from 'obsidian';
import { DatePickerModal, DateRange } from './date-picker-modal';
import { NoteFilterService, NoteFilterResult } from './note-filter';
import { TokenEstimator, TokenEstimate } from './token-estimator';

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
			
			// Log the results for now (will be replaced with confirmation dialog)
			console.log(`Found ${filterResult.totalCount} notes in date range`);
			console.log(TokenEstimator.formatEstimate(tokenEstimate));
			
			// Check token limits and provide recommendations
			const limitCheck = TokenEstimator.checkTokenLimits(tokenEstimate.totalTokens);
			if (!limitCheck.withinGPT4TurboLimit) {
				console.warn('Token count exceeds GPT-4 Turbo limits');
				console.log('Recommendations:', limitCheck.recommendations);
			} else if (!limitCheck.withinGPT4Limit) {
				console.log('Token count exceeds GPT-4 limits but within GPT-4 Turbo limits');
				console.log('Recommendations:', limitCheck.recommendations);
			}

			// Estimate cost
			const costEstimate = TokenEstimator.estimateCost(tokenEstimate.totalTokens);
			console.log(`Estimated cost: $${costEstimate.totalCost} (Input: $${costEstimate.inputCost}, Output: $${costEstimate.outputCost})`);

			// TODO: Show confirmation dialog with note count and token estimate
			// TODO: Implement actual summarization on confirmation
			console.log('Summary generation would proceed here...');

		} catch (error) {
			console.error('Error processing date selection:', error);
			// TODO: Show user-friendly error notification
		}
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