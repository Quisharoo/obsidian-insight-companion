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
			// Should not contain all 1000 'A's due to truncation
			expect(result.content).not.toContain('A'.repeat(200));
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
		test('should generate chunk prompt with proper indexing', () => {
			const result = PromptGenerator.generateChunkPrompt(
				mockNotes, 
				1, // chunk index
				3, // total chunks
				mockDateRange
			);

			expect(result.noteCount).toBe(2);
			expect(result.content).toContain('chunk 2 of 3');
			expect(result.content).toContain('part 2 of 3 total chunks');
			expect(result.content).toContain('partial insight summary');
		});

		test('should include analysis instructions for chunks', () => {
			const result = PromptGenerator.generateChunkPrompt(mockNotes, 0, 2, mockDateRange);

			expect(result.content).toContain('Key themes in this chunk');
			expect(result.content).toContain('Important people mentioned');
			expect(result.content).toContain('Action items identified');
			expect(result.content).toContain('Notable insights or patterns');
		});

		test('should mention it will be combined with other chunks', () => {
			const result = PromptGenerator.generateChunkPrompt(mockNotes, 0, 2, mockDateRange);

			expect(result.content).toContain('combined with other chunk analyses');
		});
	});

	describe('generateCombinationPrompt', () => {
		const mockChunkSummaries = [
			'# Chunk 1 Summary\n\nKey themes: Project planning\nPeople: John, Jane\nActions: Complete design',
			'# Chunk 2 Summary\n\nKey themes: Team meetings\nPeople: Bob, Alice\nActions: Schedule review'
		];

		test('should generate combination prompt with all summaries', () => {
			const result = PromptGenerator.generateCombinationPrompt(
				mockChunkSummaries, 
				10, 
				mockDateRange
			);

			expect(result.noteCount).toBe(10);
			expect(result.content).toContain('CHUNK 1 SUMMARY');
			expect(result.content).toContain('CHUNK 2 SUMMARY');
			expect(result.content).toContain('Project planning');
			expect(result.content).toContain('Team meetings');
		});

		test('should include comprehensive analysis structure', () => {
			const result = PromptGenerator.generateCombinationPrompt(
				mockChunkSummaries, 
				5, 
				mockDateRange
			);

			expect(result.content).toContain('# Insight Summary');
			expect(result.content).toContain('## Key Themes');
			expect(result.content).toContain('## Important People');
			expect(result.content).toContain('## Action Items & Next Steps');
			expect(result.content).toContain('## Cross-Chunk Insights');
			expect(result.content).toContain('## Note References');
		});

		test('should preserve wiki links instruction', () => {
			const result = PromptGenerator.generateCombinationPrompt(
				mockChunkSummaries, 
				5, 
				mockDateRange
			);

			expect(result.content).toContain('[[Note Title]]');
			expect(result.content).toContain('properly formatted for Obsidian');
		});

		test('should mention total note count', () => {
			const result = PromptGenerator.generateCombinationPrompt(
				mockChunkSummaries, 
				15, 
				mockDateRange
			);

			expect(result.content).toContain('15 total notes');
			expect(result.content).toContain('2024-01-01 to 2024-01-31');
		});

		test('should handle single chunk summary', () => {
			const singleSummary = [mockChunkSummaries[0]];
			const result = PromptGenerator.generateCombinationPrompt(
				singleSummary, 
				3, 
				mockDateRange
			);

			expect(result.content).toContain('CHUNK 1 SUMMARY');
			expect(result.content).not.toContain('CHUNK 2 SUMMARY');
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

					expect(result.content).toContain('clean Markdown without code block fences');
		expect(result.content).toContain('[[Note Title]]');
		expect(result.content).toContain('clickable'); // The word "clickable" appears in instructions
		expect(result.content).toContain('# Insight Summary');
			expect(result.content).toContain('## Key Themes');
			expect(result.content).toContain('## Important People');
			expect(result.content).toContain('## Action Items & Next Steps');
		});

		test('should provide clear analysis instructions', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			expect(result.content).toContain('ANALYSIS INSTRUCTIONS:');
			expect(result.content).toContain('**Themes**: Identify recurring topics');
			expect(result.content).toContain('**People**: Extract mentions of individuals');
			expect(result.content).toContain('**Actions**: Find tasks, decisions, commitments');
			expect(result.content).toContain('**Connections**: Look for relationships');
		});

		test('should include quality guidelines', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			expect(result.content).toContain('Quality guidelines:');
			expect(result.content).toContain('Be specific and evidence-based');
			expect(result.content).toContain('Prioritize actionable insights');
			expect(result.content).toContain('Suggest logical next steps');
		});

		test('should emphasize Obsidian compatibility', () => {
			const result = PromptGenerator.generateInsightPrompt(mockNotes, mockDateContext);

			expect(result.content).toContain('Obsidian compatibility');
			expect(result.content).toContain('without .md extension');
			expect(result.content).toContain('exact note titles');
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
}); 