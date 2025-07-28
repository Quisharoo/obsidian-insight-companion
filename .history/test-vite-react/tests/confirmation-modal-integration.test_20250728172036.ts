import { App, TFile } from 'obsidian';
import InsightCompanionPlugin from '../../src/insight-companion/main';
import { DateRange } from '../../src/insight-companion/date-picker-modal';
import { ConfirmationModal } from '../../src/insight-companion/confirmation-modal';

// Mock TFile for testing
class MockTFile implements Partial<TFile> {
	path: string;
	stat: { ctime: number; mtime: number; size: number };
	
	constructor(path: string, ctime: number, mtime: number) {
		this.path = path;
		this.stat = { ctime, mtime, size: 1000 };
	}
}

describe('Confirmation Modal Integration Tests', () => {
	let app: App;
	let plugin: InsightCompanionPlugin;
	let mockFiles: MockTFile[];

	beforeEach(async () => {
		app = new App();
		plugin = new InsightCompanionPlugin(app, {} as any);

		// Create mock files with realistic content and timestamps
		const now = Date.now();
		const oneDay = 24 * 60 * 60 * 1000;
		const oneWeek = 7 * oneDay;

		mockFiles = [
			new MockTFile('daily-note-today.md', now, now),
			new MockTFile('project-notes.md', now - oneDay, now),
			new MockTFile('meeting-notes.md', now - oneWeek, now - oneWeek),
		];

		// Mock vault methods
		app.vault = {
			getMarkdownFiles: jest.fn().mockReturnValue(mockFiles),
			read: jest.fn().mockImplementation((file: MockTFile) => {
				return Promise.resolve(`# ${file.path.replace('.md', '')}

This is realistic content for ${file.path}. It contains various markdown elements:

## Section
- List item 1
- List item 2

**Bold text** and *italic text*.

Some longer content to make the token estimation more realistic.
				`.trim());
			})
		} as any;

		// Mock plugin data loading/saving
		plugin.loadData = jest.fn().mockResolvedValue({});
		plugin.saveData = jest.fn().mockResolvedValue(undefined);

		await plugin.onload();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Modal Integration in Workflow', () => {
		it('should execute note filtering workflow', async () => {
			const today = new Date();
			const yesterday = new Date(today);
			yesterday.setDate(today.getDate() - 1);

			const dateRange: DateRange = {
				startDate: yesterday.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0]
			};

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

			// Call handleDateSelection
			await (plugin as any).handleDateSelection(dateRange);

			// Verify that the workflow executed correctly
			expect(app.vault.getMarkdownFiles).toHaveBeenCalled();
			expect(app.vault.read).toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith('Date range selected:', dateRange);
			expect(consoleSpy).toHaveBeenCalledWith('Filtering notes by date range...');
			expect(consoleSpy).toHaveBeenCalledWith('Estimating token count...');

			consoleSpy.mockRestore();
		});

		it('should process notes and generate estimates', async () => {
			const dateRange: DateRange = {
				startDate: '2023-06-01',
				endDate: '2023-06-30'
			};

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

			await (plugin as any).handleDateSelection(dateRange);

			// Verify that note processing occurred
			expect(app.vault.getMarkdownFiles).toHaveBeenCalled();
			expect(app.vault.read).toHaveBeenCalled();
			
			// Verify that settings were saved
			expect(plugin.saveData).toHaveBeenCalled();
			expect(plugin.settings.lastDateRange).toEqual(dateRange);

			consoleSpy.mockRestore();
		});

		it('should handle complete workflow integration', async () => {
			const dateRange: DateRange = {
				startDate: '2023-06-01',
				endDate: '2023-06-30'
			};

			await (plugin as any).handleDateSelection(dateRange);

			// Verify that the complete workflow executed
			expect(app.vault.getMarkdownFiles).toHaveBeenCalled();
			expect(plugin.saveData).toHaveBeenCalled();
		});
	});

	describe('Error Handling in Integration', () => {
		it('should not show modal when no notes are found', async () => {
			// Mock empty vault
			app.vault.getMarkdownFiles = jest.fn().mockReturnValue([]);

			const dateRange: DateRange = {
				startDate: '2023-06-01',
				endDate: '2023-06-30'
			};

			const modalOpenSpy = jest.spyOn(ConfirmationModal.prototype, 'open').mockImplementation();
			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

			await (plugin as any).handleDateSelection(dateRange);

			// Verify modal was not opened
			expect(modalOpenSpy).not.toHaveBeenCalled();

			// Verify appropriate message was logged
			expect(consoleSpy).toHaveBeenCalledWith('No notes found in the selected date range');

			modalOpenSpy.mockRestore();
			consoleSpy.mockRestore();
		});

		it('should not show modal when filtering fails', async () => {
			// Mock vault to throw error
			app.vault.getMarkdownFiles = jest.fn().mockImplementation(() => {
				throw new Error('Vault access failed');
			});

			const dateRange: DateRange = {
				startDate: '2023-06-01',
				endDate: '2023-06-30'
			};

			const modalOpenSpy = jest.spyOn(ConfirmationModal.prototype, 'open').mockImplementation();
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

			await (plugin as any).handleDateSelection(dateRange);

			// Verify modal was not opened
			expect(modalOpenSpy).not.toHaveBeenCalled();

			// Verify error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing date selection:', expect.any(Error));

			modalOpenSpy.mockRestore();
			consoleErrorSpy.mockRestore();
		});
	});

	describe('Token Limit Integration', () => {
		it('should pass token limit warnings to modal for large content', async () => {
			// Mock large content that exceeds limits
			app.vault.read = jest.fn().mockImplementation(() => {
				const largeContent = 'A'.repeat(50000); // 50k characters = ~12.5k tokens
				return Promise.resolve(largeContent);
			});

			const dateRange: DateRange = {
				startDate: '2023-01-01',
				endDate: '2023-12-31'
			};

			let capturedConfirmationData: any = null;
			const modalConstructorSpy = jest.spyOn(ConfirmationModal.prototype, 'constructor' as any)
				.mockImplementation(function(app, confirmationData, onConfirm, onCancel) {
					capturedConfirmationData = confirmationData;
				});

			const modalOpenSpy = jest.spyOn(ConfirmationModal.prototype, 'open').mockImplementation();

			await (plugin as any).handleDateSelection(dateRange);

			// Verify limit check data was passed correctly
			expect(capturedConfirmationData.limitCheck).toBeDefined();
			expect(capturedConfirmationData.limitCheck.withinGPT4Limit).toBe(false);
			expect(capturedConfirmationData.limitCheck.recommendations).toBeDefined();
			expect(capturedConfirmationData.limitCheck.recommendations.length).toBeGreaterThan(0);

			modalConstructorSpy.mockRestore();
			modalOpenSpy.mockRestore();
		});
	});

	describe('Settings Integration', () => {
		it('should preserve settings during the workflow', async () => {
			const dateRange: DateRange = {
				startDate: '2023-06-01',
				endDate: '2023-06-30'
			};

			const modalOpenSpy = jest.spyOn(ConfirmationModal.prototype, 'open').mockImplementation();

			await (plugin as any).handleDateSelection(dateRange);

			// Verify settings were saved
			expect(plugin.saveData).toHaveBeenCalled();
			expect(plugin.settings.lastDateRange).toEqual(dateRange);

			modalOpenSpy.mockRestore();
		});
	});

	describe('Complete Workflow Simulation', () => {
		it('should execute complete workflow from date selection to confirmation', async () => {
			const dateRange: DateRange = {
				startDate: '2023-06-01',
				endDate: '2023-06-30'
			};

			const modalOpenSpy = jest.spyOn(ConfirmationModal.prototype, 'open').mockImplementation();
			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

			// 1. User selects date range
			await (plugin as any).handleDateSelection(dateRange);

			// 2. Verify filtering occurred
			expect(app.vault.getMarkdownFiles).toHaveBeenCalled();
			expect(app.vault.read).toHaveBeenCalled();

			// 3. Verify logging of key steps
			expect(consoleSpy).toHaveBeenCalledWith('Date range selected:', dateRange);
			expect(consoleSpy).toHaveBeenCalledWith('Filtering notes by date range...');
			expect(consoleSpy).toHaveBeenCalledWith('Estimating token count...');

			// 4. Verify modal was opened
			expect(modalOpenSpy).toHaveBeenCalled();

			// 5. Verify settings were saved
			expect(plugin.saveData).toHaveBeenCalled();

			modalOpenSpy.mockRestore();
			consoleSpy.mockRestore();
		});
	});
}); 