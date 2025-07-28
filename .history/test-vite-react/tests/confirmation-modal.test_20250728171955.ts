import { App, TFile } from 'obsidian';
import { ConfirmationModal, ConfirmationData } from '../../src/insight-companion/confirmation-modal';
import { TokenEstimate } from '../../src/insight-companion/token-estimator';
import { NoteFilterResult } from '../../src/insight-companion/note-filter';
import { DateRange } from '../../src/insight-companion/date-picker-modal';

// Mock TFile for testing
class MockTFile implements Partial<TFile> {
	path: string;
	stat: { ctime: number; mtime: number; size: number };
	
	constructor(path: string) {
		this.path = path;
		this.stat = { ctime: Date.now(), mtime: Date.now(), size: 1000 };
	}
}

describe('ConfirmationModal Tests', () => {
	let app: App;
	let mockConfirmationData: ConfirmationData;
	let onConfirm: jest.Mock;
	let onCancel: jest.Mock;
	let modal: ConfirmationModal;

	beforeEach(() => {
		app = new App();
		onConfirm = jest.fn();
		onCancel = jest.fn();

		// Create mock filter result
		const mockNotes = [
			{
				file: new MockTFile('note1.md') as TFile,
				content: 'Content of note 1 with some text for testing.',
				createdTime: Date.now(),
				modifiedTime: Date.now()
			},
			{
				file: new MockTFile('note2.md') as TFile,
				content: 'Content of note 2 with different text for variety.',
				createdTime: Date.now(),
				modifiedTime: Date.now()
			}
		];

		const mockFilterResult: NoteFilterResult = {
			notes: mockNotes,
			totalCount: 2,
			dateRange: { startDate: '2023-06-01', endDate: '2023-06-30' } as DateRange
		};

		const mockTokenEstimate: TokenEstimate = {
			contentTokens: 50,
			promptOverheadTokens: 600,
			totalTokens: 650,
			characterCount: 200,
			wordCount: 40,
			noteCount: 2
		};

		const mockCostEstimate = {
			inputCost: 0.02,
			outputCost: 0.01,
			totalCost: 0.03
		};

		const mockLimitCheck = {
			withinGPT4Limit: true,
			withinGPT4TurboLimit: true,
			recommendations: [] as string[]
		};

		mockConfirmationData = {
			filterResult: mockFilterResult,
			tokenEstimate: mockTokenEstimate,
			costEstimate: mockCostEstimate,
			limitCheck: mockLimitCheck
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
		if (modal) {
			modal.close();
		}
	});

	describe('Modal Initialization', () => {
		it('should create modal with confirmation data', () => {
			modal = new ConfirmationModal(app, mockConfirmationData, onConfirm, onCancel);
			expect(modal).toBeInstanceOf(ConfirmationModal);
		});

		it('should store callbacks correctly', () => {
			modal = new ConfirmationModal(app, mockConfirmationData, onConfirm, onCancel);
			
			// Access private properties for testing
			expect((modal as any).onConfirm).toBe(onConfirm);
			expect((modal as any).onCancel).toBe(onCancel);
			expect((modal as any).confirmationData).toBe(mockConfirmationData);
		});
	});

	describe('Modal Rendering', () => {
		beforeEach(() => {
			modal = new ConfirmationModal(app, mockConfirmationData, onConfirm, onCancel);
		});

		it('should render modal content on open', () => {
			modal.onOpen();
			
			expect(modal.contentEl.children.length).toBeGreaterThan(0);
		});

		it('should create title element', () => {
			modal.onOpen();
			
			const children = Array.from(modal.contentEl.children);
			const hasTitle = children.some(child => 
				child.textContent?.includes('Confirm Summary Generation')
			);
			expect(hasTitle).toBe(true);
		});

		it('should display note count and date range', () => {
			modal.onOpen();
			
			const textContent = modal.contentEl.textContent || '';
			expect(textContent).toContain('2 notes');
			expect(textContent).toContain('2023-06-01 to 2023-06-30');
		});

		it('should display token estimation', () => {
			modal.onOpen();
			
			const textContent = modal.contentEl.textContent || '';
			expect(textContent).toContain('650');
			expect(textContent).toContain('tokens');
			expect(textContent).toContain('200 characters');
			expect(textContent).toContain('40 words');
		});

		it('should display cost estimation', () => {
			modal.onOpen();
			
			const textContent = modal.contentEl.textContent || '';
			expect(textContent).toContain('$0.03');
			expect(textContent).toContain('Input: $0.02');
			expect(textContent).toContain('Output: $0.01');
		});

		it('should show example note names', () => {
			modal.onOpen();
			
			const textContent = modal.contentEl.textContent || '';
			expect(textContent).toContain('note1');
			expect(textContent).toContain('note2');
		});
	});

	describe('Button State Management', () => {
		it('should enable confirm button for normal token counts', () => {
			modal = new ConfirmationModal(app, mockConfirmationData, onConfirm, onCancel);
			modal.onOpen();
			
			const confirmButton = (modal as any).confirmButton;
			expect(confirmButton.disabled).toBe(false);
			expect(confirmButton.textContent).toBe('Generate Summary');
		});

		it('should disable confirm button for excessive token counts', () => {
			const highTokenData = {
				...mockConfirmationData,
				tokenEstimate: {
					...mockConfirmationData.tokenEstimate,
					totalTokens: 150000 // Exceeds GPT-4 Turbo limit
				},
				limitCheck: {
					withinGPT4Limit: false,
					withinGPT4TurboLimit: false,
					recommendations: ['Consider chunking notes into smaller batches']
				}
			};

			modal = new ConfirmationModal(app, highTokenData, onConfirm, onCancel);
			modal.onOpen();
			
			const confirmButton = (modal as any).confirmButton;
			expect(confirmButton.disabled).toBe(true);
			expect(confirmButton.textContent).toBe('Token Limit Exceeded');
		});

		it('should show recommendations for high token counts', () => {
			const moderateTokenData = {
				...mockConfirmationData,
				tokenEstimate: {
					...mockConfirmationData.tokenEstimate,
					totalTokens: 10000 // Exceeds GPT-4 but within GPT-4 Turbo limit
				},
				limitCheck: {
					withinGPT4Limit: false,
					withinGPT4TurboLimit: true,
					recommendations: ['Consider using GPT-4 Turbo for larger contexts']
				}
			};

			modal = new ConfirmationModal(app, moderateTokenData, onConfirm, onCancel);
			modal.onOpen();
			
			const textContent = modal.contentEl.textContent || '';
			expect(textContent).toContain('Recommendation');
			expect(textContent).toContain('GPT-4 Turbo');
		});
	});

	describe('User Interactions', () => {
		beforeEach(() => {
			modal = new ConfirmationModal(app, mockConfirmationData, onConfirm, onCancel);
			modal.onOpen();
		});

		it('should call onConfirm when confirm button is clicked', () => {
			const confirmButton = (modal as any).confirmButton;
			
			// Simulate button click
			confirmButton.click();
			
			expect(onConfirm).toHaveBeenCalledTimes(1);
			expect(onCancel).not.toHaveBeenCalled();
		});

		it('should call onCancel when cancel button is clicked', () => {
			// Find cancel button (it's the first button created)
			const buttons = modal.contentEl.querySelectorAll('button');
			const cancelButton = Array.from(buttons).find(btn => 
				btn.textContent === 'Cancel'
			);
			
			expect(cancelButton).toBeDefined();
			cancelButton?.click();
			
			expect(onCancel).toHaveBeenCalledTimes(1);
			expect(onConfirm).not.toHaveBeenCalled();
		});

		it('should not call onConfirm when confirm button is disabled', () => {
			const highTokenData = {
				...mockConfirmationData,
				limitCheck: {
					withinGPT4Limit: false,
					withinGPT4TurboLimit: false,
					recommendations: [] as string[]
				}
			};

			modal.close();
			modal = new ConfirmationModal(app, highTokenData, onConfirm, onCancel);
			modal.onOpen();

			const confirmButton = (modal as any).confirmButton;
			confirmButton.click();
			
			expect(onConfirm).not.toHaveBeenCalled();
		});

		it('should handle keyboard navigation', () => {
			// Simulate Escape key
			const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
			modal.contentEl.dispatchEvent(escapeEvent);
			
			expect(onCancel).toHaveBeenCalledTimes(1);
		});

		it('should handle Enter key for confirmation', () => {
			// Simulate Enter key
			const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
			modal.contentEl.dispatchEvent(enterEvent);
			
			expect(onConfirm).toHaveBeenCalledTimes(1);
		});
	});

	describe('Modal Cleanup', () => {
		beforeEach(() => {
			modal = new ConfirmationModal(app, mockConfirmationData, onConfirm, onCancel);
		});

		it('should clean up content on close', () => {
			modal.onOpen();
			expect(modal.contentEl.children.length).toBeGreaterThan(0);

			modal.onClose();
			expect(modal.contentEl.children.length).toBe(0);
		});
	});

	describe('Static Helper Methods', () => {
		it('should correctly check if generation should be allowed', () => {
			expect(ConfirmationModal.shouldAllowGeneration(5000)).toBe(true);
			expect(ConfirmationModal.shouldAllowGeneration(100000)).toBe(true);
			expect(ConfirmationModal.shouldAllowGeneration(150000)).toBe(false);
		});

		it('should return correct warning levels', () => {
			expect(ConfirmationModal.getWarningLevel(5000)).toBe('none');
			expect(ConfirmationModal.getWarningLevel(10000)).toBe('info');
			expect(ConfirmationModal.getWarningLevel(150000)).toBe('error');
		});
	});

	describe('Edge Cases', () => {
		it('should handle single note correctly', () => {
			const singleNoteData = {
				...mockConfirmationData,
				filterResult: {
					...mockConfirmationData.filterResult,
					notes: [mockConfirmationData.filterResult.notes[0]],
					totalCount: 1
				},
				tokenEstimate: {
					...mockConfirmationData.tokenEstimate,
					noteCount: 1
				}
			};

			modal = new ConfirmationModal(app, singleNoteData, onConfirm, onCancel);
			modal.onOpen();
			
			const textContent = modal.contentEl.textContent || '';
			expect(textContent).toContain('1 note'); // Should be singular
			expect(textContent).not.toContain('1 notes'); // Should not be plural
		});

		it('should handle many notes with truncated display', () => {
			const manyNotes = Array.from({ length: 10 }, (_, i) => ({
				file: new MockTFile(`note${i + 1}.md`) as TFile,
				content: `Content of note ${i + 1}`,
				createdTime: Date.now(),
				modifiedTime: Date.now()
			}));

			const manyNotesData = {
				...mockConfirmationData,
				filterResult: {
					...mockConfirmationData.filterResult,
					notes: manyNotes,
					totalCount: 10
				}
			};

			modal = new ConfirmationModal(app, manyNotesData, onConfirm, onCancel);
			modal.onOpen();
			
			const textContent = modal.contentEl.textContent || '';
			expect(textContent).toContain('... and 7 more'); // Should show truncation
		});

		it('should handle zero cost correctly', () => {
			const zeroCostData = {
				...mockConfirmationData,
				costEstimate: {
					inputCost: 0,
					outputCost: 0,
					totalCost: 0
				}
			};

			modal = new ConfirmationModal(app, zeroCostData, onConfirm, onCancel);
			modal.onOpen();
			
			const textContent = modal.contentEl.textContent || '';
			expect(textContent).toContain('$0.00');
		});
	});
}); 