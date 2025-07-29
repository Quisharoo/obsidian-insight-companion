import { FilteredNote, NoteFilterResult } from './note-filter';
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
		context: { dateRange?: DateRange; folderName?: string; folderPath?: string; mode: 'date' | 'folder' }, 
		config: Partial<PromptConfig> = {}
	): GeneratedPrompt {
		const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
		
		const systemPrompt = this.buildSystemPrompt(finalConfig);
		const notesContent = this.buildNotesContent(notes, finalConfig);
		const instructionPrompt = this.buildInstructionPrompt(context, notes.length, finalConfig);
		
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
		return `You're a perceptive colleague helping make sense of scattered thinking. Your job is to look through someone's notes and pull out what seems to matter — the patterns, the people who keep showing up, the things that feel unfinished.

Write like someone who's comfortable saying "maybe" or "seems like" because you're working with real human thoughts, not corporate data. Stay grounded in what's actually there — don't guess intentions or fill in gaps that aren't filled.

CRITICAL OUTPUT REQUIREMENTS:
- Generate clean Markdown without code block fences (no \`\`\` at start or end)
- Use Obsidian wiki link format [[Note Title]] for all note references
- Ensure all note links are clickable by using exact note titles without .md extension
- Structure your response with clear headings and bullet points
- Focus on insights, patterns, and connections between notes
- Be observational and human, avoid corporate buzzwords

OUTPUT STRUCTURE:
# Insight Summary

## Key Themes
[What keeps coming up? Group by theme, not by individual note — but only call out patterns that actually exist]

## Important People
[Who shows up in these notes? Their context and why they might matter, based on what's actually written]

## Action Items & Next Steps
[Things that sound unfinished, decisions waiting to happen, or next steps that seem to be lurking]

## Notes Referenced
[What you looked at, with just enough detail to be useful]`;
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
		context: { dateRange?: DateRange; folderName?: string; folderPath?: string; mode: 'date' | 'folder' }, 
		noteCount: number, 
		config: PromptConfig
	): string {
		// Build context description based on mode
		let contextDescription: string;
		if (context.mode === 'folder') {
			contextDescription = `from the folder "${context.folderName}"${context.folderPath ? ` (${context.folderPath})` : ''}`;
		} else if (context.dateRange) {
			contextDescription = `from the period ${context.dateRange.startDate} to ${context.dateRange.endDate}`;
		} else {
			contextDescription = `from the selected collection`;
		}

		let instructions = `ANALYSIS INSTRUCTIONS:

Analyze the ${noteCount} notes above ${contextDescription}.

Focus on:
1. **Themes**: Identify recurring topics, concepts, or patterns across notes
2. **People**: Extract mentions of individuals, their roles, and significance
3. **Actions**: Find tasks, decisions, commitments, and next steps
4. **Connections**: Look for relationships and dependencies between notes

When referencing notes in your analysis:
- Use the exact format [[Note Title]] (without .md extension)
- Ensure note titles match exactly for clickable links
- Group related insights by theme rather than by individual note

		Approach:
- Only call out what you actually see, not what you think might be implied
- If something keeps showing up, it's probably worth mentioning — but don't overthink it
- Note things that feel unfinished or unresolved, but don't assume what the person was thinking
- Suggest next steps that flow naturally from what's written, not what seems strategic`;

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
	 * Generate prompt for analyzing a specific chunk of notes
	 */
	static buildChunkAnalysisPrompt(
		notes: FilteredNote[], 
		chunkIndex: number, 
		totalChunks: number, 
		context: { dateRange?: DateRange; folderName?: string; folderPath?: string; mode: 'date' | 'folder' }, 
		config: Partial<PromptConfig> = {}
	): GeneratedPrompt {
		const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
		
		const systemPrompt = `You are analyzing a chunk of notes for insight extraction. This is chunk ${chunkIndex + 1} of ${totalChunks} total chunks.

OUTPUT REQUIREMENTS:
- Generate clean Markdown without code block fences  
- Use [[Note Title]] format for note references (without .md extension)
- Focus on key themes, people, and actions in THIS chunk
- Keep insights concise since this is a partial analysis`;

		const notesContent = this.buildNotesContent(notes, finalConfig);
		
		// Build context description based on mode
		let contextDescription: string;
		if (context.mode === 'folder') {
			contextDescription = `from the folder "${context.folderName}"${context.folderPath ? ` (${context.folderPath})` : ''}`;
		} else if (context.dateRange) {
			contextDescription = `from ${context.dateRange.startDate} to ${context.dateRange.endDate}`;
		} else {
			contextDescription = `from the selected collection`;
		}

		const instructionPrompt = `Analyze this chunk of ${notes.length} notes ${contextDescription} (part ${chunkIndex + 1} of ${totalChunks} total chunks).

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
	 * Generate prompt for combining multiple chunk summaries into a final summary
	 */
	static combineSummariesPrompt(
		chunkSummaries: string[], 
		totalNoteCount: number, 
		context: { dateRange?: DateRange; folderName?: string; folderPath?: string; mode: 'date' | 'folder' }
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

		// Build context description based on mode
		let contextDescription: string;
		if (context.mode === 'folder') {
			contextDescription = `from the folder "${context.folderName}"${context.folderPath ? ` (${context.folderPath})` : ''}`;
		} else if (context.dateRange) {
			contextDescription = `from ${context.dateRange.startDate} to ${context.dateRange.endDate}`;
		} else {
			contextDescription = `from the selected collection`;
		}

		const instructionPrompt = `Combine the ${chunkSummaries.length} chunk summaries above into a comprehensive insight report for ${totalNoteCount} total notes ${contextDescription}.

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