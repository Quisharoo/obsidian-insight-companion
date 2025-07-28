import { App, TFile } from 'obsidian';
import { NoteFilterService, FilteredNote, NoteFilterResult } from '../../src/insight-companion/note-filter';
import { DateRange } from '../../src/insight-companion/date-picker-modal';

// Mock TFile for testing
class MockTFile implements Partial<TFile> {
	path: string;
	stat: { ctime: number; mtime: number; size: number };
	
	constructor(path: string, ctime: number, mtime: number) {
		this.path = path;
		this.stat = { ctime, mtime, size: 1000 };
	}
}

describe('NoteFilterService Tests', () => {
	let app: App;
	let noteFilterService: NoteFilterService;
	let mockFiles: MockTFile[];

	beforeEach(() => {
		app = new App();
		noteFilterService = new NoteFilterService(app);

		// Create mock files with different timestamps
		const now = Date.now();
		const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
		const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
		const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

		mockFiles = [
			new MockTFile('note1.md', now, now), // Created and modified today
			new MockTFile('note2.md', oneWeekAgo, now), // Created a week ago, modified today
			new MockTFile('note3.md', twoWeeksAgo, twoWeeksAgo), // Created and modified two weeks ago
			new MockTFile('note4.md', oneMonthAgo, oneWeekAgo), // Created a month ago, modified a week ago
		];

		// Mock the vault methods
		app.vault = {
			getMarkdownFiles: jest.fn().mockReturnValue(mockFiles),
			read: jest.fn().mockImplementation((file: MockTFile) => 
				Promise.resolve(`Content of ${file.path}`)
			)
		} as any;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('filterNotesByDateRange', () => {
		it('should filter notes within date range by creation date', async () => {
			const today = new Date();
			const yesterday = new Date(today);
			yesterday.setDate(today.getDate() - 1);

			const dateRange: DateRange = {
				startDate: yesterday.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0]
			};

			const result: NoteFilterResult = await noteFilterService.filterNotesByDateRange(dateRange);

			// Should include note1 (created today) and note2 (modified today)
			expect(result.totalCount).toBe(2);
			expect(result.notes).toHaveLength(2);
			expect(result.notes[0].file.path).toBe('note1.md');
			expect(result.notes[1].file.path).toBe('note2.md');
		});

		it('should filter notes within date range by modification date', async () => {
			const today = new Date();
			const oneWeekAgo = new Date(today);
			oneWeekAgo.setDate(today.getDate() - 7);

			const dateRange: DateRange = {
				startDate: oneWeekAgo.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0]
			};

			const result: NoteFilterResult = await noteFilterService.filterNotesByDateRange(dateRange);

			// Should include note1, note2, and note4 (all modified within the last week or today)
			expect(result.totalCount).toBe(3);
			expect(result.notes).toHaveLength(3);
		});

		it('should return empty result when no notes match date range', async () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 10);
			const futureDateEnd = new Date();
			futureDateEnd.setDate(futureDateEnd.getDate() + 20);

			const dateRange: DateRange = {
				startDate: futureDate.toISOString().split('T')[0],
				endDate: futureDateEnd.toISOString().split('T')[0]
			};

			const result: NoteFilterResult = await noteFilterService.filterNotesByDateRange(dateRange);

			expect(result.totalCount).toBe(0);
			expect(result.notes).toHaveLength(0);
		});

		it('should include note content in filtered results', async () => {
			const today = new Date();
			const dateRange: DateRange = {
				startDate: today.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0]
			};

			const result: NoteFilterResult = await noteFilterService.filterNotesByDateRange(dateRange);

			expect(result.notes.length).toBeGreaterThan(0);
			expect(result.notes[0].content).toBe('Content of note1.md');
			expect(result.notes[0].createdTime).toBeDefined();
			expect(result.notes[0].modifiedTime).toBeDefined();
		});

		it('should handle file read errors gracefully', async () => {
			// Mock vault.read to throw an error for one file
			app.vault.read = jest.fn().mockImplementation((file: MockTFile) => {
				if (file.path === 'note1.md') {
					throw new Error('Failed to read file');
				}
				return Promise.resolve(`Content of ${file.path}`);
			});

			const today = new Date();
			const dateRange: DateRange = {
				startDate: today.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0]
			};

			const result: NoteFilterResult = await noteFilterService.filterNotesByDateRange(dateRange);

			// Should still return note2 even though note1 failed to read
			expect(result.totalCount).toBe(1);
			expect(result.notes[0].file.path).toBe('note2.md');
		});

		it('should set time boundaries correctly for full day inclusion', async () => {
			const today = new Date();
			const dateRange: DateRange = {
				startDate: today.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0]
			};

			// Create a spy to check the internal date range logic
			const isNoteInDateRangeSpy = jest.spyOn(noteFilterService as any, 'isNoteInDateRange');

			await noteFilterService.filterNotesByDateRange(dateRange);

			// Verify the method was called
			expect(isNoteInDateRangeSpy).toHaveBeenCalled();
		});
	});

	describe('getNotesMetadata', () => {
		it('should return count and files without reading content', async () => {
			const today = new Date();
			const dateRange: DateRange = {
				startDate: today.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0]
			};

			const metadata = await noteFilterService.getNotesMetadata(dateRange);

			expect(metadata.count).toBe(2); // note1 and note2
			expect(metadata.files).toHaveLength(2);
			expect(metadata.files[0].path).toBe('note1.md');
			expect(metadata.files[1].path).toBe('note2.md');

			// Verify vault.read was not called
			expect(app.vault.read).not.toHaveBeenCalled();
		});

		it('should return zero count when no notes match', async () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 10);
			const futureDateEnd = new Date();
			futureDateEnd.setDate(futureDateEnd.getDate() + 20);

			const dateRange: DateRange = {
				startDate: futureDate.toISOString().split('T')[0],
				endDate: futureDateEnd.toISOString().split('T')[0]
			};

			const metadata = await noteFilterService.getNotesMetadata(dateRange);

			expect(metadata.count).toBe(0);
			expect(metadata.files).toHaveLength(0);
		});
	});

	describe('isNoteInDateRange (private method testing)', () => {
		it('should include note if creation date is in range', () => {
			const today = new Date();
			const yesterday = new Date(today);
			yesterday.setDate(today.getDate() - 1);

			const file = new MockTFile('test.md', today.getTime(), yesterday.getTime());
			
			// Access private method for testing
			const isInRange = (noteFilterService as any).isNoteInDateRange(
				file, 
				yesterday, 
				today
			);

			expect(isInRange).toBe(true);
		});

		it('should include note if modification date is in range', () => {
			const today = new Date();
			const yesterday = new Date(today);
			yesterday.setDate(today.getDate() - 1);
			const oneWeekAgo = new Date(today);
			oneWeekAgo.setDate(today.getDate() - 7);

			const file = new MockTFile('test.md', oneWeekAgo.getTime(), today.getTime());
			
			const isInRange = (noteFilterService as any).isNoteInDateRange(
				file, 
				yesterday, 
				today
			);

			expect(isInRange).toBe(true);
		});

		it('should exclude note if neither creation nor modification date is in range', () => {
			const today = new Date();
			const yesterday = new Date(today);
			yesterday.setDate(today.getDate() - 1);
			const oneWeekAgo = new Date(today);
			oneWeekAgo.setDate(today.getDate() - 7);

			const file = new MockTFile('test.md', oneWeekAgo.getTime(), oneWeekAgo.getTime());
			
			const isInRange = (noteFilterService as any).isNoteInDateRange(
				file, 
				yesterday, 
				today
			);

			expect(isInRange).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('should handle empty vault', async () => {
			app.vault.getMarkdownFiles = jest.fn().mockReturnValue([]);

			const today = new Date();
			const dateRange: DateRange = {
				startDate: today.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0]
			};

			const result = await noteFilterService.filterNotesByDateRange(dateRange);

			expect(result.totalCount).toBe(0);
			expect(result.notes).toHaveLength(0);
		});

		it('should handle single-day date range', async () => {
			const today = new Date();
			const dateRange: DateRange = {
				startDate: today.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0]
			};

			const result = await noteFilterService.filterNotesByDateRange(dateRange);

			expect(result.dateRange).toEqual(dateRange);
			expect(result.totalCount).toBeGreaterThanOrEqual(0);
		});
	});
}); 