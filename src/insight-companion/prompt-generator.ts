import { FilteredNote } from './note-filter';
import { DateRange } from './date-picker-modal';

export interface PromptConfig {
	includeMetadata: boolean;
	maxNotePreview: number;
	focusAreas?: string[];
}

export interface GeneratedPrompt {
	content: string;
	noteCount: number;
	estimatedTokens: number;
}

export class PromptGenerator {
	private static readonly DEFAULT_CONFIG: PromptConfig = {
		includeMetadata: true,
		maxNotePreview: 500, // Max characters per note preview
		focusAreas: []
	};

	/**
	 * Generate a comprehensive prompt for insight extraction from notes
	 */
	static generateInsightPrompt(
		notes: FilteredNote[], 
		dateRange: DateRange, 
		config: Partial<PromptConfig> = {}
	): GeneratedPrompt {
		const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
		
		const systemPrompt = this.buildSystemPrompt(finalConfig);
		const notesContent = this.buildNotesContent(notes, finalConfig);
		const instructionPrompt = this.buildInstructionPrompt(dateRange, notes.length, finalConfig);
		
		const fullPrompt = `${systemPrompt}\n\n${notesContent}\n\n${instructionPrompt}`;
		
		return {
			content: fullPrompt,
			noteCount: notes.length,
			estimatedTokens: Math.ceil(fullPrompt.length / 4) // Rough estimation
		};
	}

	/**
	 * Build the system prompt that defines the AI's role and output format
	 */
	private static buildSystemPrompt(config: PromptConfig): string {
		return `You are an expert analyst specializing in extracting meaningful insights from personal notes and documents. Your task is to analyze a collection of notes and generate a comprehensive summary that helps the user understand key themes, important people, and actionable next steps.

CRITICAL OUTPUT REQUIREMENTS:
- Generate clean Markdown without code block fences (no \`\`\` at start or end)
- Use Obsidian wiki link format [[Note Title]] for all note references
- Ensure all note links are clickable by using exact note titles without .md extension
- Structure your response with clear headings and bullet points
- Focus on insights, patterns, and connections between notes
- Be concise but comprehensive

OUTPUT STRUCTURE:
# Insight Summary

## Key Themes
[Identify 3-5 major themes with supporting evidence from specific notes]

## Important People
[List key individuals mentioned, their roles/context, and relevant notes]

## Action Items & Next Steps
[Extract concrete actionable items and recommendations]

## Note References
[Summary of source notes analyzed with brief descriptions]`;
	}

	/**
	 * Build the content section containing all note data
	 */
	private static buildNotesContent(notes: FilteredNote[], config: PromptConfig): string {
		let content = `NOTES TO ANALYZE (${notes.length} total):\n\n`;
		
		notes.forEach((note, index) => {
			const noteTitle = this.extractNoteTitle(note.file.path);
			let noteContent = note.content;
			
			// Truncate content if it exceeds the preview limit
			if (noteContent.length > config.maxNotePreview) {
				noteContent = noteContent.substring(0, config.maxNotePreview) + '...[truncated]';
			}
			
			content += `---\n`;
			content += `NOTE ${index + 1}: ${noteTitle}\n`;
			
			if (config.includeMetadata) {
				content += `Created: ${new Date(note.createdTime).toISOString().split('T')[0]}\n`;
				content += `Modified: ${new Date(note.modifiedTime).toISOString().split('T')[0]}\n`;
			}
			
			content += `\nContent:\n${noteContent}\n\n`;
		});
		
		return content;
	}

	/**
	 * Build the instruction prompt with specific guidance for analysis
	 */
	private static buildInstructionPrompt(
		dateRange: DateRange, 
		noteCount: number, 
		config: PromptConfig
	): string {
		let instructions = `ANALYSIS INSTRUCTIONS:

Analyze the ${noteCount} notes above from the period ${dateRange.startDate} to ${dateRange.endDate}.

Focus on:
1. **Themes**: Identify recurring topics, concepts, or patterns across notes
2. **People**: Extract mentions of individuals, their roles, and significance
3. **Actions**: Find tasks, decisions, commitments, and next steps
4. **Connections**: Look for relationships and dependencies between notes

When referencing notes in your analysis:
- Use the exact format [[Note Title]] (without .md extension)
- Ensure note titles match exactly for clickable links
- Group related insights by theme rather than by individual note

Quality guidelines:
- Be specific and evidence-based
- Prioritize actionable insights over mere summaries
- Identify gaps or missing information where relevant
- Suggest logical next steps based on the content analyzed`;

		// Add focus areas if specified
		if (config.focusAreas && config.focusAreas.length > 0) {
			instructions += `\n\nSPECIAL FOCUS AREAS:\n`;
			config.focusAreas.forEach(area => {
				instructions += `- ${area}\n`;
			});
		}

		instructions += `\n\nRemember: Generate clean Markdown without code fences. All note links must be in [[Note Title]] format for Obsidian compatibility.`;

		return instructions;
	}

	/**
	 * Extract note title from file path (remove extension and path)
	 */
	private static extractNoteTitle(filePath: string): string {
		return filePath.replace(/\.md$/, '').split('/').pop() || filePath;
	}

	/**
	 * Generate a prompt for chunked analysis (when notes need to be processed in batches)
	 */
	static generateChunkPrompt(
		notes: FilteredNote[], 
		chunkIndex: number, 
		totalChunks: number,
		dateRange: DateRange, 
		config: Partial<PromptConfig> = {}
	): GeneratedPrompt {
		const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
		
		const systemPrompt = `You are analyzing a subset of notes (chunk ${chunkIndex + 1} of ${totalChunks}). Generate a partial insight summary that will be combined with other chunks later.

OUTPUT FORMAT: Clean Markdown without code fences
- Use [[Note Title]] format for all note references
- Focus on key themes, people, and actions in THIS chunk
- Keep insights concise since this is a partial analysis`;

		const notesContent = this.buildNotesContent(notes, finalConfig);
		
		const instructionPrompt = `Analyze this chunk of ${notes.length} notes from ${dateRange.startDate} to ${dateRange.endDate} (part ${chunkIndex + 1} of ${totalChunks} total chunks).

Provide:
1. Key themes in this chunk
2. Important people mentioned
3. Action items identified
4. Notable insights or patterns

Keep responses focused and actionable. This will be combined with other chunk analyses.`;

		const fullPrompt = `${systemPrompt}\n\n${notesContent}\n\n${instructionPrompt}`;
		
		return {
			content: fullPrompt,
			noteCount: notes.length,
			estimatedTokens: Math.ceil(fullPrompt.length / 4)
		};
	}

	/**
	 * Generate a prompt for combining multiple chunk summaries into a final insight
	 */
	static generateCombinationPrompt(
		chunkSummaries: string[], 
		totalNoteCount: number,
		dateRange: DateRange
	): GeneratedPrompt {
		const systemPrompt = `You are combining partial insight summaries into a comprehensive final analysis. 

OUTPUT REQUIREMENTS:
- Generate clean Markdown without code block fences
- Preserve all [[Note Title]] links from the chunk summaries
- Synthesize themes and insights across all chunks
- Eliminate redundancy while preserving important details`;

		const summariesContent = chunkSummaries
			.map((summary, index) => `--- CHUNK ${index + 1} SUMMARY ---\n${summary}`)
			.join('\n\n');

		const instructionPrompt = `Combine the ${chunkSummaries.length} chunk summaries above into a comprehensive insight report for ${totalNoteCount} total notes from ${dateRange.startDate} to ${dateRange.endDate}.

Create a unified summary with:

# Insight Summary

## Key Themes
[Synthesize themes from all chunks, identifying the most significant patterns]

## Important People  
[Consolidate all people mentioned across chunks with their context]

## Action Items & Next Steps
[Combine and prioritize all action items identified]

## Cross-Chunk Insights
[Identify connections and patterns that span multiple chunks]

## Note References
[Provide overview of the ${totalNoteCount} notes analyzed]

Ensure all [[Note Title]] links are preserved and properly formatted for Obsidian.`;

		const fullPrompt = `${systemPrompt}\n\n${summariesContent}\n\n${instructionPrompt}`;
		
		return {
			content: fullPrompt,
			noteCount: totalNoteCount,
			estimatedTokens: Math.ceil(fullPrompt.length / 4)
		};
	}

	/**
	 * Validate that a prompt meets token limits
	 */
	static validatePromptSize(prompt: GeneratedPrompt, maxTokens: number = 128000): boolean {
		return prompt.estimatedTokens <= maxTokens;
	}
} 