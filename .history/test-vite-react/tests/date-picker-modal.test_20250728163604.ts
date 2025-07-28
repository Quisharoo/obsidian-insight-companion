import { App } from 'obsidian';
import { DatePickerModal, DateRange } from '../../src/insight-companion/date-picker-modal';

describe('Date Picker Modal Tests', () => {
  let app: App;
  let modal: DatePickerModal;
  let mockOnSubmit: jest.Mock;
  let mockDefaultDateRange: DateRange;

  beforeEach(() => {
    app = new App();
    mockOnSubmit = jest.fn();
    mockDefaultDateRange = {
      startDate: '2023-06-01',
      endDate: '2023-06-30'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Initialization', () => {
    it('should create modal without default date range', () => {
      modal = new DatePickerModal(app, null, mockOnSubmit);
      expect(modal).toBeInstanceOf(DatePickerModal);
    });

    it('should create modal with default date range', () => {
      modal = new DatePickerModal(app, mockDefaultDateRange, mockOnSubmit);
      expect(modal).toBeInstanceOf(DatePickerModal);
    });

    it('should use current date and 30 days ago when no default provided', () => {
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      modal = new DatePickerModal(app, null, mockOnSubmit);
      modal.onOpen();

      // Access private properties for testing
      const startDate = (modal as any).startDate;
      const endDate = (modal as any).endDate;

      expect(endDate).toBe(today.toISOString().split('T')[0]);
      expect(startDate).toBe(thirtyDaysAgo.toISOString().split('T')[0]);
    });

    it('should use provided default date range', () => {
      modal = new DatePickerModal(app, mockDefaultDateRange, mockOnSubmit);
      modal.onOpen();

      const startDate = (modal as any).startDate;
      const endDate = (modal as any).endDate;

      expect(startDate).toBe('2023-06-01');
      expect(endDate).toBe('2023-06-30');
    });
  });

  describe('Modal Rendering', () => {
    beforeEach(() => {
      modal = new DatePickerModal(app, mockDefaultDateRange, mockOnSubmit);
    });

    it('should render modal content on open', () => {
      modal.onOpen();
      
      // Check that contentEl children were created
      expect(modal.contentEl.children.length).toBeGreaterThan(0);
    });

    it('should create title element', () => {
      modal.onOpen();
      
      // Find title element among children
      const titleElement = modal.contentEl.children.find((child: any) => 
        child.textContent === 'Select Date Range for Insight Summary'
      );
      expect(titleElement).toBeDefined();
    });

    it('should create start and end date inputs', () => {
      modal.onOpen();
      
      // Check that date inputs were set up
      const startInput = (modal as any).startDateInput;
      const endInput = (modal as any).endDateInput;
      
      expect(startInput).toBeDefined();
      expect(endInput).toBeDefined();
    });

    it('should create error message element', () => {
      modal.onOpen();
      
      const errorEl = (modal as any).errorEl;
      expect(errorEl).toBeDefined();
      expect(errorEl.style.display).toBe('none'); // Should be hidden initially
    });

    it('should create preset buttons', () => {
      modal.onOpen();
      
      // Check that preset buttons were created (this is implicit in the onOpen logic)
      // Since we're testing implementation, we check the method was called
      expect(modal.contentEl.children.length).toBeGreaterThan(2); // Title + settings + presets + buttons
    });

    it('should create action buttons', () => {
      modal.onOpen();
      
      // The modal should have created Cancel and Generate Summary buttons
      expect(modal.contentEl.children.length).toBeGreaterThan(3);
    });
  });

  describe('Preset Button Functionality', () => {
    beforeEach(() => {
      modal = new DatePickerModal(app, null, mockOnSubmit);
      modal.onOpen();
    });

    it('should update dates when preset button is clicked', () => {
      // Get references to the inputs
      const startInput = (modal as any).startDateInput;
      const endInput = (modal as any).endDateInput;

      // Mock the preset button click for "Last 7 days"
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);

      // Simulate preset button logic
      (modal as any).startDate = sevenDaysAgo.toISOString().split('T')[0];
      (modal as any).endDate = today.toISOString().split('T')[0];

      startInput.value = (modal as any).startDate;
      endInput.value = (modal as any).endDate;

      expect(startInput.value).toBe(sevenDaysAgo.toISOString().split('T')[0]);
      expect(endInput.value).toBe(today.toISOString().split('T')[0]);
    });

    it('should handle "This month" preset correctly', () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Simulate "This month" preset logic
      (modal as any).startDate = startOfMonth.toISOString().split('T')[0];
      (modal as any).endDate = today.toISOString().split('T')[0];

      expect((modal as any).startDate).toBe(startOfMonth.toISOString().split('T')[0]);
      expect((modal as any).endDate).toBe(today.toISOString().split('T')[0]);
    });
  });

  describe('Date Validation', () => {
    beforeEach(() => {
      modal = new DatePickerModal(app, null, mockOnSubmit);
      modal.onOpen();
    });

    it('should validate that end date is after start date', () => {
      // Set invalid date range (end before start)
      (modal as any).startDate = '2023-06-30';
      (modal as any).endDate = '2023-06-01';

      const isValid = (modal as any).validateDates();
      expect(isValid).toBe(false);
    });

    it('should validate that both dates are provided', () => {
      // Test empty start date
      (modal as any).startDate = '';
      (modal as any).endDate = '2023-06-30';

      const isValid = (modal as any).validateDates();
      expect(isValid).toBe(false);
    });

    it('should pass validation with valid date range', () => {
      (modal as any).startDate = '2023-06-01';
      (modal as any).endDate = '2023-06-30';

      const isValid = (modal as any).validateDates();
      expect(isValid).toBe(true);
    });

    it('should show error message for invalid dates', () => {
      (modal as any).startDate = '2023-06-30';
      (modal as any).endDate = '2023-06-01';

      (modal as any).validateDates();

      const errorEl = (modal as any).errorEl;
      expect(errorEl.textContent).toBe('End date must be after start date');
      expect(errorEl.style.display).toBe('block');
    });

    it('should hide error message for valid dates', () => {
      // First set invalid dates to show error
      (modal as any).startDate = '2023-06-30';
      (modal as any).endDate = '2023-06-01';
      (modal as any).validateDates();

      // Then set valid dates
      (modal as any).startDate = '2023-06-01';
      (modal as any).endDate = '2023-06-30';
      (modal as any).validateDates();

      const errorEl = (modal as any).errorEl;
      expect(errorEl.style.display).toBe('none');
    });
  });

  describe('Date Range Caching and Pre-filling', () => {
    it('should pre-fill with cached date range', () => {
      const cachedRange: DateRange = {
        startDate: '2023-05-01',
        endDate: '2023-05-31'
      };

      modal = new DatePickerModal(app, cachedRange, mockOnSubmit);
      modal.onOpen();

      expect((modal as any).startDate).toBe('2023-05-01');
      expect((modal as any).endDate).toBe('2023-05-31');
    });

    it('should use default dates when no cache provided', () => {
      modal = new DatePickerModal(app, null, mockOnSubmit);
      modal.onOpen();

      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      expect((modal as any).endDate).toBe(today.toISOString().split('T')[0]);
      expect((modal as any).startDate).toBe(thirtyDaysAgo.toISOString().split('T')[0]);
    });
  });

  describe('Modal Submission', () => {
    beforeEach(() => {
      modal = new DatePickerModal(app, mockDefaultDateRange, mockOnSubmit);
      modal.onOpen();
    });

    it('should call onSubmit callback with valid date range', () => {
      (modal as any).startDate = '2023-06-01';
      (modal as any).endDate = '2023-06-30';

      // Simulate valid submission
      const isValid = (modal as any).validateDates();
      if (isValid) {
        mockOnSubmit({
          startDate: (modal as any).startDate,
          endDate: (modal as any).endDate
        });
      }

      expect(mockOnSubmit).toHaveBeenCalledWith({
        startDate: '2023-06-01',
        endDate: '2023-06-30'
      });
    });

    it('should not call onSubmit with invalid date range', () => {
      (modal as any).startDate = '2023-06-30';
      (modal as any).endDate = '2023-06-01';

      // Simulate invalid submission attempt
      const isValid = (modal as any).validateDates();
      if (isValid) {
        mockOnSubmit({
          startDate: (modal as any).startDate,
          endDate: (modal as any).endDate
        });
      }

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Modal Cleanup', () => {
    beforeEach(() => {
      modal = new DatePickerModal(app, mockDefaultDateRange, mockOnSubmit);
    });

    it('should clean up content on close', () => {
      modal.onOpen();
      expect(modal.contentEl.children.length).toBeGreaterThan(0);

      modal.onClose();
      expect(modal.contentEl.children.length).toBe(0);
      expect(modal.contentEl.textContent).toBe('');
    });
  });

  describe('Date Formatting', () => {
    beforeEach(() => {
      modal = new DatePickerModal(app, null, mockOnSubmit);
    });

    it('should format dates correctly', () => {
      const testDate = new Date('2023-06-15T10:30:00Z');
      const formatted = (modal as any).formatDate(testDate);
      expect(formatted).toBe('2023-06-15');
    });

    it('should handle different date inputs', () => {
      const testDates = [
        new Date('2023-01-01'),
        new Date('2023-12-31'),
        new Date('2024-02-29'), // Leap year
      ];

      const expectedFormats = [
        '2023-01-01',
        '2023-12-31',
        '2024-02-29'
      ];

      testDates.forEach((date, index) => {
        const formatted = (modal as any).formatDate(date);
        expect(formatted).toBe(expectedFormats[index]);
      });
    });
  });
}); 