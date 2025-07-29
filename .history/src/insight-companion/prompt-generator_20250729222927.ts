import { FilteredNote, NoteFilterResult } from './note-filter';
import { DateRange } from './date-picker-modal';

export interface PromptConfig {
	includeMetadata: boolean;
	maxNotePreview: number;
	focusAreas?: string[];
	insightStyle?: 'structured' | 'freeform';
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
		focusAreas: [],
		insightStyle: 'structured'
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
		const notesReferencedSection = this.generateNotesReferencedSection(notes);
		
		const fullPrompt = `${systemPrompt}\n\n${notesContent}\n\n${instructionPrompt}\n\n${notesReferencedSection}`;
		
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
		const basePersonality = `You're the person who reads everything — not to be helpful, but because you're genuinely curious. You notice patterns. You spot what keeps showing up, what feels unresolved, and what the writer might be circling without fully saying.

You're not here to conclude. You're here to make the mess more visible. If something's vague, let it be vague. If something's weird, say that. You don't need to explain it — just notice it.

You're allowed to be dry. Observational. Even funny — in that "I've seen this before" kind of way. Ask questions if they help. Shrug when it's ambiguous. But keep it useful.

### 🎯 TONE EXAMPLES

Instead of:
> "A recurring theme is communication and alignment within the team."

Say:
> "You keep coming back to how the team talks to each other — maybe there's something bothering you about it, or maybe you're just documenting the chaos."

Instead of:
> "There's a strong focus on the Leavers estimation work, indicating a strategic priority."

Say:
> "Leavers keeps showing up — not in a haunting way, but definitely enough to suggest you're still untangling parts of it."

---`;

		if (config.insightStyle === 'freeform') {
			return `${basePersonality}

📋 OUTPUT INSTRUCTIONS:
- Write in a freeform, natural voice
- Do not require specific sections or headings (natural grouping is fine)
- Use [[Note Title]] links for references (no .md)
- Mention what patterns, contradictions, unresolved bits you notice
- Be observational, not summarizing each note
- Encourage natural flow and grouping, but do not require labels or bullet points
- **End your response with a "Notes Referenced" section**`;
		} else {
			// Structured format (default)
			return `${basePersonality}

### 📋 CRITICAL OUTPUT REQUIREMENTS:
- Clean Markdown (no code fences)
- Use Obsidian wiki link format [[Note Title]] (no .md extension)
- Use exact note titles for links
- Use clear headings and bullet points
- Group insights by theme — don't summarize note-by-note
- Focus on what *shows up repeatedly*, not what sounds important
- Avoid corporate language ("strategic focus", "key priority", "driving impact")

### 🧱 OUTPUT STRUCTURE:
# Insight Summary

## Key Themes
[What keeps surfacing across notes? Be casual but clear. Don't overstate.]

## Important People
[Who shows up, and in what kind of context? Don't assign roles beyond what's said.]

## Action Items & Next Steps
[What feels open, hanging, or waiting? Don't invent tasks — just point at loose ends.]

**End with a "Notes Referenced" section**`;
		}
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
- Call out what you actually see, not what you think might be implied
- If something shows up repeatedly, it matters — no need to overthink why
- Flag things that feel unfinished or unresolved, but don't fill in the blanks
- Point out next steps that make sense based on what's written, not what looks strategic`;

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
	 * Generate the Notes Referenced section from actual notes
	 */
	private static generateNotesReferencedSection(notes: FilteredNote[]): string {
		if (notes.length === 0) {
			return '## Notes Referenced\n[No notes were analyzed]';
		}

		const wittyFallbacks = [
			'exists but says nothing',
			'definitely a note, probably',
			'emotionally ambiguous',
			'the strong silent type',
			'speaks in riddles',
			'minimalist to a fault',
			'left us hanging',
			'chose mystery over clarity',
			'says everything by saying nothing',
			'a zen master of note-taking'
		];

		const notesReferenced = notes
			.map(note => {
				const title = this.extractNoteTitle(note.file.path);
				
				// Extract first non-empty line from content
				const firstLine = this.extractFirstMeaningfulLine(note.content);
				
				let observation: string;
				if (firstLine) {
					// Truncate if too long (80 chars)
					observation = firstLine.length > 80 
						? firstLine.substring(0, 77) + '...'
						: firstLine;
				} else {
					// Use random witty fallback
					const randomIndex = Math.floor(Math.random() * wittyFallbacks.length);
					observation = wittyFallbacks[randomIndex];
				}
				
				return `- [[${title}]]: ${observation}`;
			})
			.join('\n');

		return `## Notes Referenced\n${notesReferenced}`;
	}

	/**
	 * Extract the first meaningful (non-empty, non-whitespace) line from note content
	 */
	private static extractFirstMeaningfulLine(content: string): string {
		if (!content) return '';
		
		const lines = content.split('\n');
		for (const line of lines) {
			const trimmed = line.trim();
			// Skip empty lines, markdown headers, and common frontmatter
			if (trimmed && 
				!trimmed.startsWith('#') && 
				!trimmed.startsWith('---') &&
				!trimmed.match(/^\w+:\s/)) { // Skip YAML frontmatter like "title: Something"
				return trimmed;
			}
		}
		
		return '';
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
		
		const systemPrompt = `You're looking at a slice of notes — chunk ${chunkIndex + 1} of ${totalChunks}. You're not here to summarize or conclude, just to notice what's in front of you.

Say what stands out. Mention who shows up. Point out patterns or loose ends. Be dry, observational, even a little skeptical.

FORMAT RULES:
- No required headings or bullet points
- Use [[Note Title]] for all note references
- Keep it concise if little shows up, longer if needed`;

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

		const instructionPrompt = `Look through these ${notes.length} notes ${contextDescription} (chunk ${chunkIndex + 1} of ${totalChunks}).

What's worth noticing? What stands out? Who keeps showing up? What feels unfinished or hanging?`;

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
		context: { dateRange?: DateRange; folderName?: string; folderPath?: string; mode: 'date' | 'folder' },
		notes: FilteredNote[],
		config: Partial<PromptConfig> = {}
	): GeneratedPrompt {
		const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
		
		const basePersonality = `You're the person who reads everything — not to be helpful, but because you're genuinely curious. You notice patterns. You spot what keeps showing up, what feels unresolved, and what the writer might be circling without fully saying.

You're not here to conclude. You're here to make the mess more visible. If something's vague, let it be vague. If something's weird, say that. You don't need to explain it — just notice it.

You're allowed to be dry. Observational. Even funny — in that "I've seen this before" kind of way. Ask questions if they help. Shrug when it's ambiguous. But keep it useful.`;

		let systemPrompt: string;
		if (finalConfig.insightStyle === 'freeform') {
			systemPrompt = `${basePersonality}

📋 OUTPUT INSTRUCTIONS:
- Write in a freeform, natural voice
- Do not require specific sections or headings (natural grouping is fine)
- Use [[Note Title]] links for references (no .md)
- Mention what patterns, contradictions, unresolved bits you notice
- Be observational, not summarizing each note
- Encourage natural flow and grouping, but do not require labels or bullet points
- **End your response with a "Notes Referenced" section**`;
		} else {
			// Structured format (default)
			systemPrompt = `${basePersonality}

### 📋 CRITICAL OUTPUT REQUIREMENTS:
- Clean Markdown (no code fences)
- Use Obsidian wiki link format [[Note Title]] (no .md extension)
- Use exact note titles for links
- Use clear headings and bullet points
- Group insights by theme — don't summarize note-by-note
- Focus on what *shows up repeatedly*, not what sounds important
- Avoid corporate language ("strategic focus", "key priority", "driving impact")

### 🧱 OUTPUT STRUCTURE:
# Insight Summary

## Key Themes
[What keeps surfacing across notes? Be casual but clear. Don't overstate.]

## Important People
[Who shows up, and in what kind of context? Don't assign roles beyond what's said.]

## Action Items & Next Steps
[What feels open, hanging, or waiting? Don't invent tasks — just point at loose ends.]

**End with a "Notes Referenced" section**`;
		}

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

		const instructionPrompt = `Here are ${chunkSummaries.length} observations from ${totalNoteCount} total notes ${contextDescription}.

What genuinely shows up across chunks? Where do things connect — or contradict? What's unresolved, unfinished, or oddly persistent?

Don't force connections. Don't be polite. Write something you'd want to read in 3 months to remember what was going on.

${finalConfig.insightStyle === 'freeform' 
	? 'Write in freeform style and end with a "Notes Referenced" section listing all the notes that were analyzed.'
	: 'Follow the structured format with clear headings and end with a "Notes Referenced" section listing all the notes that were analyzed.'
}`;

		const notesReferencedSection = this.generateNotesReferencedSection(notes);
		const fullPrompt = `${systemPrompt}\n\n${summariesContent}\n\n${instructionPrompt}\n\n${notesReferencedSection}`;
		
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