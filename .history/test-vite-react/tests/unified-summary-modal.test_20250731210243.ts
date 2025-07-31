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

	describe('onOpen', () => {
			beforeEach(() => {
		// Mock DOM elements with proper Obsidian modal structure
		modal.contentEl = {
			empty: jest.fn(),
			createEl: jest.fn((tag: string, options: any) => {
				const element = document.createElement(tag);
				if (options.text) element.textContent = options.text;
				if (options.cls) element.className = options.cls;
				if (options.attr) {
					Object.entries(options.attr).forEach(([key, value]) => {
						(element as any)[key] = value;
					});
				}
				return element;
			}),
			querySelector: jest.fn(),
			querySelectorAll: jest.fn(),
			innerHTML: '',
			focus: jest.fn()
		} as any;
		modal.onOpen();
	});

		test('should create modal content with all sections', () => {
			const content = modal.contentEl.innerHTML;
			
			expect(content).toContain('Summarise Notes');
			expect(content).toContain('Date Range (Optional)');
			expect(content).toContain('Folder (Optional)');
			expect(content).toContain('Insight Style');
			expect(content).toContain('Quick Date Presets');
		});

		test('should set default date values', () => {
			const startDateInput = modal.contentEl.querySelector('input[type="date"]') as HTMLInputElement;
			const endDateInput = modal.contentEl.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
			
			expect(startDateInput.value).toBe('2025-01-01');
			expect(endDateInput.value).toBe('2025-01-31');
		});

		test('should set default insight style', () => {
			const insightStyleDropdown = modal.contentEl.querySelector('select') as HTMLSelectElement;
			expect(insightStyleDropdown.value).toBe('structured');
		});
	});

	describe('date preset buttons', () => {
		beforeEach(() => {
			modal.contentEl = document.createElement('div');
			modal.onOpen();
		});

		test('should update dates when preset buttons are clicked', () => {
			const presetButtons = modal.contentEl.querySelectorAll('button');
			const last7DaysButton = Array.from(presetButtons).find(btn => btn.textContent === 'Last 7 days');
			
			if (last7DaysButton) {
				last7DaysButton.click();
				
				const startDateInput = modal.contentEl.querySelector('input[type="date"]') as HTMLInputElement;
				const endDateInput = modal.contentEl.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
				
				// Should be approximately 7 days ago
				const startDate = new Date(startDateInput.value);
				const endDate = new Date(endDateInput.value);
				const today = new Date();
				
				expect(endDate.toDateString()).toBe(today.toDateString());
				expect(startDate.getTime()).toBeLessThan(endDate.getTime());
			}
		});
	});

	describe('validation', () => {
		beforeEach(() => {
			modal.contentEl = document.createElement('div');
			modal.onOpen();
		});

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
		beforeEach(() => {
			modal.contentEl = document.createElement('div');
			modal.onOpen();
		});

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
		beforeEach(() => {
			modal.contentEl = document.createElement('div');
			modal.onOpen();
		});

		test('should show correct info for date range only', () => {
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			modal['selectedFolder'] = '';
			
			modal['updateInfo']();
			
			const infoEl = modal.contentEl.querySelector('.mod-info');
			expect(infoEl?.textContent).toContain('date range: 2025-01-01 to 2025-01-31');
		});

		test('should show correct info for folder only', () => {
			modal['startDate'] = '';
			modal['endDate'] = '';
			modal['selectedFolder'] = 'folder1';
			
			modal['updateInfo']();
			
			const infoEl = modal.contentEl.querySelector('.mod-info');
			expect(infoEl?.textContent).toContain('folder: folder1');
		});

		test('should show correct info for both filters', () => {
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			modal['selectedFolder'] = 'folder1';
			
			modal['updateInfo']();
			
			const infoEl = modal.contentEl.querySelector('.mod-info');
			expect(infoEl?.textContent).toContain('date range: 2025-01-01 to 2025-01-31');
			expect(infoEl?.textContent).toContain('folder: folder1');
		});

		test('should show correct info for no filters', () => {
			modal['startDate'] = '';
			modal['endDate'] = '';
			modal['selectedFolder'] = '';
			
			modal['updateInfo']();
			
			const infoEl = modal.contentEl.querySelector('.mod-info');
			expect(infoEl?.textContent).toContain('No filters selected - will include all notes in the vault');
		});
	});

	describe('onClose', () => {
		test('should clear content on close', () => {
			modal.contentEl = document.createElement('div');
			modal.contentEl.innerHTML = '<div>Some content</div>';
			
			modal.onClose();
			
			expect(modal.contentEl.innerHTML).toBe('');
		});
	});
}); 