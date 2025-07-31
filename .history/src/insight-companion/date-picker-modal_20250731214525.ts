import { App, Modal, Setting } from 'obsidian';

export interface DateRange {
	startDate: string;
	endDate: string;
	insightStyle?: 'structured' | 'freeform';
	dateSource?: 'created' | 'modified';
}

export class DatePickerModal extends Modal {
	private startDate: string;
	private endDate: string;
	private insightStyle: 'structured' | 'freeform' = 'structured';
	private onSubmit: (dateRange: DateRange) => void;
	private startDateInput: HTMLInputElement;
	private endDateInput: HTMLInputElement;
	private errorEl: HTMLElement;

	constructor(app: App, defaultDateRange: DateRange | null, onSubmit: (dateRange: DateRange) => void) {
		super(app);
		
		// Set default dates or use current date and 30 days ago
		const today = new Date();
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(today.getDate() - 30);
		
		this.startDate = defaultDateRange?.startDate || this.formatDate(thirtyDaysAgo);
		this.endDate = defaultDateRange?.endDate || this.formatDate(today);
		this.insightStyle = defaultDateRange?.insightStyle || 'structured';
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Select Date Range for Insight Summary' });

		// Start date setting
		new Setting(contentEl)
			.setName('Start Date')
			.setDesc('Select the start date for note filtering')
			.addText(text => {
				this.startDateInput = text.inputEl;
				text.inputEl.type = 'date';
				text.setValue(this.startDate);
				text.onChange(value => {
					this.startDate = value;
					this.validateDates();
				});
			});

		// End date setting
		new Setting(contentEl)
			.setName('End Date')
			.setDesc('Select the end date for note filtering')
			.addText(text => {
				this.endDateInput = text.inputEl;
				text.inputEl.type = 'date';
				text.setValue(this.endDate);
				text.onChange(value => {
					this.endDate = value;
					this.validateDates();
				});
			});

		// Insight style setting
		new Setting(contentEl)
			.setName('Insight Style')
			.setDesc('Choose the format for your insight summary')
			.addDropdown(dropdown => {
				dropdown.addOption('structured', 'Structured (Clear headings like Themes, People, Actions)');
				dropdown.addOption('freeform', 'Freeform (Memo-style summary with natural flow, only required heading is Notes Referenced)');
				dropdown.setValue(this.insightStyle);
				dropdown.onChange(value => {
					this.insightStyle = value as 'structured' | 'freeform';
				});
			});

		// Error message element
		this.errorEl = contentEl.createEl('div', { 
			cls: 'mod-warning',
			text: '',
			attr: { style: 'display: none; margin: 10px 0; padding: 10px; border-radius: 4px;' }
		});

		// Preset buttons section
		const presetSection = contentEl.createEl('div', { cls: 'setting-item' });
		presetSection.createEl('div', { 
			cls: 'setting-item-info',
			text: 'Quick Presets'
		});
		
		const presetButtons = presetSection.createEl('div', { 
			cls: 'setting-item-control',
			attr: { style: 'display: flex; gap: 8px; flex-wrap: wrap;' }
		});

		// Create preset buttons
		this.createPresetButton(presetButtons, 'Last 7 days', 7);
		this.createPresetButton(presetButtons, 'Last 30 days', 30);
		this.createPresetButton(presetButtons, 'Last 90 days', 90);
		this.createPresetButton(presetButtons, 'This month', 0);

		// Action buttons
		const buttonContainer = contentEl.createEl('div', { 
			attr: { style: 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;' }
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.close();
		});

		// Generate Summary button
		const submitButton = buttonContainer.createEl('button', { 
			text: 'Generate Summary',
			cls: 'mod-cta'
		});
		submitButton.addEventListener('click', () => {
			if (this.validateDates()) {
				this.onSubmit({
					startDate: this.startDate,
					endDate: this.endDate,
					insightStyle: this.insightStyle
				});
				this.close();
			}
		});

		// Initial validation
		this.validateDates();
	}

	private createPresetButton(container: HTMLElement, label: string, daysAgo: number) {
		const button = container.createEl('button', { 
			text: label,
			cls: 'mod-muted'
		});
		
		button.addEventListener('click', () => {
			const today = new Date();
			let startDate: Date;
			
			if (daysAgo === 0) {
				// This month
				startDate = new Date(today.getFullYear(), today.getMonth(), 1);
			} else {
				// Last N days
				startDate = new Date();
				startDate.setDate(today.getDate() - daysAgo);
			}
			
			this.startDate = this.formatDate(startDate);
			this.endDate = this.formatDate(today);
			
			this.startDateInput.value = this.startDate;
			this.endDateInput.value = this.endDate;
			
			this.validateDates();
		});
	}

	private validateDates(): boolean {
		const start = new Date(this.startDate);
		const end = new Date(this.endDate);
		
		if (start > end) {
			this.showError('End date must be after start date');
			return false;
		}
		
		if (!this.startDate || !this.endDate) {
			this.showError('Please select both start and end dates');
			return false;
		}
		
		this.hideError();
		return true;
	}

	private showError(message: string) {
		this.errorEl.textContent = message;
		this.errorEl.style.display = 'block';
	}

	private hideError() {
		this.errorEl.style.display = 'none';
	}

	private formatDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
} 