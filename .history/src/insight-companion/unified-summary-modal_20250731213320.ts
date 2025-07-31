import { App, Modal, Setting, TFolder } from 'obsidian';
import { DateRange } from './date-picker-modal';

export interface UnifiedSummaryResult {
	dateRange?: DateRange;
	folderPath?: string;
	folderName?: string;
	insightStyle: 'structured' | 'freeform';
}

export class UnifiedSummaryModal extends Modal {
	private startDate: string;
	private endDate: string;
	private selectedFolder: string = '';
	private insightStyle: 'structured' | 'freeform' = 'structured';
	private onSubmit: (result: UnifiedSummaryResult) => void;
	private startDateInput: HTMLInputElement;
	private endDateInput: HTMLInputElement;
	private folderDropdown: HTMLSelectElement;
	private errorEl: HTMLElement;
	private infoEl: HTMLElement;

	constructor(app: App, defaultDateRange: DateRange | null, onSubmit: (result: UnifiedSummaryResult) => void) {
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

		// Add custom styles for improved layout
		this.addStyles();

		contentEl.createEl('h2', { text: 'Summarise Notes' });

		// Description with improved spacing
		contentEl.createEl('p', { 
			text: 'Select date range and/or folder to filter notes. Both filters are optional - leave empty to include all notes.',
			cls: 'mod-muted',
			attr: { style: 'margin-bottom: 24px; line-height: 1.5;' }
		});

		// Date Range Section
		this.createDateSection(contentEl);

		// Folder Section
		this.createFolderSection(contentEl);

		// Insight Style Section
		this.createInsightStyleSection(contentEl);

		// Error and Info Messages
		this.createMessageElements(contentEl);

		// Preset Buttons for Date Range
		this.createPresetButtons(contentEl);

		// Action Buttons
		this.createActionButtons(contentEl);

		// Initial validation
		this.validateInputs();
		this.updateInfo();
	}

	private addStyles() {
		// Add inline styles for the modal to ensure proper styling
		const style = document.createElement('style');
		style.textContent = `
			.summary-section {
				margin: 24px 0;
				padding: 20px;
				background: var(--background-secondary);
				border-radius: 8px;
				border: 1px solid var(--background-modifier-border);
			}
			
			.summary-section h3 {
				margin: 0 0 16px 0;
				color: var(--text-normal);
				font-size: 1.1em;
				font-weight: 600;
				display: flex;
				align-items: center;
				gap: 8px;
			}
			
			.summary-section .setting-item {
				margin: 12px 0;
			}
			
			.summary-section .setting-item:first-child {
				margin-top: 0;
			}
			
			.summary-section .setting-item:last-child {
				margin-bottom: 0;
			}
			
			.preset-section {
				margin: 20px 0;
				padding: 16px;
				background: var(--background-primary);
				border-radius: 6px;
				border: 1px solid var(--background-modifier-border);
			}
			
			.preset-section .setting-item-info {
				margin-bottom: 12px;
				color: var(--text-muted);
				font-weight: 500;
			}
			
			.preset-buttons {
				display: flex;
				gap: 8px;
				flex-wrap: wrap;
			}
			
			.preset-button {
				padding: 6px 12px;
				border: 1px solid var(--background-modifier-border);
				background: var(--background-secondary);
				color: var(--text-normal);
				border-radius: 4px;
				font-size: 0.9em;
				cursor: pointer;
				transition: all 0.2s ease;
			}
			
			.preset-button:hover {
				background: var(--background-modifier-hover);
				border-color: var(--background-modifier-border-hover);
			}
			
			.preset-button:active {
				background: var(--background-modifier-active);
			}
			
			.message-container {
				margin: 16px 0;
			}
			
			.message-container .mod-warning,
			.message-container .mod-info {
				margin: 8px 0;
				padding: 12px;
				border-radius: 6px;
				border: 1px solid;
			}
			
			.message-container .mod-warning {
				border-color: var(--background-modifier-error-border);
				background: var(--background-modifier-error);
			}
			
			.message-container .mod-info {
				border-color: var(--background-modifier-border);
				background: var(--background-secondary);
			}
			
			.action-buttons {
				display: flex;
				gap: 12px;
				justify-content: flex-end;
				margin-top: 32px;
				padding-top: 20px;
				border-top: 1px solid var(--background-modifier-border);
			}
			
			.action-buttons button {
				padding: 8px 16px;
				border-radius: 4px;
				font-size: 0.9em;
				cursor: pointer;
				transition: all 0.2s ease;
			}
			
			.action-buttons button.mod-cta {
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				border: none;
			}
			
			.action-buttons button.mod-cta:hover {
				background: var(--interactive-accent-hover);
			}
			
			.action-buttons button:not(.mod-cta) {
				background: var(--background-secondary);
				color: var(--text-normal);
				border: 1px solid var(--background-modifier-border);
			}
			
			.action-buttons button:not(.mod-cta):hover {
				background: var(--background-modifier-hover);
				border-color: var(--background-modifier-border-hover);
			}
		`;
		document.head.appendChild(style);
	}

	private createDateSection(containerEl: HTMLElement) {
		const dateSection = containerEl.createEl('div', { cls: 'summary-section' });

		dateSection.createEl('h3', { text: '📅 Date Range (Optional)' });

		// Start date setting
		new Setting(dateSection)
			.setName('Start Date')
			.setDesc('Select the start date for note filtering')
			.addText(text => {
				this.startDateInput = text.inputEl;
				text.inputEl.type = 'date';
				text.setValue(this.startDate);
				text.onChange(value => {
					this.startDate = value;
					this.validateInputs();
					this.updateInfo();
				});
			});

		// End date setting
		new Setting(dateSection)
			.setName('End Date')
			.setDesc('Select the end date for note filtering')
			.addText(text => {
				this.endDateInput = text.inputEl;
				text.inputEl.type = 'date';
				text.setValue(this.endDate);
				text.onChange(value => {
					this.endDate = value;
					this.validateInputs();
					this.updateInfo();
				});
			});
	}

	private createFolderSection(containerEl: HTMLElement) {
		const folderSection = containerEl.createEl('div', { cls: 'summary-section' });

		folderSection.createEl('h3', { text: '📁 Folder (Optional)' });

		// Folder selection
		new Setting(folderSection)
			.setName('Folder')
			.setDesc('Select a folder to filter notes. Leave empty to include all folders.')
			.addDropdown(dropdown => {
				this.folderDropdown = dropdown.selectEl;
				
				// Add empty option for "all folders"
				dropdown.addOption('', 'All Folders (no filter)');
				
				// Get all folders and add them to dropdown
				const folders = this.getAllFolders();
				folders.forEach(folder => {
					dropdown.addOption(folder.path, folder.path || 'Vault Root');
				});

				dropdown.onChange(value => {
					this.selectedFolder = value;
					this.validateInputs();
					this.updateInfo();
				});
			});
	}

	private createInsightStyleSection(containerEl: HTMLElement) {
		const styleSection = containerEl.createEl('div', { cls: 'summary-section' });

		styleSection.createEl('h3', { text: '🎨 Insight Style' });

		new Setting(styleSection)
			.setName('Format')
			.setDesc('Choose the format for your insight summary')
			.addDropdown(dropdown => {
				dropdown.addOption('structured', 'Structured (Clear headings like Themes, People, Actions)');
				dropdown.addOption('freeform', 'Freeform (Memo-style summary with natural flow, only required heading is Notes Referenced)');
				dropdown.setValue(this.insightStyle);
				dropdown.onChange(value => {
					this.insightStyle = value as 'structured' | 'freeform';
				});
			});
	}

	private createMessageElements(containerEl: HTMLElement) {
		const messageContainer = containerEl.createEl('div', { cls: 'message-container' });

		// Error message element
		this.errorEl = messageContainer.createEl('div', { 
			cls: 'mod-warning',
			text: '',
			attr: { style: 'display: none;' }
		});

		// Info message element
		this.infoEl = messageContainer.createEl('div', { 
			cls: 'mod-info',
			text: ''
		});
	}

	private createPresetButtons(containerEl: HTMLElement) {
		const presetSection = containerEl.createEl('div', { cls: 'preset-section' });
		presetSection.createEl('div', { 
			cls: 'setting-item-info',
			text: 'Quick Date Presets'
		});
		
		const presetButtons = presetSection.createEl('div', { cls: 'preset-buttons' });

		// Create preset buttons
		this.createPresetButton(presetButtons, 'Last 7 days', 7);
		this.createPresetButton(presetButtons, 'Last 30 days', 30);
		this.createPresetButton(presetButtons, 'Last 90 days', 90);
		this.createPresetButton(presetButtons, 'This month', 0);
	}

	private createPresetButton(container: HTMLElement, label: string, daysAgo: number) {
		const button = container.createEl('button', { 
			text: label,
			cls: 'preset-button'
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
			
			this.validateInputs();
			this.updateInfo();
		});
	}

	private createActionButtons(containerEl: HTMLElement) {
		const buttonContainer = containerEl.createEl('div', { cls: 'action-buttons' });

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
			if (this.validateInputs()) {
				this.handleSubmit();
			}
		});
	}

	private getAllFolders(): TFolder[] {
		const folders: TFolder[] = [];
		
		// Recursively collect all folders
		const collectFolders = (folder: TFolder) => {
			folders.push(folder);
			folder.children.forEach(child => {
				if (child instanceof TFolder) {
					collectFolders(child);
				}
			});
		};

		// Start with root folders
		this.app.vault.getAllLoadedFiles().forEach(file => {
			if (file instanceof TFolder && file.parent === this.app.vault.getRoot()) {
				collectFolders(file);
			}
		});

		// Sort folders by path for better UX
		return folders.sort((a, b) => a.path.localeCompare(b.path));
	}

	private validateInputs(): boolean {
		// Validate date range if dates are provided
		if (this.startDate && this.endDate) {
			const start = new Date(this.startDate);
			const end = new Date(this.endDate);
			
			if (start > end) {
				this.showError('End date must be after start date');
				return false;
			}
		}
		
		this.hideError();
		return true;
	}

	private updateInfo() {
		let infoText = '';
		
		// Build filter description
		const filters: string[] = [];
		
		if (this.startDate && this.endDate) {
			filters.push(`date range: ${this.startDate} to ${this.endDate}`);
		}
		
		if (this.selectedFolder) {
			const folderName = this.selectedFolder.split('/').pop() || this.selectedFolder;
			filters.push(`folder: ${folderName}`);
		}
		
		if (filters.length === 0) {
			infoText = 'No filters selected - will include all notes in the vault.';
		} else {
			infoText = `Will filter notes by: ${filters.join(' and ')}.`;
		}
		
		this.infoEl.textContent = infoText;
	}

	private showError(message: string) {
		this.errorEl.textContent = message;
		this.errorEl.style.display = 'block';
	}

	private hideError() {
		this.errorEl.style.display = 'none';
	}

	private handleSubmit(): void {
		const result: UnifiedSummaryResult = {
			insightStyle: this.insightStyle
		};

		// Add date range if provided
		if (this.startDate && this.endDate) {
			result.dateRange = {
				startDate: this.startDate,
				endDate: this.endDate,
				insightStyle: this.insightStyle
			};
		}

		// Add folder if provided
		if (this.selectedFolder) {
			result.folderPath = this.selectedFolder;
			result.folderName = this.selectedFolder === '' 
				? 'Vault Root' 
				: this.selectedFolder.split('/').pop() || this.selectedFolder;
		}

		this.onSubmit(result);
		this.close();
	}

	private formatDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
} 