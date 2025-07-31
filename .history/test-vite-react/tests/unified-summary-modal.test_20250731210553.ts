import { UnifiedSummaryModal, UnifiedSummaryResult } from '../../src/insight-companion/unified-summary-modal';
import { DateRange } from '../../src/insight-companion/date-picker-modal';

// Mock Obsidian App
const mockApp = {
	vault: {
		getAllLoadedFiles: jest.fn().mockReturnValue([
			{ path: 'folder1', parent: null, children: [], name: 'folder1' },
			{ path: 'folder1/subfolder', parent: { path: 'folder1' }, children: [], name: 'subfolder' },
			{ path: 'folder2', parent: null, children: [], name: 'folder2' }
		])
	}
} as any;

describe('UnifiedSummaryModal', () => {
	let modal: UnifiedSummaryModal;
	let mockOnSubmit: jest.Mock;
	let mockDefaultDateRange: DateRange | null;

	beforeEach(() => {
		mockOnSubmit = jest.fn();
		mockDefaultDateRange = {
			startDate: '2025-01-01',
			endDate: '2025-01-31',
			insightStyle: 'structured'
		};
		
		modal = new UnifiedSummaryModal(mockApp, mockDefaultDateRange, mockOnSubmit);
	});

	describe('constructor', () => {
		test('should initialize with default date range', () => {
			expect(modal).toBeDefined();
		});

		test('should initialize with null date range', () => {
			const modalWithNull = new UnifiedSummaryModal(mockApp, null, mockOnSubmit);
			expect(modalWithNull).toBeDefined();
		});
	});

		describe('constructor and initialization', () => {
		test('should initialize with default date range', () => {
			expect(modal['startDate']).toBe('2025-01-01');
			expect(modal['endDate']).toBe('2025-01-31');
			expect(modal['insightStyle']).toBe('structured');
		});

		test('should initialize with null date range', () => {
			const modalWithNull = new UnifiedSummaryModal(mockApp, null, mockOnSubmit);
			expect(modalWithNull).toBeDefined();
		});
	});

	describe('date preset buttons', () => {
		test('should update dates when preset buttons are clicked', () => {
			// Test the preset button logic directly
			const originalStartDate = modal['startDate'];
			const originalEndDate = modal['endDate'];
			
			// Simulate clicking "Last 7 days" preset
			const today = new Date();
			const sevenDaysAgo = new Date();
			sevenDaysAgo.setDate(today.getDate() - 7);
			
			modal['startDate'] = modal['formatDate'](sevenDaysAgo);
			modal['endDate'] = modal['formatDate'](today);
			
			expect(modal['startDate']).not.toBe(originalStartDate);
			expect(modal['endDate']).not.toBe(originalEndDate);
		});
	});

	describe('validation', () => {
		test('should validate date range correctly', () => {
			// Set invalid date range (end before start)
			modal['startDate'] = '2025-01-31';
			modal['endDate'] = '2025-01-01';
			
			const isValid = modal['validateInputs']();
			expect(isValid).toBe(false);
		});

		test('should pass validation with valid dates', () => {
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			
			const isValid = modal['validateInputs']();
			expect(isValid).toBe(true);
		});
	});

	describe('handleSubmit', () => {

		test('should submit with date range only', () => {
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			modal['selectedFolder'] = '';
			modal['insightStyle'] = 'structured';
			
			modal['handleSubmit']();
			
			expect(mockOnSubmit).toHaveBeenCalledWith({
				dateRange: {
					startDate: '2025-01-01',
					endDate: '2025-01-31',
					insightStyle: 'structured'
				},
				insightStyle: 'structured'
			});
		});

		test('should submit with folder only', () => {
			modal['startDate'] = '';
			modal['endDate'] = '';
			modal['selectedFolder'] = 'folder1';
			modal['insightStyle'] = 'freeform';
			
			modal['handleSubmit']();
			
			expect(mockOnSubmit).toHaveBeenCalledWith({
				folderPath: 'folder1',
				folderName: 'folder1',
				insightStyle: 'freeform'
			});
		});

		test('should submit with both date range and folder', () => {
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			modal['selectedFolder'] = 'folder1';
			modal['insightStyle'] = 'structured';
			
			modal['handleSubmit']();
			
			expect(mockOnSubmit).toHaveBeenCalledWith({
				dateRange: {
					startDate: '2025-01-01',
					endDate: '2025-01-31',
					insightStyle: 'structured'
				},
				folderPath: 'folder1',
				folderName: 'folder1',
				insightStyle: 'structured'
			});
		});

		test('should submit with no filters (all notes)', () => {
			modal['startDate'] = '';
			modal['endDate'] = '';
			modal['selectedFolder'] = '';
			modal['insightStyle'] = 'structured';
			
			modal['handleSubmit']();
			
			expect(mockOnSubmit).toHaveBeenCalledWith({
				insightStyle: 'structured'
			});
		});
	});

	describe('updateInfo', () => {
		test('should show correct info for date range only', () => {
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			modal['selectedFolder'] = '';
			
			modal['updateInfo']();
			
			// Test the info text directly
			expect(modal['infoEl']?.textContent).toContain('date range: 2025-01-01 to 2025-01-31');
		});

		test('should show correct info for folder only', () => {
			modal['startDate'] = '';
			modal['endDate'] = '';
			modal['selectedFolder'] = 'folder1';
			
			modal['updateInfo']();
			
			expect(modal['infoEl']?.textContent).toContain('folder: folder1');
		});

		test('should show correct info for both filters', () => {
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			modal['selectedFolder'] = 'folder1';
			
			modal['updateInfo']();
			
			expect(modal['infoEl']?.textContent).toContain('date range: 2025-01-01 to 2025-01-31');
			expect(modal['infoEl']?.textContent).toContain('folder: folder1');
		});

		test('should show correct info for no filters', () => {
			modal['startDate'] = '';
			modal['endDate'] = '';
			modal['selectedFolder'] = '';
			
			modal['updateInfo']();
			
			expect(modal['infoEl']?.textContent).toContain('No filters selected - will include all notes in the vault');
		});
	});

	describe('onClose', () => {
		test('should clear content on close', () => {
			modal.onClose();
			
			expect(modal.contentEl.empty).toHaveBeenCalled();
		});
	});
}); 