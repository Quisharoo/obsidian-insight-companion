import { App, Modal, Setting } from 'obsidian';
import { TokenEstimate } from './token-estimator';
import { NoteFilterResult } from './note-filter';

export interface ConfirmationData {
	filterResult: NoteFilterResult;
	tokenEstimate: TokenEstimate;
	costEstimate: { inputCost: number; outputCost: number; totalCost: number };
	limitCheck: { 
		withinGPT4Limit: boolean; 
		withinGPT4TurboLimit: boolean; 
		recommendations: string[] 
	};
}

export class ConfirmationModal extends Modal {
	private confirmationData: ConfirmationData;
	private onConfirm: () => void;
	private onCancel: () => void;
	private confirmButton: HTMLButtonElement;

	constructor(
		app: App, 
		confirmationData: ConfirmationData,
		onConfirm: () => void,
		onCancel: () => void
	) {
		super(app);
		this.confirmationData = confirmationData;
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add custom styles to the modal
		this.addStyles();

		// Modal title
		contentEl.createEl('h2', { text: 'Confirm Summary Generation' });

		// Notes summary section
		this.createNotesSection(contentEl);

		// Token estimation section
		this.createTokenSection(contentEl);

		// Cost estimation section
		this.createCostSection(contentEl);

		// Warnings section (if needed)
		this.createWarningsSection(contentEl);

		// Action buttons
		this.createActionButtons(contentEl);
	}

	private addStyles() {
		// Add inline styles for the modal to ensure proper styling
		const style = document.createElement('style');
		style.textContent = `
			.confirmation-section {
				margin: 20px 0;
				padding: 15px;
				background: var(--background-secondary);
				border-radius: 6px;
			}
			
			.confirmation-section h3 {
				margin: 0 0 10px 0;
				color: var(--text-normal);
				font-size: 1.1em;
			}
			
			.token-info .token-total {
				font-weight: bold;
				font-size: 1.2em;
				margin-bottom: 5px;
				color: var(--text-accent);
			}
			
			.token-breakdown, .token-stats {
				color: var(--text-muted);
				font-size: 0.9em;
				margin: 2px 0;
			}
			
			.cost-info .cost-total {
				font-weight: bold;
				font-size: 1.1em;
				color: var(--text-accent);
			}
			
			.cost-breakdown, .cost-disclaimer {
				color: var(--text-muted);
				font-size: 0.9em;
			}
			
			.warning-section {
				background: var(--background-modifier-error) !important;
				border: 1px solid var(--background-modifier-error-border);
			}
			
			.warning-title {
				color: var(--text-error) !important;
			}
			
			.warning-text {
				color: var(--text-error);
			}
			
			.info-title {
				color: var(--text-accent) !important;
			}
			
			.info-text {
				color: var(--text-normal);
			}
			
			.note-examples {
				margin: 10px 0;
				padding-left: 20px;
			}
			
			.note-examples li {
				color: var(--text-muted);
				margin: 2px 0;
			}
			
			.note-examples-more {
				font-style: italic;
			}
			
			.recommendations-list {
				margin: 10px 0;
				padding-left: 20px;
			}
			
			.recommendations-list li {
				margin: 5px 0;
			}
			
			.confirmation-buttons {
				display: flex;
				gap: 10px;
				justify-content: flex-end;
				margin-top: 30px;
			}
			
			.confirmation-buttons button:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		`;
		document.head.appendChild(style);
	}

	private createNotesSection(containerEl: HTMLElement) {
		const notesSection = containerEl.createEl('div', { cls: 'confirmation-section' });
		notesSection.createEl('h3', { text: 'Notes Selected' });

		const { filterResult } = this.confirmationData;
		const dateRangeText = `${filterResult.dateRange.startDate} to ${filterResult.dateRange.endDate}`;

		notesSection.createEl('p', { 
			text: `Found ${filterResult.totalCount} note${filterResult.totalCount !== 1 ? 's' : ''} in the date range: ${dateRangeText}` 
		});

		// Show a few example note names if available
		if (filterResult.notes.length > 0) {
			const exampleCount = Math.min(3, filterResult.notes.length);
			const exampleList = notesSection.createEl('ul', { cls: 'note-examples' });
			
			for (let i = 0; i < exampleCount; i++) {
				const noteName = filterResult.notes[i].file.path.replace('.md', '');
				exampleList.createEl('li', { text: noteName });
			}

			if (filterResult.notes.length > 3) {
				exampleList.createEl('li', { 
					text: `... and ${filterResult.notes.length - 3} more`,
					cls: 'note-examples-more'
				});
			}
		}
	}

	private createTokenSection(containerEl: HTMLElement) {
		const tokenSection = containerEl.createEl('div', { cls: 'confirmation-section' });
		tokenSection.createEl('h3', { text: 'Token Estimation' });

		const { tokenEstimate } = this.confirmationData;

		// Main token info
		const tokenInfo = tokenSection.createEl('div', { cls: 'token-info' });
		tokenInfo.createEl('div', { 
			text: `Total Tokens: ${tokenEstimate.totalTokens.toLocaleString()}`,
			cls: 'token-total'
		});
		
		tokenInfo.createEl('div', { 
			text: `Content: ${tokenEstimate.contentTokens.toLocaleString()} tokens`,
			cls: 'token-breakdown'
		});
		
		tokenInfo.createEl('div', { 
			text: `Overhead: ${tokenEstimate.promptOverheadTokens.toLocaleString()} tokens`,
			cls: 'token-breakdown'
		});

		// Additional stats
		const statsInfo = tokenSection.createEl('div', { cls: 'token-stats' });
		statsInfo.createEl('span', { text: `${tokenEstimate.characterCount.toLocaleString()} characters` });
		statsInfo.createEl('span', { text: ' • ' });
		statsInfo.createEl('span', { text: `${tokenEstimate.wordCount.toLocaleString()} words` });
	}

	private createCostSection(containerEl: HTMLElement) {
		const costSection = containerEl.createEl('div', { cls: 'confirmation-section' });
		costSection.createEl('h3', { text: 'Estimated Cost' });

		const { costEstimate } = this.confirmationData;

		const costInfo = costSection.createEl('div', { cls: 'cost-info' });
		costInfo.createEl('div', { 
			text: `Total: $${costEstimate.totalCost.toFixed(2)}`,
			cls: 'cost-total'
		});
		
		costInfo.createEl('div', { 
			text: `Input: $${costEstimate.inputCost.toFixed(2)} • Output: $${costEstimate.outputCost.toFixed(2)}`,
			cls: 'cost-breakdown'
		});

		costSection.createEl('p', { 
			text: 'Based on GPT-4 pricing. Actual costs may vary.',
			cls: 'cost-disclaimer'
		});
	}

	private createWarningsSection(containerEl: HTMLElement) {
		const { limitCheck } = this.confirmationData;

		if (!limitCheck.withinGPT4TurboLimit || limitCheck.recommendations.length > 0) {
			const warningSection = containerEl.createEl('div', { 
				cls: 'confirmation-section warning-section' 
			});
			
			if (!limitCheck.withinGPT4TurboLimit) {
				warningSection.createEl('h3', { 
					text: '⚠️ Token Limit Warning',
					cls: 'warning-title'
				});
				
				warningSection.createEl('p', { 
					text: 'The token count exceeds recommended limits and may cause API errors.',
					cls: 'warning-text'
				});
			} else if (!limitCheck.withinGPT4Limit) {
				warningSection.createEl('h3', { 
					text: '💡 Recommendation',
					cls: 'info-title'
				});
				
				warningSection.createEl('p', { 
					text: 'Consider using GPT-4 Turbo for this request size.',
					cls: 'info-text'
				});
			}

			if (limitCheck.recommendations.length > 0) {
				warningSection.createEl('p', { text: 'Suggestions:' });
				const recommendationsList = warningSection.createEl('ul', { cls: 'recommendations-list' });
				
				limitCheck.recommendations.forEach(rec => {
					recommendationsList.createEl('li', { text: rec });
				});
			}
		}
	}

	private createActionButtons(containerEl: HTMLElement) {
		const buttonContainer = containerEl.createEl('div', { 
			cls: 'confirmation-buttons'
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl('button', { 
			text: 'Cancel',
			cls: 'mod-muted'
		});
		cancelButton.addEventListener('click', () => {
			this.onCancel();
			this.close();
		});

		// Confirm button
		this.confirmButton = buttonContainer.createEl('button', { 
			text: 'Generate Summary',
			cls: 'mod-cta'
		});

		// Disable confirm button if token count is too high
		const { limitCheck } = this.confirmationData;
		if (!limitCheck.withinGPT4TurboLimit) {
			this.confirmButton.disabled = true;
			this.confirmButton.textContent = 'Token Limit Exceeded';
			this.confirmButton.classList.add('mod-warning');
		}

		this.confirmButton.addEventListener('click', () => {
			if (!this.confirmButton.disabled) {
				this.onConfirm();
				this.close();
			}
		});

		// Add keyboard navigation
		this.setupKeyboardNavigation();
	}

	private setupKeyboardNavigation() {
		// Add keyboard event listeners for the modal
		const handleKeydown = (evt: KeyboardEvent) => {
			if (evt.key === 'Escape') {
				this.onCancel();
				this.close();
			} else if (evt.key === 'Enter' && !this.confirmButton.disabled) {
				evt.preventDefault();
				this.onConfirm();
				this.close();
			}
		};

		this.contentEl.addEventListener('keydown', handleKeydown);
		
		// Make sure the modal can receive focus for keyboard events
		this.contentEl.tabIndex = -1;
		this.contentEl.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	// Static method to check if generation should be allowed
	static shouldAllowGeneration(tokenCount: number): boolean {
		return tokenCount <= 128000; // GPT-4 Turbo limit
	}

	// Static method to get appropriate warning level
	static getWarningLevel(tokenCount: number): 'none' | 'info' | 'warning' | 'error' {
		if (tokenCount <= 8192) return 'none';
		if (tokenCount <= 128000) return 'info';
		return 'error';
	}
} 