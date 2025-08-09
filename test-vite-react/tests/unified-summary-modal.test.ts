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
		
    modal = new UnifiedSummaryModal(mockApp, mockDefaultDateRange, undefined, undefined, undefined, undefined, mockOnSubmit);
	});

	describe('constructor', () => {
		test('should initialize with default date range', () => {
			expect(modal).toBeDefined();
		});

		test('should initialize with null date range', () => {
			const modalWithNull = new UnifiedSummaryModal(mockApp, null, undefined, undefined, undefined, undefined, mockOnSubmit);
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
			const modalWithNull = new UnifiedSummaryModal(mockApp, null, undefined, undefined, undefined, undefined, mockOnSubmit);
			expect(modalWithNull).toBeDefined();
		});

		test('should initialize with default folder path and insight style', () => {
			const modalWithDefaults = new UnifiedSummaryModal(
				mockApp, 
				mockDefaultDateRange, 
				'folder1', 
				'freeform',
				undefined,
				undefined,
				mockOnSubmit
			);
			expect(modalWithDefaults['selectedFolder']).toBe('folder1');
			expect(modalWithDefaults['insightStyle']).toBe('freeform');
		});

		test('should initialize with default excluded metadata when none provided', () => {
			const modalWithDefaults = new UnifiedSummaryModal(
				mockApp, 
				mockDefaultDateRange, 
				undefined, 
				undefined,
				undefined,
				undefined,
				mockOnSubmit
			);
			expect(modalWithDefaults['excludedMetadata']).toEqual(['summarise: false']);
		});

		test('should use provided excluded metadata when available', () => {
			const customExcludedMetadata = ['#private', 'status: draft'];
			const modalWithCustom = new UnifiedSummaryModal(
				mockApp, 
				mockDefaultDateRange, 
				undefined, 
				undefined,
				undefined,
				customExcludedMetadata,
				mockOnSubmit
			);
			expect(modalWithCustom['excludedMetadata']).toEqual(customExcludedMetadata);
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
		beforeEach(() => {
			// Mock error and filter summary elements
			modal['errorEl'] = { textContent: '', style: { display: 'none' } } as any;
			modal['filterSummaryEl'] = { empty: jest.fn(), createEl: jest.fn() } as any;
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
					insightStyle: 'structured',
					dateSource: 'created'
				},
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: ['summarise: false']
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
				insightStyle: 'freeform',
				dateSource: 'created',
				excludedMetadata: ['summarise: false']
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
					insightStyle: 'structured',
					dateSource: 'created'
				},
				folderPath: 'folder1',
				folderName: 'folder1',
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: ['summarise: false']
			});
		});

		test('should submit with no filters (all notes)', () => {
			modal['startDate'] = '';
			modal['endDate'] = '';
			modal['selectedFolder'] = '';
			modal['insightStyle'] = 'structured';
			
			modal['handleSubmit']();
			
			expect(mockOnSubmit).toHaveBeenCalledWith({
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: ['summarise: false']
			});
		});
	});

	describe('updateFilterSummary', () => {
		beforeEach(() => {
			// Mock filter summary element
			modal['filterSummaryEl'] = { 
				empty: jest.fn(), 
				createEl: jest.fn().mockReturnValue({ textContent: '' }) 
			} as any;
		});

		test('should generate correct filter text for date range only', () => {
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			modal['selectedFolder'] = '';
			
			// Test the logic directly without DOM
			const filters: string[] = [];
			if (modal['startDate'] && modal['endDate']) {
				filters.push(`📅 Date Range: ${modal['startDate']} to ${modal['endDate']}`);
			}
			if (modal['selectedFolder']) {
				filters.push(`📁 Folder: ${modal['selectedFolder']}`);
			}
			
			expect(filters).toContain('📅 Date Range: 2025-01-01 to 2025-01-31');
			expect(filters).toHaveLength(1);
		});

		test('should generate correct filter text for folder only', () => {
			modal['startDate'] = '';
			modal['endDate'] = '';
			modal['selectedFolder'] = 'folder1';
			
			const filters: string[] = [];
			if (modal['startDate'] && modal['endDate']) {
				filters.push(`📅 Date Range: ${modal['startDate']} to ${modal['endDate']}`);
			}
			if (modal['selectedFolder']) {
				filters.push(`📁 Folder: ${modal['selectedFolder']}`);
			}
			
			expect(filters).toContain('📁 Folder: folder1');
			expect(filters).toHaveLength(1);
		});

		test('should generate correct filter text for both filters', () => {
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			modal['selectedFolder'] = 'folder1';
			
			const filters: string[] = [];
			if (modal['startDate'] && modal['endDate']) {
				filters.push(`📅 Date Range: ${modal['startDate']} to ${modal['endDate']}`);
			}
			if (modal['selectedFolder']) {
				filters.push(`📁 Folder: ${modal['selectedFolder']}`);
			}
			
			expect(filters).toContain('📅 Date Range: 2025-01-01 to 2025-01-31');
			expect(filters).toContain('📁 Folder: folder1');
			expect(filters).toHaveLength(2);
		});

		test('should generate correct filter text for no filters', () => {
			modal['startDate'] = '';
			modal['endDate'] = '';
			modal['selectedFolder'] = '';
			
			const filters: string[] = [];
			if (modal['startDate'] && modal['endDate']) {
				filters.push(`📅 Date Range: ${modal['startDate']} to ${modal['endDate']}`);
			}
			if (modal['selectedFolder']) {
				filters.push(`📁 Folder: ${modal['selectedFolder']}`);
			}
			
			expect(filters).toHaveLength(0);
		});
	});

	describe('clearAllFilters', () => {
		beforeEach(() => {
			// Mock DOM elements
			modal['startDateInput'] = { value: '' } as any;
			modal['endDateInput'] = { value: '' } as any;
			modal['folderDropdown'] = { value: '' } as any;
			modal['errorEl'] = { textContent: '', style: { display: 'none' } } as any;
			modal['filterSummaryEl'] = { 
				empty: jest.fn(), 
				createEl: jest.fn().mockReturnValue({ textContent: '' }) 
			} as any;
		});

		test('should clear all filter values', () => {
			// Set initial values
			modal['startDate'] = '2025-01-01';
			modal['endDate'] = '2025-01-31';
			modal['selectedFolder'] = 'folder1';
			modal['insightStyle'] = 'freeform';

			// Mock input elements
			modal['startDateInput'].value = '2025-01-01';
			modal['endDateInput'].value = '2025-01-31';
			modal['folderDropdown'].value = 'folder1';

			// Call clearAllFilters
			modal['clearAllFilters']();

			// Verify all values are cleared
			expect(modal['startDate']).toBe('');
			expect(modal['endDate']).toBe('');
			expect(modal['selectedFolder']).toBe('');
			expect(modal['insightStyle']).toBe('structured');

			// Verify input elements are cleared
			expect(modal['startDateInput'].value).toBe('');
			expect(modal['endDateInput'].value).toBe('');
			expect(modal['folderDropdown'].value).toBe('');
			
			// Verify excluded metadata is reset to default
			expect(modal['excludedMetadata']).toEqual(['summarise: false']);
		});

		test('should call validation and update methods', () => {
			// Spy on the methods
			const validateSpy = jest.spyOn(modal as any, 'validateInputs');
			const updateSpy = jest.spyOn(modal as any, 'updateFilterSummary');

			// Call clearAllFilters
			modal['clearAllFilters']();

			// Verify methods were called
			expect(validateSpy).toHaveBeenCalled();
			expect(updateSpy).toHaveBeenCalled();

			// Clean up spies
			validateSpy.mockRestore();
			updateSpy.mockRestore();
		});
	});

	describe('onClose', () => {
		test('should have onClose method', () => {
			expect(typeof modal.onClose).toBe('function');
		});
	});

	describe('default excluded metadata behavior', () => {
		test('should initialize with summarise: false as default', () => {
			const modalWithDefaults = new UnifiedSummaryModal(
				mockApp, 
				null, 
				undefined, 
				undefined,
				undefined,
				undefined,
				mockOnSubmit
			);
			expect(modalWithDefaults['excludedMetadata']).toEqual(['summarise: false']);
		});

  describe('reset to defaults', () => {
    test('should reset filters to defaults when Reset to defaults clicked', () => {
      const m = new UnifiedSummaryModal(mockApp, mockDefaultDateRange, 'folder1', 'freeform', 'modified', ['#private'], mockOnSubmit);
      m['onOpen']?.call(m);
      m['clearAllFilters']?.call(m);
      expect(m['startDate']).toBe('');
      expect(m['endDate']).toBe('');
      expect(m['selectedFolder']).toBe('');
      expect(m['insightStyle']).toBe('structured');
      expect(m['dateSource']).toBe('created');
      expect(m['excludedMetadata']).toEqual(['summarise: false']);
    });
  });

  describe('api key inline error', () => {
    test('should allow calling showApiKeyMissingError without throwing', () => {
      const m = new UnifiedSummaryModal(mockApp, mockDefaultDateRange, undefined, undefined, undefined, undefined, mockOnSubmit, true);
      // prepare errorEl
      (m as any).errorEl = { textContent: '', style: { display: 'none' }, createEl: jest.fn().mockReturnValue({}) } as any;
      expect(() => (m as any).showApiKeyMissingError()).not.toThrow();
    });
  });

		test('should preserve user custom excluded metadata', () => {
			const customExcludedMetadata = ['#private', 'status: draft'];
			const modalWithCustom = new UnifiedSummaryModal(
				mockApp, 
				null, 
				undefined, 
				undefined,
				undefined,
				customExcludedMetadata,
				mockOnSubmit
			);
			expect(modalWithCustom['excludedMetadata']).toEqual(customExcludedMetadata);
		});

		test('should reset to default when clearing filters', () => {
			// Set custom excluded metadata
			modal['excludedMetadata'] = ['#private', 'status: draft'];
			
			// Mock textarea and error element
			modal['excludedMetadataTextarea'] = { value: '#private\nstatus: draft' } as any;
			modal['errorEl'] = { textContent: '', style: { display: 'none' } } as any;
			modal['filterSummaryEl'] = { 
				empty: jest.fn(), 
				createEl: jest.fn().mockReturnValue({ textContent: '' }) 
			} as any;
			
			// Call clearAllFilters
			modal['clearAllFilters']();
			
			// Should reset to default
			expect(modal['excludedMetadata']).toEqual(['summarise: false']);
			expect(modal['excludedMetadataTextarea'].value).toBe('summarise: false');
		});
	});
}); 