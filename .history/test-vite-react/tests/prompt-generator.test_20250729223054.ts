import { PromptGenerator, PromptConfig, GeneratedPrompt } from '../../src/insight-companion/prompt-generator';
import { FilteredNote } from '../../src/insight-companion/note-filter';
import { DateRange } from '../../src/insight-companion/date-picker-modal';

describe('PromptGenerator', () => {
	const mockDateRange: DateRange = {
		startDate: '2024-01-01',
		endDate: '2024-01-31'
	};

	const mockDateContext = {
		dateRange: mockDateRange,
		mode: 'date' as const
	};

	const mockFolderContext = {
		folderName: 'Projects',
		folderPath: 'projects',
		mode: 'folder' as const
	};

	const mockNotes: FilteredNote[] = [
		{
			file: { path: 'folder/Note 1.md' } as any,
			content: 'This is the content of note 1. It contains important information about project planning.',
			createdTime: Date.now(),
			modifiedTime: Date.now()
		},
		{
			file: { path: 'Note 2.md' } as any,
			content: 'Note 2 content with different topics and some action items to complete.',
			createdTime: Date.now(),
			modifiedTime: Date.now()
		}
	];

	describe('generateInsightPrompt', () => {
		test('should generate a valid prompt with notes and date range', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			expect(result.noteCount).toBe(2);
			expect(result.content).toContain('NOTES TO ANALYZE (2 total)');
			expect(result.content).toContain('NOTE 1: Note 1');
			expect(result.content).toContain('NOTE 2: Note 2');
			expect(result.content).toContain('Analyze the 2 notes above from the period 2024-01-01 to 2024-01-31');
			expect(result.estimatedTokens).toBeGreaterThan(0);
		});

		test('should truncate long note content correctly', () => {
			const longContentNotes: FilteredNote[] = [
				{
					file: { path: 'Long Note.md' } as any,
					content: 'A'.repeat(1000), // Very long content
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const result = PromptGenerator.generateInsightPrompt(longContentNotes, mockDateContext);

			expect(result.content).toContain('Long Note');
			// Should contain truncation indicator
			expect(result.content).toContain('...[truncated]');
			// Should not contain the full 1000 'A's 
			expect(result.content).not.toContain('A'.repeat(1000));
		});

		test('should include focus areas when provided', () => {
			const config: Partial<PromptConfig> = {
				focusAreas: ['Project Management', 'Team Collaboration']
			};

			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext, config);

			expect(result.content).toContain('SPECIAL FOCUS AREAS:');
			expect(result.content).toContain('Project Management');
			expect(result.content).toContain('Team Collaboration');
		});

		test('should properly format note titles from file paths', () => {
			const notesWithPaths: FilteredNote[] = [
				{
					file: { path: 'folder/subfolder/Complex Note Name.md' } as any,
					content: 'Content',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const result = PromptGenerator.generateInsightPrompt(notesWithPaths, mockDateContext);

			expect(result.content).toContain('NOTE 1: Complex Note Name');
			// Note: The prompt may contain ".md" in instructions, so check more specifically
			expect(result.content).not.toContain('Complex Note Name.md');
			expect(result.content).not.toContain('folder/subfolder/');
		});

		test('should handle single note', () => {
			const singleNote = [mockNotes[0]];
			const result = PromptGenerator.generateInsightPrompt(singleNote, mockDateContext);

			expect(result.noteCount).toBe(1);
			expect(result.content).toContain('NOTES TO ANALYZE (1 total)');
			expect(result.content).toContain('NOTE 1: Note 1');
		});

		test('should handle empty notes array', () => {
			const result = PromptGenerator.generateInsightPrompt([], mockDateContext);

			expect(result.noteCount).toBe(0);
			expect(result.content).toContain('NOTES TO ANALYZE (0 total)');
		});

		test('should generate correct prompt for folder mode', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockFolderContext);

			expect(result.noteCount).toBe(2);
			expect(result.content).toContain('NOTES TO ANALYZE (2 total)');
			expect(result.content).toContain('Analyze the 2 notes above from the folder "Projects" (projects)');
			expect(result.content).not.toContain('2024-01-01');
			expect(result.content).not.toContain('2024-01-31');
		});

		test('should handle folder mode without folderPath', () => {
			const contextWithoutPath = {
				folderName: 'Projects',
				mode: 'folder' as const
			};

			const result = PromptGenerator.generateInsightPrompt(mockNotes, contextWithoutPath);

			expect(result.content).toContain('from the folder "Projects"');
			expect(result.content).not.toContain('(projects)');
		});
	});

	describe('generateChunkPrompt', () => {
		test('should generate chunk-specific prompts', () => {
			const result = PromptGenerator.buildChunkAnalysisPrompt(
				[mockNotes[0]], 
				0, 
				3, 
				mockDateContext
			);

			expect(result.noteCount).toBe(1);
			expect(result.content).toContain('chunk 1 of 3');
			expect(result.content).toContain('What\'s worth noticing? What stands out?');
		});

		test('should include chunk context', () => {
			const result = PromptGenerator.buildChunkAnalysisPrompt(
				mockNotes, 
				1, 
				2, 
				mockDateContext
			);

			expect(result.content).toContain('chunk 2 of 2');
			expect(result.content).toContain('2024-01-01 to 2024-01-31');
		});

		test('should work with folder context', () => {
			const result = PromptGenerator.buildChunkAnalysisPrompt(
				mockNotes, 
				0, 
				2, 
				mockFolderContext
			);

			expect(result.content).toContain('chunk 1 of 2');
			expect(result.content).toContain('from the folder "Projects"');
			expect(result.content).not.toContain('2024-01-01');
		});
	});

	describe('generateCombinationPrompt', () => {
		const mockChunkSummaries = [
			'Summary 1 content',
			'Summary 2 content'
		];

		test('should combine multiple summaries', () => {
			const result = PromptGenerator.combineSummariesPrompt(
				mockChunkSummaries, 
				10, 
				mockDateContext,
				mockNotes
			);

			expect(result.noteCount).toBe(10);
			expect(result.content).toContain('2 observations');
			expect(result.content).toContain('10 total notes');
			expect(result.content).toContain('CHUNK 1 SUMMARY');
			expect(result.content).toContain('CHUNK 2 SUMMARY');
		});

		test('should include date context', () => {
			const result = PromptGenerator.combineSummariesPrompt(
				mockChunkSummaries, 
				10, 
				mockDateContext,
				mockNotes
			);

			expect(result.content).toContain('2024-01-01 to 2024-01-31');
		});

		test('should include folder context', () => {
			const result = PromptGenerator.combineSummariesPrompt(
				mockChunkSummaries, 
				10, 
				mockFolderContext,
				mockNotes
			);

			expect(result.content).toContain('from the folder "Projects"');
			expect(result.content).not.toContain('2024-01-01');
		});

		test('should preserve chunk boundaries', () => {
			const result = PromptGenerator.combineSummariesPrompt(
				mockChunkSummaries, 
				10, 
				mockDateContext,
				mockNotes
			);

			expect(result.content).toContain('--- CHUNK 1 SUMMARY ---');
			expect(result.content).toContain('--- CHUNK 2 SUMMARY ---');
			expect(result.content).toContain('Summary 1 content');
			expect(result.content).toContain('Summary 2 content');
		});

		test('should provide freeform writing instructions with note references', () => {
			const config: Partial<PromptConfig> = {
				insightStyle: 'freeform'
			};

			const result = PromptGenerator.combineSummariesPrompt(
				mockChunkSummaries, 
				10, 
				mockDateContext,
				mockNotes,
				config
			);

			expect(result.content).toContain('📋 OUTPUT INSTRUCTIONS:');
			expect(result.content).toContain('Write in a freeform, natural voice');
			expect(result.content).toContain('Do not require specific sections or headings');
			expect(result.content).toContain('## Notes Referenced');
			expect(result.content).toContain('- [[Note 1]]: This is the content of note 1. It contains important information about...');
			expect(result.content).toContain('- [[Note 2]]: Note 2 content with different topics and some action items to complete.');
			expect(result.content).toContain('Write in freeform style and end with a "Notes Referenced" section');
		});

		test('should use structured format by default in combineSummariesPrompt', () => {
			const result = PromptGenerator.combineSummariesPrompt(
				mockChunkSummaries, 
				10, 
				mockDateContext,
				mockNotes
			);

			expect(result.content).toContain('### 📋 CRITICAL OUTPUT REQUIREMENTS:');
			expect(result.content).toContain('## Key Themes');
			expect(result.content).toContain('## Notes Referenced');
			expect(result.content).toContain('Follow the structured format with clear headings');
		});
	});

	describe('validatePromptSize', () => {
		test('should return true for prompts within limit', () => {
			const smallPrompt: GeneratedPrompt = {
				content: 'Small prompt',
				noteCount: 1,
				estimatedTokens: 1000
			};

			expect(PromptGenerator.validatePromptSize(smallPrompt, 5000)).toBe(true);
		});

		test('should return false for prompts exceeding limit', () => {
			const largePrompt: GeneratedPrompt = {
				content: 'Large prompt',
				noteCount: 1,
				estimatedTokens: 10000
			};

			expect(PromptGenerator.validatePromptSize(largePrompt, 5000)).toBe(false);
		});

		test('should use default limit when none provided', () => {
			const hugePrompt: GeneratedPrompt = {
				content: 'Huge prompt',
				noteCount: 1,
				estimatedTokens: 200000
			};

			expect(PromptGenerator.validatePromptSize(hugePrompt)).toBe(false);
		});

		test('should handle edge case at exact limit', () => {
			const exactPrompt: GeneratedPrompt = {
				content: 'Exact limit prompt',
				noteCount: 1,
				estimatedTokens: 5000
			};

			expect(PromptGenerator.validatePromptSize(exactPrompt, 5000)).toBe(true);
		});
	});

	describe('prompt structure and formatting', () => {
		test('should include all required output format instructions', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			// Default should be structured
			expect(result.content).toContain('### 📋 CRITICAL OUTPUT REQUIREMENTS:');
			expect(result.content).toContain('### 🧱 OUTPUT STRUCTURE:');
			expect(result.content).toContain('# Insight Summary');
			expect(result.content).toContain('## Key Themes');
			expect(result.content).toContain('## Important People');
			expect(result.content).toContain('## Action Items & Next Steps');
			expect(result.content).toContain('## Notes Referenced');
		});

		test('should provide clear analysis instructions', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			expect(result.content).toContain('ANALYSIS INSTRUCTIONS:');
			expect(result.content).toContain('**Themes**: Identify recurring topics');
			expect(result.content).toContain('**People**: Extract mentions of individuals');
			expect(result.content).toContain('**Actions**: Find tasks, decisions, commitments');
			expect(result.content).toContain('**Connections**: Look for relationships');
		});

		test('should include approach guidelines', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			expect(result.content).toContain('Approach:');
			expect(result.content).toContain('Call out what you actually see');
			expect(result.content).toContain('shows up repeatedly');
			expect(result.content).toContain('make sense based on what\'s written');
		});

		test('should use structured format by default', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			expect(result.content).toContain('### 📋 CRITICAL OUTPUT REQUIREMENTS:');
			expect(result.content).toContain('## Key Themes');
			expect(result.content).toContain('## Important People');
			expect(result.content).toContain('## Action Items & Next Steps');
		});
	});

	describe('token estimation', () => {
		test('should estimate tokens based on content length', () => {
			const shortNotes: FilteredNote[] = [{
				file: { path: 'short.md' } as any,
				content: 'Short',
				createdTime: Date.now(),
				modifiedTime: Date.now()
			}];

			const longNotes: FilteredNote[] = [{
				file: { path: 'long.md' } as any,
				content: 'A'.repeat(1000),
				createdTime: Date.now(),
				modifiedTime: Date.now()
			}];

			const shortResult = PromptGenerator.generateInsightPrompt(shortNotes, mockDateContext);
			const longResult = PromptGenerator.generateInsightPrompt(longNotes, mockDateContext);

			expect(longResult.estimatedTokens).toBeGreaterThan(shortResult.estimatedTokens);
		});

		test('should provide reasonable token estimates', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			// Should be at least some tokens for the prompt structure
			expect(result.estimatedTokens).toBeGreaterThan(100);
			// Should not be unreasonably high for simple notes
			expect(result.estimatedTokens).toBeLessThan(10000);
		});
	});

	describe('insight style configuration', () => {
		test('should generate structured format when insightStyle is structured', () => {
			const config: Partial<PromptConfig> = {
				insightStyle: 'structured'
			};

			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext, config);

			expect(result.content).toContain('### 📋 CRITICAL OUTPUT REQUIREMENTS:');
			expect(result.content).toContain('### 🧱 OUTPUT STRUCTURE:');
			expect(result.content).toContain('# Insight Summary');
			expect(result.content).toContain('## Key Themes');
			expect(result.content).toContain('## Important People');
			expect(result.content).toContain('## Action Items & Next Steps');
			expect(result.content).toContain('## Notes Referenced');
		});

		test('should generate freeform format when insightStyle is freeform', () => {
			const config: Partial<PromptConfig> = {
				insightStyle: 'freeform'
			};

			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext, config);

			expect(result.content).toContain('📋 OUTPUT INSTRUCTIONS:');
			expect(result.content).toContain('Write in a freeform, natural voice');
			expect(result.content).toContain('Do not require specific sections or headings');
			expect(result.content).toContain('## Notes Referenced');
			// Should NOT contain structured headings
			expect(result.content).not.toContain('## Key Themes');
			expect(result.content).not.toContain('## Important People');
			expect(result.content).not.toContain('## Action Items & Next Steps');
		});

		test('should default to structured format when no insightStyle is specified', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			expect(result.content).toContain('### 📋 CRITICAL OUTPUT REQUIREMENTS:');
			expect(result.content).toContain('## Key Themes');
			expect(result.content).toContain('## Important People');
			expect(result.content).toContain('## Action Items & Next Steps');
		});

		test('should include Notes Referenced section in both modes', () => {
			const structuredResult = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext, { insightStyle: 'structured' });
			const freeformResult = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext, { insightStyle: 'freeform' });

			expect(structuredResult.content).toContain('## Notes Referenced');
			expect(freeformResult.content).toContain('## Notes Referenced');
			expect(structuredResult.content).toContain('- [[Note 1]]: This is the content of note 1. It contains important information about...');
			expect(freeformResult.content).toContain('- [[Note 1]]: This is the content of note 1. It contains important information about...');
			expect(structuredResult.content).toContain('- [[Note 2]]: Note 2 content with different topics and some action items to complete.');
			expect(freeformResult.content).toContain('- [[Note 2]]: Note 2 content with different topics and some action items to complete.');
		});
	});

	describe('combineSummariesPrompt with insight styles', () => {
		const mockChunkSummaries = [
			'Summary 1 content',
			'Summary 2 content'
		];

		test('should respect structured style in combineSummariesPrompt', () => {
			const config: Partial<PromptConfig> = {
				insightStyle: 'structured'
			};

			const result = PromptGenerator.combineSummariesPrompt(
				mockChunkSummaries, 
				10, 
				mockDateContext,
				mockNotes,
				config
			);

			expect(result.content).toContain('### 📋 CRITICAL OUTPUT REQUIREMENTS:');
			expect(result.content).toContain('### 🧱 OUTPUT STRUCTURE:');
			expect(result.content).toContain('# Insight Summary');
			expect(result.content).toContain('## Key Themes');
			expect(result.content).toContain('Follow the structured format with clear headings');
		});

		test('should respect freeform style in combineSummariesPrompt', () => {
			const config: Partial<PromptConfig> = {
				insightStyle: 'freeform'
			};

			const result = PromptGenerator.combineSummariesPrompt(
				mockChunkSummaries, 
				10, 
				mockDateContext,
				mockNotes,
				config
			);

			expect(result.content).toContain('📋 OUTPUT INSTRUCTIONS:');
			expect(result.content).toContain('Write in a freeform, natural voice');
			expect(result.content).toContain('Write in freeform style and end with a "Notes Referenced" section');
			// Should NOT contain structured headings
			expect(result.content).not.toContain('## Key Themes');
			expect(result.content).not.toContain('## Important People');
		});

		test('should default to structured in combineSummariesPrompt when no config provided', () => {
			const result = PromptGenerator.combineSummariesPrompt(
				mockChunkSummaries, 
				10, 
				mockDateContext,
				mockNotes
			);

			expect(result.content).toContain('### 📋 CRITICAL OUTPUT REQUIREMENTS:');
			expect(result.content).toContain('## Key Themes');
		});
	});

	describe('generateNotesReferencedSection', () => {
		test('should generate Notes Referenced section with content from notes', () => {
			const notesWithContent: FilteredNote[] = [
				{
					file: { path: 'Note 1.md' } as any,
					content: 'This is the first meaningful line\nAnd this is another line',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				},
				{
					file: { path: 'Note 2.md' } as any,
					content: '# Header\n\nThis note starts with a header but this line should be extracted',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];
			
			// Access the private method for testing using TypeScript bracket notation
			const result = (PromptGenerator as any).generateNotesReferencedSection(notesWithContent);
			
			expect(result).toContain('## Notes Referenced');
			expect(result).toContain('- [[Note 1]]: This is the first meaningful line');
			expect(result).toContain('- [[Note 2]]: This note starts with a header but this line should be extracted');
		});

		test('should handle empty notes array', () => {
			const result = (PromptGenerator as any).generateNotesReferencedSection([]);
			
			expect(result).toContain('## Notes Referenced');
			expect(result).toContain('[No notes were analyzed]');
		});

		test('should use witty fallbacks for notes with no meaningful content', () => {
			const emptyNotes: FilteredNote[] = [
				{
					file: { path: 'Empty Note.md' } as any,
					content: '',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				},
				{
					file: { path: 'Header Only.md' } as any,
					content: '# Just a header\n## Another header',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				},
				{
					file: { path: 'Frontmatter Only.md' } as any,
					content: '---\ntitle: Test\ndate: 2024-01-01\n---',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const result = (PromptGenerator as any).generateNotesReferencedSection(emptyNotes);
			
			expect(result).toContain('## Notes Referenced');
			expect(result).toContain('- [[Empty Note]]:');
			expect(result).toContain('- [[Header Only]]:');
			expect(result).toContain('- [[Frontmatter Only]]:');
			
			// Should contain one of the witty fallbacks
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
			
			const hasWittyFallback = wittyFallbacks.some(fallback => result.includes(fallback));
			expect(hasWittyFallback).toBe(true);
		});

		test('should truncate long content lines to 80 characters', () => {
			const longContentNote: FilteredNote[] = [
				{
					file: { path: 'Long Note.md' } as any,
					content: 'This is a very long line that should definitely be truncated because it exceeds the eighty character limit by quite a bit and would make the notes section unwieldy',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const result = (PromptGenerator as any).generateNotesReferencedSection(longContentNote);
			
			expect(result).toContain('## Notes Referenced');
			expect(result).toContain('- [[Long Note]]: This is a very long line that should definitely be truncated because it...');
			
			// Extract the observation part and verify it's properly truncated
			const match = result.match(/- \[\[Long Note\]\]: (.+)/);
			expect(match).toBeTruthy();
			if (match) {
				expect(match[1].length).toBeLessThanOrEqual(80);
				expect(match[1].endsWith('...')).toBe(true);
			}
		});

		test('should extract note titles correctly from file paths', () => {
			const notesWithPaths: FilteredNote[] = [
				{
					file: { path: 'folder/subfolder/Complex Note Name.md' } as any,
					content: 'Some meaningful content here',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				},
				{
					file: { path: 'Another Note.md' } as any,
					content: 'More content',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const result = (PromptGenerator as any).generateNotesReferencedSection(notesWithPaths);
			
			expect(result).toContain('- [[Complex Note Name]]: Some meaningful content here');
			expect(result).toContain('- [[Another Note]]: More content');
			expect(result).not.toContain('.md');
			expect(result).not.toContain('folder/subfolder/');
		});

		test('should skip markdown headers and frontmatter when extracting content', () => {
			const noteWithHeaders: FilteredNote[] = [
				{
					file: { path: 'Structured Note.md' } as any,
					content: '---\ntitle: My Note\ntags: [test]\n---\n\n# Main Header\n\n## Sub Header\n\nThis is the actual content that should be extracted.\n\nMore content below.',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const result = (PromptGenerator as any).generateNotesReferencedSection(noteWithHeaders);
			
			expect(result).toContain('- [[Structured Note]]: This is the actual content that should be extracted.');
			expect(result).not.toContain('title: My Note');
			expect(result).not.toContain('# Main Header');
			expect(result).not.toContain('## Sub Header');
		});

		test('should format multiple notes correctly', () => {
			const multipleNotes: FilteredNote[] = [
				{
					file: { path: 'Note 1.md' } as any,
					content: 'First note content',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				},
				{
					file: { path: 'Note 2.md' } as any,
					content: 'Second note content',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const result = (PromptGenerator as any).generateNotesReferencedSection(multipleNotes);
			
			expect(result.split('\n')).toHaveLength(3); // Header + 2 note lines
			expect(result).toMatch(/^## Notes Referenced\n- \[\[Note 1\]\]: First note content\n- \[\[Note 2\]\]: Second note content$/);
		});
	});

	describe('include Notes Referenced section at the end', () => {
		test('should include Notes Referenced section at the end', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			expect(result.content).toContain('## Notes Referenced');
			expect(result.content).toContain('- [[Note 1]]: This is the content of note 1. It contains important information about...');
			expect(result.content).toContain('- [[Note 2]]: Note 2 content with different topics and some action items to complete.');
			// Should be at the end
			expect(result.content.endsWith('- [[Note 2]]: Note 2 content with different topics and some action items to complete.')).toBe(true);
		});

		test('should place Notes Referenced section at end in both styles', () => {
			const structuredResult = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext, { insightStyle: 'structured' });
			const freeformResult = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext, { insightStyle: 'freeform' });

			// Both should end with Notes Referenced section
			expect(structuredResult.content).toContain('## Notes Referenced');
			expect(freeformResult.content).toContain('## Notes Referenced');
			expect(structuredResult.content.endsWith('- [[Note 2]]: Note 2 content with different topics and some action items to complete.')).toBe(true);
			expect(freeformResult.content.endsWith('- [[Note 2]]: Note 2 content with different topics and some action items to complete.')).toBe(true);
		});
	});
}); 