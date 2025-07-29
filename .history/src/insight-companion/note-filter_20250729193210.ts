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
	mode: 'date' | 'folder'; // Indicates filtering mode
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
			if (this.isNoteInDateRange(file, startDate, endDate)) {
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
			mode: 'date'
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
			mode: 'folder'
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
	 * Checks if a note falls within the specified date range based on creation or modification time
	 */
	private isNoteInDateRange(file: TFile, startDate: Date, endDate: Date): boolean {
		const createdDate = new Date(file.stat.ctime);
		const modifiedDate = new Date(file.stat.mtime);

		// Note is included if either creation or modification date falls within range
		const createdInRange = createdDate >= startDate && createdDate <= endDate;
		const modifiedInRange = modifiedDate >= startDate && modifiedDate <= endDate;

		return createdInRange || modifiedInRange;
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
			this.isNoteInDateRange(file, startDate, endDate)
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
} 