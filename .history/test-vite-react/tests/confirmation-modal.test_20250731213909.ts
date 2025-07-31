import { ConfirmationModal, ConfirmationData, ConfirmationResult } from '../../src/insight-companion/confirmation-modal';
import { NoteFilterResult } from '../../src/insight-companion/note-filter';
import { TokenEstimate } from '../../src/insight-companion/token-estimator';

// Mock Obsidian App
const mockApp = {
	vault: {
		getAllLoadedFiles: jest.fn().mockReturnValue([])
	}
} as any;

describe('ConfirmationModal', () => {
	let modal: ConfirmationModal;
	let mockOnResult: jest.Mock;
	let mockConfirmationData: ConfirmationData;

	beforeEach(() => {
		mockOnResult = jest.fn();
		mockConfirmationData = {
			filterResult: {
				notes: [],
				totalCount: 0,
				mode: 'unified',
				dateRange: { startDate: '2025-01-01', endDate: '2025-01-31', insightStyle: 'structured' },
				folderName: 'Test Folder',
				folderPath: 'test-folder',
				filterMeta: {
					folderPath: 'test-folder',
					dateRange: { start: new Date('2025-01-01'), end: new Date('2025-01-31') },
					insightStyle: 'structured'
				}
			},
			tokenEstimate: {
				totalTokens: 1000,
				contentTokens: 800,
				promptOverheadTokens: 200,
				characterCount: 4000,
				wordCount: 1000,
				noteCount: 5
			},
			costEstimate: {
				inputCost: 0.01,
				outputCost: 0.02,
				totalCost: 0.03,
				modelType: 'turbo'
			},
			limitCheck: {
				withinGPT4Limit: true,
				withinGPT4TurboLimit: true,
				recommendations: []
			}
		};
		
		modal = new ConfirmationModal(mockApp, mockConfirmationData, mockOnResult);
	});

	describe('constructor', () => {
		test('should initialize with confirmation data', () => {
			expect(modal).toBeDefined();
		});
	});

	describe('result handling', () => {
		test('should call onResult with confirmed: true when confirmed', () => {
			// Simulate confirmation by calling the result handler directly
			modal['onResult']({ confirmed: true });
			
			expect(mockOnResult).toHaveBeenCalledWith({ confirmed: true });
		});

		test('should call onResult with confirmed: false when cancelled', () => {
			// Simulate cancellation by calling the result handler directly
			modal['onResult']({ confirmed: false });
			
			expect(mockOnResult).toHaveBeenCalledWith({ confirmed: false });
		});
	});

	describe('static methods', () => {
		test('should allow generation within limits', () => {
			expect(ConfirmationModal.shouldAllowGeneration(1000)).toBe(true);
			expect(ConfirmationModal.shouldAllowGeneration(128000)).toBe(true);
			expect(ConfirmationModal.shouldAllowGeneration(128001)).toBe(false);
		});

		test('should return correct warning levels', () => {
			expect(ConfirmationModal.getWarningLevel(1000)).toBe('none');
			expect(ConfirmationModal.getWarningLevel(8192)).toBe('none');
			expect(ConfirmationModal.getWarningLevel(8193)).toBe('info');
			expect(ConfirmationModal.getWarningLevel(128000)).toBe('info');
			expect(ConfirmationModal.getWarningLevel(128001)).toBe('error');
		});
	});

	describe('onClose', () => {
		test('should have onClose method', () => {
			expect(typeof modal.onClose).toBe('function');
		});
	});
}); 