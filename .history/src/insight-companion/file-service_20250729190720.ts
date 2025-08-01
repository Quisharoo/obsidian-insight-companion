import { App, TFolder, TFile, Notice } from 'obsidian';
import { SummaryResult } from './summary-generator';
import { MarkdownFormatter, FormattingConfig } from './markdown-formatter';

export interface FileServiceConfig {
	outputFolder: string;
	includeTimestamp: boolean;
	fileNameTemplate: string;
	appendMode: boolean; // If true, append to existing file instead of creating new
	formattingConfig?: Partial<FormattingConfig>; // Configuration for markdown formatting
}

export interface SaveResult {
	success: boolean;
	filePath: string;
	error?: string;
}

export class FileService {
	private app: App;
	private config: FileServiceConfig;

	private static readonly DEFAULT_CONFIG: FileServiceConfig = {
		outputFolder: 'Summaries',
		includeTimestamp: true,
		fileNameTemplate: 'Insight Summary - {dateRange}',
		appendMode: false
	};

	constructor(app: App, config: Partial<FileServiceConfig> = {}) {
		this.app = app;
		this.config = { ...FileService.DEFAULT_CONFIG, ...config };
	}

	/**
	 * Save a summary result to the vault
	 */
	async saveSummary(summaryResult: SummaryResult): Promise<SaveResult> {
		try {
			// Ensure output folder exists
			await this.ensureOutputFolder();

			// Generate filename
			const fileName = this.generateFileName(summaryResult);
			const filePath = `${this.config.outputFolder}/${fileName}.md`;

			// Create the full content with metadata header
			const fullContent = this.createFileContent(summaryResult);

			// Save the file
			await this.saveFile(filePath, fullContent);

			return {
				success: true,
				filePath
			};

		} catch (error) {
			console.error('Error saving summary:', error);
			return {
				success: false,
				filePath: '',
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}

	/**
	 * Ensure the output folder exists, creating it if necessary
	 */
	private async ensureOutputFolder(): Promise<void> {
		const folderPath = this.config.outputFolder;
		
		// Check if folder already exists
		const existingFolder = this.app.vault.getAbstractFileByPath(folderPath);
		if (existingFolder && existingFolder instanceof TFolder) {
			return; // Folder already exists
		}

		// Create the folder
		try {
			await this.app.vault.createFolder(folderPath);
			console.log(`Created output folder: ${folderPath}`);
		} catch (error) {
			// Folder might have been created by another process
			if (!error.message?.includes('already exists')) {
				throw new Error(`Failed to create output folder '${folderPath}': ${error.message}`);
			}
		}
	}

	/**
	 * Generate a descriptive filename for the summary
	 */
	private generateFileName(summaryResult: SummaryResult): string {
		const { dateRange, notesAnalyzed, chunksProcessed } = summaryResult.metadata;
		
		// Format date range for filename (safe characters only)
		const startDate = dateRange.startDate.replace(/\//g, '-');
		const endDate = dateRange.endDate.replace(/\//g, '-');
		const dateRangeString = `${startDate} to ${endDate}`;

		// Create base filename from template
		let fileName = this.config.fileNameTemplate.replace('{dateRange}', dateRangeString);

		// Add additional context
		if (notesAnalyzed > 1) {
			fileName += ` (${notesAnalyzed} notes)`;
		}

		if (chunksProcessed > 1) {
			fileName += ` [${chunksProcessed} chunks]`;
		}

		// Add timestamp if configured
		if (this.config.includeTimestamp) {
			const timestamp = new Date().toISOString()
				.replace(/[:.]/g, '-')
				.replace('T', '_')
				.substring(0, 19); // Remove milliseconds and timezone
			fileName += `_${timestamp}`;
		}

		// Sanitize filename for filesystem safety
		return this.sanitizeFileName(fileName);
	}

	/**
	 * Create the full file content using MarkdownFormatter
	 */
	private createFileContent(summaryResult: SummaryResult): string {
		// Use the MarkdownFormatter to create properly formatted content
		return MarkdownFormatter.formatSummary(summaryResult, this.config.formattingConfig);
	}



	/**
	 * Save content to a file, handling existing files appropriately
	 */
	private async saveFile(filePath: string, content: string): Promise<void> {
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (existingFile && existingFile instanceof TFile) {
			if (this.config.appendMode) {
				// Append to existing file
				const existingContent = await this.app.vault.read(existingFile);
				const newContent = `${existingContent}\n\n---\n\n${content}`;
				await this.app.vault.modify(existingFile, newContent);
			} else {
				// Overwrite existing file
				await this.app.vault.modify(existingFile, content);
			}
		} else {
			// Create new file
			await this.app.vault.create(filePath, content);
		}

		console.log(`Summary saved to: ${filePath}`);
	}

	/**
	 * Sanitize filename to remove invalid characters
	 */
	private sanitizeFileName(fileName: string): string {
		// Remove or replace invalid filename characters
		return fileName
			.replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim()
			.substring(0, 255); // Limit length for filesystem compatibility
	}

	/**
	 * Get suggested filename without saving
	 */
	getSuggestedFileName(summaryResult: SummaryResult): string {
		return this.generateFileName(summaryResult);
	}

	/**
	 * Test if the output folder is writable
	 */
	async testOutputFolder(): Promise<{ success: boolean; error?: string }> {
		try {
			await this.ensureOutputFolder();
			
			// Test write permissions by creating a temporary file
			const testFilePath = `${this.config.outputFolder}/.test_write_${Date.now()}.tmp`;
			await this.app.vault.create(testFilePath, 'test');
			
			// Clean up test file
			const testFile = this.app.vault.getAbstractFileByPath(testFilePath);
			if (testFile) {
				await this.app.vault.delete(testFile);
			}

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<FileServiceConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Show user notification about file save results
	 */
	showSaveNotification(result: SaveResult): void {
		if (result.success) {
			new Notice(`✅ Summary saved to: ${result.filePath}`, 5000);
		} else {
			new Notice(`❌ Failed to save summary: ${result.error}`, 8000);
		}
	}
} 