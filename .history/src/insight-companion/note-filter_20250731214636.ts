import { App, TFile, TFolder } from 'obsidian';
import { DateRange } from './date-picker-modal';

export interface FilteredNote {
	file: TFile;
	content: string;
	createdTime: number;
	modifiedTime: number;
}

export interface NoteFilterResult {
	notes: FilteredNote[];
	totalCount: number;
	dateRange?: DateRange; // Optional for folder mode
	folderPath?: string; // For folder mode
	folderName?: string; // For folder mode
	mode: 'date' | 'folder' | 'unified'; // Indicates filtering mode
	dateSource: 'created' | 'modified'; // Date source for filtering
	excludedMetadata: string[]; // Metadata patterns to exclude
	filterMeta: {
		folderPath?: string;
		dateRange?: { start: Date; end: Date };
		insightStyle: 'structured' | 'freeform';
		dateSource: 'created' | 'modified';
		excludedMetadata: string[];
	};
}

export class NoteFilterService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Retrieves all markdown notes from the vault and filters them by the given date range
	 */
	async filterNotesByDateRange(dateRange: DateRange): Promise<NoteFilterResult> {
		const startDate = new Date(dateRange.startDate);
		const endDate = new Date(dateRange.endDate);
		
		// Set time boundaries to include entire days
		startDate.setHours(0, 0, 0, 0);
		endDate.setHours(23, 59, 59, 999);

		const allFiles = this.app.vault.getMarkdownFiles();
		const filteredNotes: FilteredNote[] = [];

		for (const file of allFiles) {
			if (this.isNoteInDateRange(file, startDate, endDate, dateRange.dateSource || 'created')) {
				try {
					const content = await this.app.vault.read(file);
					filteredNotes.push({
						file,
						content,
						createdTime: file.stat.ctime,
						modifiedTime: file.stat.mtime
					});
				} catch (error) {
					console.warn(`Failed to read note: ${file.path}`, error);
					// Continue processing other notes even if one fails
				}
			}
		}

		return {
			notes: filteredNotes,
			totalCount: filteredNotes.length,
			dateRange,
			mode: 'date',
			dateSource: dateRange.dateSource || 'created',
			excludedMetadata: [],
			filterMeta: {
				dateRange: { start: startDate, end: endDate },
				insightStyle: dateRange.insightStyle || 'structured',
				dateSource: dateRange.dateSource || 'created',
				excludedMetadata: []
			}
		};
	}

	/**
	 * Retrieves all markdown notes from a specific folder and its subfolders
	 */
	async filterNotesByFolder(folderPath: string, folderName: string): Promise<NoteFilterResult> {
		const filteredNotes: FilteredNote[] = [];
		let markdownFiles: TFile[] = [];

		if (folderPath === '') {
			// Root folder - get all markdown files
			markdownFiles = this.app.vault.getMarkdownFiles();
		} else {
			// Specific folder - get files recursively
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
					if (folder && 'children' in folder) {
			markdownFiles = this.getMarkdownFilesInFolder(folder as TFolder);
		}
		}

		// Read content for each file
		for (const file of markdownFiles) {
			try {
				const content = await this.app.vault.read(file);
				filteredNotes.push({
					file,
					content,
					createdTime: file.stat.ctime,
					modifiedTime: file.stat.mtime
				});
			} catch (error) {
				console.warn(`Failed to read note: ${file.path}`, error);
				// Continue processing other notes even if one fails
			}
		}

		return {
			notes: filteredNotes,
			totalCount: filteredNotes.length,
			folderPath,
			folderName,
			mode: 'folder',
			dateSource: 'created',
			excludedMetadata: [],
			filterMeta: {
				folderPath,
				insightStyle: 'structured', // Default for folder mode
				dateSource: 'created',
				excludedMetadata: []
			}
		};
	}

	/**
	 * Recursively get all markdown files from a folder and its subfolders
	 */
	private getMarkdownFilesInFolder(folder: TFolder): TFile[] {
		const markdownFiles: TFile[] = [];

		const collectFiles = (currentFolder: TFolder) => {
			currentFolder.children.forEach(child => {
							if (child.path.endsWith('.md') && !('children' in child)) {
				markdownFiles.push(child as TFile);
			} else if (child && 'children' in child) {
				collectFiles(child as TFolder);
			}
			});
		};

		collectFiles(folder);
		return markdownFiles;
	}

	/**
	 * Checks if a note falls within the specified date range based on the selected date source
	 */
	private isNoteInDateRange(file: TFile, startDate: Date, endDate: Date, dateSource: 'created' | 'modified' = 'created'): boolean {
		const noteDate = dateSource === 'created' 
			? new Date(file.stat.ctime)
			: new Date(file.stat.mtime);

		return noteDate >= startDate && noteDate <= endDate;
	}

	/**
	 * Checks if a note should be excluded based on metadata patterns
	 */
	private shouldExcludeNote(note: FilteredNote, excludedMetadata: string[]): boolean {
		if (!excludedMetadata || excludedMetadata.length === 0) {
			return false;
		}

		const content = note.content.toLowerCase();
		
		for (const pattern of excludedMetadata) {
			const trimmedPattern = pattern.trim();
			if (!trimmedPattern) continue;

			// Check for frontmatter key-value pairs (e.g., "summarise: false")
			if (trimmedPattern.includes(':')) {
				const [key, value] = trimmedPattern.split(':').map(s => s.trim());
				const frontmatterRegex = new RegExp(`^---\\s*\\n[\\s\\S]*?${key}\\s*:\\s*${value}[\\s\\S]*?\\n---`, 'im');
				if (frontmatterRegex.test(content)) {
					return true;
				}
			}
			
			// Check for tags (e.g., "#private")
			if (trimmedPattern.startsWith('#')) {
				const tagRegex = new RegExp(`\\b${trimmedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
				if (tagRegex.test(content)) {
					return true;
				}
			}
			
			// Check for exact text match
			if (content.includes(trimmedPattern.toLowerCase())) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Gets metadata about notes without reading their content (for quick previews)
	 */
	async getNotesMetadata(dateRange: DateRange): Promise<{ count: number; files: TFile[] }> {
		const startDate = new Date(dateRange.startDate);
		const endDate = new Date(dateRange.endDate);
		
		startDate.setHours(0, 0, 0, 0);
		endDate.setHours(23, 59, 59, 999);

		const allFiles = this.app.vault.getMarkdownFiles();
		const filteredFiles = allFiles.filter(file => 
			this.isNoteInDateRange(file, startDate, endDate, dateRange.dateSource || 'created')
		);

		return {
			count: filteredFiles.length,
			files: filteredFiles
		};
	}

	/**
	 * Gets metadata about notes in a folder without reading their content (for quick previews)
	 */
	async getFolderNotesMetadata(folderPath: string): Promise<{ count: number; files: TFile[] }> {
		let markdownFiles: TFile[] = [];

		if (folderPath === '') {
			// Root folder - get all markdown files
			markdownFiles = this.app.vault.getMarkdownFiles();
		} else {
			// Specific folder - get files recursively
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
					if (folder && 'children' in folder) {
			markdownFiles = this.getMarkdownFilesInFolder(folder as TFolder);
		}
		}

		return {
			count: markdownFiles.length,
			files: markdownFiles
		};
	}

	/**
	 * Unified filtering method that supports date range, folder, or both filters
	 */
	async filterNotes(dateRange?: DateRange, folderPath?: string, folderName?: string, insightStyle: 'structured' | 'freeform' = 'structured'): Promise<NoteFilterResult> {
		let candidateFiles: TFile[] = [];

		// Step 1: Get initial file set based on folder filter
		if (folderPath && folderPath !== '') {
			// Specific folder - get files recursively
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (folder && 'children' in folder) {
				candidateFiles = this.getMarkdownFilesInFolder(folder as TFolder);
			}
		} else {
			// No folder filter - get all markdown files
			candidateFiles = this.app.vault.getMarkdownFiles();
		}

		// Step 2: Apply date filter if provided
		if (dateRange) {
			const startDate = new Date(dateRange.startDate);
			const endDate = new Date(dateRange.endDate);
			
			// Set time boundaries to include entire days
			startDate.setHours(0, 0, 0, 0);
			endDate.setHours(23, 59, 59, 999);

			candidateFiles = candidateFiles.filter(file => 
				this.isNoteInDateRange(file, startDate, endDate, dateRange.dateSource || 'created')
			);
		}

		// Step 3: Read content for filtered files
		const filteredNotes: FilteredNote[] = [];
		for (const file of candidateFiles) {
			try {
				const content = await this.app.vault.read(file);
				filteredNotes.push({
					file,
					content,
					createdTime: file.stat.ctime,
					modifiedTime: file.stat.mtime
				});
			} catch (error) {
				console.warn(`Failed to read note: ${file.path}`, error);
				// Continue processing other notes even if one fails
			}
		}

		// Step 4: Build filter metadata
		const filterMeta: NoteFilterResult['filterMeta'] = {
			insightStyle,
			dateSource: dateRange?.dateSource || 'created',
			excludedMetadata: []
		};

		if (folderPath) {
			filterMeta.folderPath = folderPath;
		}

		if (dateRange) {
			const startDate = new Date(dateRange.startDate);
			const endDate = new Date(dateRange.endDate);
			startDate.setHours(0, 0, 0, 0);
			endDate.setHours(23, 59, 59, 999);
			filterMeta.dateRange = { start: startDate, end: endDate };
		}

		// Step 5: Determine mode and build result
		let mode: 'date' | 'folder' | 'unified';
		if (dateRange && folderPath) {
			mode = 'unified';
		} else if (dateRange) {
			mode = 'date';
		} else {
			mode = 'folder';
		}

		return {
			notes: filteredNotes,
			totalCount: filteredNotes.length,
			dateRange,
			folderPath,
			folderName,
			mode,
			dateSource: dateRange?.dateSource || 'created',
			excludedMetadata: [],
			filterMeta
		};
	}
} 