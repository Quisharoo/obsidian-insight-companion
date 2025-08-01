import { NoteFilterService } from '../../src/insight-companion/note-filter';
import { DateRange } from '../../src/insight-companion/date-picker-modal';

// Mock Obsidian App and files
const mockFiles = [
	{ path: 'note1.md', stat: { ctime: new Date('2025-01-15').getTime(), mtime: new Date('2025-01-15').getTime() } },
	{ path: 'note2.md', stat: { ctime: new Date('2025-01-20').getTime(), mtime: new Date('2025-01-20').getTime() } },
	{ path: 'folder1/note3.md', stat: { ctime: new Date('2025-01-25').getTime(), mtime: new Date('2025-01-25').getTime() } },
	{ path: 'folder1/note4.md', stat: { ctime: new Date('2025-01-30').getTime(), mtime: new Date('2025-01-30').getTime() } },
	{ path: 'folder2/note5.md', stat: { ctime: new Date('2025-02-01').getTime(), mtime: new Date('2025-02-01').getTime() } },
	{ path: 'folder2/note6.md', stat: { ctime: new Date('2025-02-05').getTime(), mtime: new Date('2025-02-05').getTime() } }
];

const mockFolders = [
	{ 
		path: 'folder1', 
		children: [
			{ path: 'folder1/note3.md', stat: { ctime: new Date('2025-01-25').getTime(), mtime: new Date('2025-01-25').getTime() } },
			{ path: 'folder1/note4.md', stat: { ctime: new Date('2025-01-30').getTime(), mtime: new Date('2025-01-30').getTime() } }
		]
	},
	{ 
		path: 'folder2', 
		children: [
			{ path: 'folder2/note5.md', stat: { ctime: new Date('2025-02-01').getTime(), mtime: new Date('2025-02-01').getTime() } },
			{ path: 'folder2/note6.md', stat: { ctime: new Date('2025-02-05').getTime(), mtime: new Date('2025-02-05').getTime() } }
		]
	}
];

const mockApp = {
	vault: {
		getMarkdownFiles: jest.fn().mockReturnValue(mockFiles),
		getAbstractFileByPath: jest.fn((path: string) => {
			if (path === '') return null; // Root folder
			return mockFolders.find(folder => folder.path === path);
		}),
		read: jest.fn().mockImplementation((file) => {
			return Promise.resolve(`Content for ${file.path}`);
		})
	}
} as any;

describe('Unified Filtering', () => {
	let noteFilterService: NoteFilterService;

	beforeEach(() => {
		noteFilterService = new NoteFilterService(mockApp);
		jest.clearAllMocks();
	});

	describe('filterNotes - Date range only', () => {
		test('should filter notes by date range only', async () => {
			const dateRange: DateRange = {
				startDate: '2025-01-15',
				endDate: '2025-01-25',
				insightStyle: 'structured'
			};

			const result = await noteFilterService.filterNotes(dateRange, undefined, undefined, 'structured');

			expect(result.mode).toBe('date');
			expect(result.totalCount).toBe(3); // note1, note2, note3
			expect(result.dateRange).toEqual(dateRange);
			expect(result.folderPath).toBeUndefined();
			expect(result.filterMeta).toEqual({
				dateRange: { 
					start: expect.any(Date), 
					end: expect.any(Date) 
				},
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: []
			});
		});

		test('should handle empty date range results', async () => {
			const dateRange: DateRange = {
				startDate: '2025-03-01',
				endDate: '2025-03-31',
				insightStyle: 'structured'
			};

			const result = await noteFilterService.filterNotes(dateRange, undefined, undefined, 'structured');

			expect(result.mode).toBe('date');
			expect(result.totalCount).toBe(0);
			expect(result.filterMeta).toEqual({
				dateRange: { 
					start: expect.any(Date), 
					end: expect.any(Date) 
				},
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: []
			});
		});
	});

	describe('filterNotes - Folder only', () => {
		test('should filter notes by folder only', async () => {
			const result = await noteFilterService.filterNotes(undefined, 'folder1', 'Folder 1', 'freeform');

			expect(result.mode).toBe('folder');
			expect(result.totalCount).toBe(2); // note3, note4
			expect(result.folderPath).toBe('folder1');
			expect(result.folderName).toBe('Folder 1');
			expect(result.dateRange).toBeUndefined();
			expect(result.filterMeta).toEqual({
				folderPath: 'folder1',
				insightStyle: 'freeform',
				dateSource: 'created',
				excludedMetadata: []
			});
		});

		test('should handle root folder (all notes)', async () => {
			const result = await noteFilterService.filterNotes(undefined, '', 'Vault Root', 'structured');

			expect(result.mode).toBe('folder');
			expect(result.totalCount).toBe(6); // all notes
			expect(result.folderPath).toBe('');
			expect(result.folderName).toBe('Vault Root');
			expect(result.filterMeta).toEqual({
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: []
			});
		});

		test('should handle non-existent folder', async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValueOnce(undefined);

			const result = await noteFilterService.filterNotes(undefined, 'nonexistent', 'Non-existent', 'structured');

			expect(result.mode).toBe('folder');
			expect(result.totalCount).toBe(0);
			expect(result.filterMeta).toEqual({
				folderPath: 'nonexistent',
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: []
			});
		});
	});

	describe('filterNotes - Combined filters', () => {
		test('should filter notes by both date range and folder', async () => {
			const dateRange: DateRange = {
				startDate: '2025-01-20',
				endDate: '2025-01-31',
				insightStyle: 'structured'
			};

			const result = await noteFilterService.filterNotes(dateRange, 'folder1', 'Folder 1', 'structured');

			expect(result.mode).toBe('unified');
			expect(result.totalCount).toBe(2); // note3, note4 (in folder1 and date range)
			expect(result.dateRange).toEqual(dateRange);
			expect(result.folderPath).toBe('folder1');
			expect(result.folderName).toBe('Folder 1');
			expect(result.filterMeta).toEqual({
				dateRange: { 
					start: expect.any(Date), 
					end: expect.any(Date) 
				},
				folderPath: 'folder1',
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: []
			});
		});

		test('should handle combined filters with no results', async () => {
			const dateRange: DateRange = {
				startDate: '2025-03-01',
				endDate: '2025-03-31',
				insightStyle: 'structured'
			};

			const result = await noteFilterService.filterNotes(dateRange, 'folder1', 'Folder 1', 'structured');

			expect(result.mode).toBe('unified');
			expect(result.totalCount).toBe(0);
			expect(result.filterMeta).toEqual({
				dateRange: { 
					start: expect.any(Date), 
					end: expect.any(Date) 
				},
				folderPath: 'folder1',
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: []
			});
		});
	});

	describe('filterNotes - No filters', () => {
		test('should return all notes when no filters provided', async () => {
			const result = await noteFilterService.filterNotes(undefined, undefined, undefined, 'structured');

			expect(result.mode).toBe('folder'); // Defaults to folder mode when no date range
			expect(result.totalCount).toBe(6); // all notes
			expect(result.dateRange).toBeUndefined();
			expect(result.folderPath).toBeUndefined();
			expect(result.filterMeta).toEqual({
				insightStyle: 'structured',
				dateSource: 'created',
				excludedMetadata: []
			});
		});
	});

	describe('Mode determination', () => {
		test('should determine date mode correctly', async () => {
			const dateRange: DateRange = {
				startDate: '2025-01-15',
				endDate: '2025-01-25',
				insightStyle: 'structured'
			};

			const result = await noteFilterService.filterNotes(dateRange, undefined, undefined, 'structured');
			expect(result.mode).toBe('date');
		});

		test('should determine folder mode correctly', async () => {
			const result = await noteFilterService.filterNotes(undefined, 'folder1', 'Folder 1', 'structured');
			expect(result.mode).toBe('folder');
		});

		test('should determine unified mode correctly', async () => {
			const dateRange: DateRange = {
				startDate: '2025-01-15',
				endDate: '2025-01-25',
				insightStyle: 'structured'
			};

			const result = await noteFilterService.filterNotes(dateRange, 'folder1', 'Folder 1', 'structured');
			expect(result.mode).toBe('unified');
		});
	});

	describe('Error handling', () => {
		test('should handle file read errors gracefully', async () => {
			mockApp.vault.read.mockRejectedValueOnce(new Error('File read error'));

			const dateRange: DateRange = {
				startDate: '2025-01-15',
				endDate: '2025-01-25',
				insightStyle: 'structured'
			};

			const result = await noteFilterService.filterNotes(dateRange, undefined, undefined, 'structured');

			// Should still return results for files that could be read
			expect(result.totalCount).toBeGreaterThanOrEqual(0);
			expect(result.mode).toBe('date');
		});
	});
}); 