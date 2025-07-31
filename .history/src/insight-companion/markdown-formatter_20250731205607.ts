import { SummaryResult } from './summary-generator';

export interface FormattingConfig {
	includeMetadata: boolean;
	includeCostEstimate: boolean;
	dateFormat: 'iso' | 'locale';
	timeFormat: '12h' | '24h';
}

export class MarkdownFormatter {
	private static readonly DEFAULT_CONFIG: FormattingConfig = {
		includeMetadata: true,
		includeCostEstimate: true,
		dateFormat: 'locale',
		timeFormat: '24h'
	};

	/**
	 * Format a SummaryResult into styled markdown with emoji headers and proper sections
	 */
	static formatSummary(summaryResult: SummaryResult, config: Partial<FormattingConfig> = {}): string {
		const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
		const { content, metadata } = summaryResult;

		// Build the formatted sections
		const sections: string[] = [];

		// Title
		sections.push('# 🧠 Insight Summary');
		sections.push('');

		// Metadata section
		if (finalConfig.includeMetadata) {
			sections.push(this.formatMetadataSection(metadata, finalConfig));
			sections.push('---');
			sections.push('');
		}

		// Parse and format the main content
		const formattedContent = this.formatMainContent(content);
		sections.push(formattedContent);

		return sections.join('\n');
	}

	/**
	 * Format the metadata section with emoji headers
	 */
	private static formatMetadataSection(metadata: SummaryResult['metadata'], config: FormattingConfig): string {
		const { mode, dateRange, folderPath, folderName, notesAnalyzed, tokensUsed, chunksProcessed, generationTime, model } = metadata;
		
		// Format generation time
		const processingTime = (generationTime / 1000).toFixed(1) + 's';
		
		// Format current timestamp
		const now = new Date();
		const generatedOn = config.timeFormat === '24h' 
			? now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB', { hour12: false })
			: now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

		// Estimate cost
		const costEstimate = this.estimateCost(tokensUsed, model);

		const sections: string[] = [];

		// Source info - handle unified mode with both filters
		if (mode === 'unified') {
			// Both folder and date filters present
			if (folderName) {
				sections.push(`### 📁 Folder Summary: \`${folderName}\``);
				if (folderPath && folderPath !== '') {
					sections.push(`**Folder Path:** \`${folderPath}\``);
				}
			}
			if (dateRange) {
				const startDate = config.dateFormat === 'iso' ? dateRange.startDate : this.formatDateForDisplay(dateRange.startDate);
				const endDate = config.dateFormat === 'iso' ? dateRange.endDate : this.formatDateForDisplay(dateRange.endDate);
				sections.push(`### 📅 Date Range: \`${startDate}\` → \`${endDate}\``);
			}
		} else if (mode === 'folder') {
			sections.push(`### 📁 Folder Summary: \`${folderName}\``);
			if (folderPath && folderPath !== '') {
				sections.push(`**Folder Path:** \`${folderPath}\``);
			}
		} else {
			// Date mode - ensure dateRange exists before accessing properties
			if (dateRange) {
				const startDate = config.dateFormat === 'iso' ? dateRange.startDate : this.formatDateForDisplay(dateRange.startDate);
				const endDate = config.dateFormat === 'iso' ? dateRange.endDate : this.formatDateForDisplay(dateRange.endDate);
				sections.push(`### 📅 Date Range: \`${startDate}\` → \`${endDate}\``);
			} else {
				sections.push(`### 📅 Date Range: _Not specified_`);
			}
		}
		
		sections.push(`**Notes Analyzed:** ${notesAnalyzed}`);
		sections.push(`**Generated On:** ${generatedOn}`);
		sections.push(`**Processing Time:** ${processingTime}`);
		sections.push(`**Model Used:** \`${model}\``);
		sections.push('');

		// Token usage section
		sections.push('## 📊 Token Usage');
		sections.push(`- **Input Tokens:** ${tokensUsed.prompt.toLocaleString()}`);
		sections.push(`- **Output Tokens:** ${tokensUsed.completion.toLocaleString()}`);
		sections.push(`- **Total Tokens:** ${tokensUsed.total.toLocaleString()}`);
		
		if (config.includeCostEstimate) {
			sections.push(`- **Estimated Cost:** \`$${costEstimate.toFixed(4)}\``);
		}
		sections.push('');

		// Processing details
		sections.push('## ⚙️ Processing');
		sections.push(`- **Chunks Processed:** ${chunksProcessed}`);
		sections.push(`- **Method:** ${chunksProcessed > 1 ? 
			(mode === 'folder' ? 'Folder-based, multi-chunk' : 'Date-based, multi-chunk') : 
			(mode === 'folder' ? 'Folder-based, single-chunk' : 'Date-based, single-chunk')}`);
		sections.push('');

		return sections.join('\n');
	}

	/**
	 * Format and parse the main content with proper emoji sections
	 */
	private static formatMainContent(content: string): string {
		// Split content into potential sections
		const lines = content.split('\n');
		const formattedLines: string[] = [];

		for (const line of lines) {
			const trimmedLine = line.trim();
			
			// Skip empty lines - they'll be preserved
			if (!trimmedLine) {
				formattedLines.push('');
				continue;
			}

			// Transform section headers with emojis
			const transformedLine = this.transformSectionHeaders(line);
			formattedLines.push(transformedLine);
		}

		return formattedLines.join('\n');
	}

	/**
	 * Transform section headers to use emoji formatting
	 */
	private static transformSectionHeaders(line: string): string {
		const trimmedLine = line.trim().toLowerCase();

		// Define section mappings with emojis
		const sectionMappings = [
			{ pattern: /^#+\s*(key themes?|themes?|main themes?).*$/i, replacement: '## 🔍 Key Themes' },
			{ pattern: /^#+\s*(important people|key people|people mentioned?).*$/i, replacement: '## 👤 Key People Referenced' },
			{ pattern: /^#+\s*(action items?|actions?|next steps?).*$/i, replacement: '## ✅ Action Items' },
			{ pattern: /^#+\s*(cross[- ]?chunk insights?|cross[- ]?cutting insights?|overall insights?).*$/i, replacement: '## 🔁 Cross-Chunk Insights' },
			{ pattern: /^#+\s*(notes? referenced?|note references?|referenced notes?).*$/i, replacement: '## 📝 Notes Referenced' },
			{ pattern: /^#+\s*(summary|overview).*$/i, replacement: '## 📋 Summary' },
			{ pattern: /^#+\s*(insights?).*$/i, replacement: '## 💡 Insights' },
			{ pattern: /^#+\s*(conclusions?).*$/i, replacement: '## 🎯 Conclusions' }
		];

		// Check if this line matches any section header pattern
		for (const mapping of sectionMappings) {
			if (mapping.pattern.test(line)) {
				return mapping.replacement;
			}
		}

		// If it's a header but doesn't match our patterns, preserve it
		if (/^#+\s/.test(line)) {
			return line;
		}

		// For non-header lines, just return as-is
		return line;
	}

	/**
	 * Format date for display
	 */
	private static formatDateForDisplay(dateString: string): string {
		try {
			// Handle different date formats
			const date = new Date(dateString);
			if (isNaN(date.getTime())) {
				// If it's already in a readable format, return as-is
				return dateString;
			}
			return date.toLocaleDateString('en-US', { 
				year: 'numeric', 
				month: '2-digit', 
				day: '2-digit' 
			}).replace(/\//g, '-');
		} catch {
			return dateString;
		}
	}

	/**
	 * Estimate cost based on token usage and model
	 */
	private static estimateCost(tokensUsed: { prompt: number; completion: number; total: number }, model: string): number {
		// Determine pricing based on model
		const isTurbo = this.isTurboModel(model);
		
		let INPUT_COST_PER_1K: number;
		let OUTPUT_COST_PER_1K: number;
		
		if (isTurbo) {
			// GPT-4 Turbo pricing: $0.01 per 1K input tokens, $0.03 per 1K output tokens
			INPUT_COST_PER_1K = 0.01;
			OUTPUT_COST_PER_1K = 0.03;
		} else {
			// Legacy GPT-4 pricing: $0.03 per 1K input tokens, $0.06 per 1K output tokens  
			INPUT_COST_PER_1K = 0.03;
			OUTPUT_COST_PER_1K = 0.06;
		}
		
		const inputCost = (tokensUsed.prompt / 1000) * INPUT_COST_PER_1K;
		const outputCost = (tokensUsed.completion / 1000) * OUTPUT_COST_PER_1K;
		
		return inputCost + outputCost;
	}

	/**
	 * Check if a model is a Turbo variant
	 */
	private static isTurboModel(model: string): boolean {
		const turboModels = [
			'gpt-4-0125-preview',
			'gpt-4-1106-preview', 
			'gpt-4-turbo',
			'gpt-4-turbo-preview'
		];
		return turboModels.includes(model) || model.includes('turbo');
	}
} 