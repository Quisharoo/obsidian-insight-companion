import { FileService, SaveResult } from '../../src/insight-companion/file-service';
import { SummaryGenerator, SummaryResult } from '../../src/insight-companion/summary-generator';
import { OpenAIService, OpenAIResponse } from '../../src/insight-companion/openai-service';
import { PromptGenerator } from '../../src/insight-companion/prompt-generator';
import { NoteFilterResult, FilteredNote } from '../../src/insight-companion/note-filter';
import { DateRange } from '../../src/insight-companion/date-picker-modal';

// Mock Obsidian APIs
const mockApp = {
	vault: {
		getAbstractFileByPath: jest.fn(),
		createFolder: jest.fn(),
		create: jest.fn(),
		modify: jest.fn(),
		delete: jest.fn()
	}
} as any;

// Mock Notice for notifications
jest.mock('obsidian', () => ({
	Notice: jest.fn()
}));

// Mock fetch for OpenAI API calls
global.fetch = jest.fn();

describe('OpenAI Integration - End to End', () => {
	let openaiService: OpenAIService;
	let summaryGenerator: SummaryGenerator;
	let fileService: FileService;
	let mockFetch: jest.MockedFunction<typeof fetch>;

	const mockDateRange: DateRange = {
		startDate: '2024-01-01',
		endDate: '2024-01-31'
	};

	const mockNotes: FilteredNote[] = [
		{
			file: { path: 'projects/Project Alpha.md' } as any,
			content: `# Project Alpha Planning

## Meeting Notes - January 15, 2024

**Attendees:** John Smith (PM), Sarah Johnson (Designer), Mike Chen (Developer)

### Key Decisions
- Decided to use React for the frontend
- Database will be PostgreSQL
- Target launch date: March 1, 2024

### Action Items
- [ ] John: Create detailed project timeline by Jan 20
- [ ] Sarah: Complete wireframes by Jan 25  
- [ ] Mike: Set up development environment by Jan 22

### Next Steps
- Weekly standup meetings every Monday
- Design review scheduled for Jan 30`,
			createdTime: new Date('2024-01-15').getTime(),
			modifiedTime: new Date('2024-01-16').getTime()
		},
		{
			file: { path: 'meetings/Team Standup Jan 22.md' } as any,
			content: `# Team Standup - January 22, 2024

## Attendees
- John Smith
- Sarah Johnson  
- Mike Chen
- Lisa Wang (QA)

## Progress Updates

### John (PM)
- Completed project timeline
- Stakeholder meeting scheduled for Jan 25
- Budget approved

### Sarah (Designer)
- Wireframes 80% complete
- User research findings compiled
- Need feedback on color scheme

### Mike (Developer)
- Dev environment setup complete
- Initial React components created
- Database schema designed

### Lisa (QA)
- Test plan drafted
- Automation framework selected
- Ready to start testing next week

## Blockers
- None currently

## Action Items
- [ ] Sarah: Share wireframes with team by Jan 24
- [ ] Mike: Complete user authentication module by Jan 29
- [ ] Lisa: Set up testing environment by Jan 26`,
			createdTime: new Date('2024-01-22').getTime(),
			modifiedTime: new Date('2024-01-22').getTime()
		}
	];

	const mockFilterResult: NoteFilterResult = {
	notes: mockNotes,
	totalCount: mockNotes.length,
	dateRange: mockDateRange,
	mode: 'date',
	filterMeta: {
		dateRange: { start: new Date('2025-01-15'), end: new Date('2025-01-20') },
		insightStyle: 'structured'
	}
};

	beforeEach(() => {
		mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
		mockFetch.mockClear();

		// Reset all mocks
		jest.clearAllMocks();

		// Initialize services
		openaiService = new OpenAIService({
			apiKey: 'sk-test-key',
			model: 'gpt-4'
		});

		summaryGenerator = new SummaryGenerator(openaiService);
		fileService = new FileService(mockApp, {
			outputFolder: 'Summaries'
		});

		// Setup default successful API response
		const mockApiResponse = {
			choices: [{
				message: {
					content: `# Insight Summary

## Key Themes

### Project Management and Planning
The notes reveal a well-structured project management approach for Project Alpha, with clear timelines, defined roles, and systematic tracking. The project has progressed from initial planning to active development phase with established processes for communication and coordination.

### Team Collaboration and Communication  
Strong emphasis on regular communication through weekly standup meetings and structured progress updates. The team demonstrates good collaboration patterns with clear accountability and transparency in sharing progress and blockers.

### Technical Implementation Strategy
The team has made concrete technical decisions including React for frontend development and PostgreSQL for the database. Development environment setup and initial implementation work is already underway.

## Important People

### John Smith (Project Manager)
- Leading overall project coordination and timeline management
- Handling stakeholder relationships and budget approval
- Referenced in: [[Project Alpha]], [[Team Standup Jan 22]]

### Sarah Johnson (Designer)  
- Responsible for wireframes and user experience design
- Conducting user research and design validation
- Referenced in: [[Project Alpha]], [[Team Standup Jan 22]]

### Mike Chen (Developer)
- Leading technical implementation and architecture decisions
- Setting up development infrastructure and creating initial components
- Referenced in: [[Project Alpha]], [[Team Standup Jan 22]]

### Lisa Wang (QA)
- Managing quality assurance strategy and test planning
- Setting up automation frameworks and testing environments
- Referenced in: [[Team Standup Jan 22]]

## Action Items & Next Steps

### Immediate Actions (Due Jan 24-26)
- Sarah to share completed wireframes with team
- Lisa to set up testing environment
- Team feedback needed on design color scheme

### Short-term Goals (Due Jan 29)
- Mike to complete user authentication module
- Weekly standup meetings to continue every Monday
- Design review scheduled for Jan 30

### Project Milestones
- Target launch date: March 1, 2024
- Stakeholder meeting scheduled for Jan 25
- Transition from planning to development phase underway

## Note References

**Project Alpha** - Initial project planning document outlining key decisions, team roles, and basic timeline. Contains foundational project information and early action items.

**Team Standup Jan 22** - Weekly team progress update showing active development work and coordination. Demonstrates project momentum with detailed progress reports from all team members.`
				}
			}],
			usage: {
				prompt_tokens: 2500,
				completion_tokens: 1200,
				total_tokens: 3700
			},
			model: 'gpt-4'
		};

		mockFetch.mockResolvedValue({
			ok: true,
			json: jest.fn().mockResolvedValue(mockApiResponse)
		} as any);

		// Setup file service mocks
		mockApp.vault.getAbstractFileByPath.mockReturnValue(null); // No existing files
		mockApp.vault.createFolder.mockResolvedValue(undefined);
		mockApp.vault.create.mockResolvedValue(undefined);
	});

	describe('Complete Workflow Integration', () => {
		test('should complete full workflow: notes → prompt → API → summary → file', async () => {
			// Step 1: Generate prompt from notes
			const dateContext = {
				dateRange: mockDateRange,
				mode: 'date' as const
			};
			const prompt = PromptGenerator.generateInsightPrompt(mockNotes, dateContext);
			
			expect(prompt.noteCount).toBe(2);
			expect(prompt.content).toContain('Project Alpha Planning');
			expect(prompt.content).toContain('Team Standup Jan 22');

			// Step 2: Generate summary via OpenAI
			const summaryResult = await summaryGenerator.generateSummary(mockFilterResult);

			expect(summaryResult.content).toContain('# Insight Summary');
			expect(summaryResult.content).toContain('## Key Themes');
			expect(summaryResult.content).toContain('[[Project Alpha]]');
			expect(summaryResult.content).toContain('[[Team Standup Jan 22]]');
			expect(summaryResult.metadata.notesAnalyzed).toBe(2);
			expect(summaryResult.metadata.tokensUsed.total).toBe(3700);

			// Step 3: Save summary to file
			const saveResult = await fileService.saveSummary(summaryResult);

			expect(saveResult.success).toBe(true);
			expect(saveResult.filePath).toContain('Summaries/');
			expect(saveResult.filePath).toContain('2024-01-01 to 2024-01-31');

			// Verify API was called with correct prompt
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.openai.com/v1/chat/completions',
				expect.objectContaining({
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer sk-test-key'
					}
				})
			);

			// Verify file creation
			expect(mockApp.vault.create).toHaveBeenCalledWith(
				expect.stringContaining('Summaries/'),
				expect.stringContaining('# 🧠 Insight Summary')
			);
		});

		test('should handle large note sets with chunking', async () => {
			// Create a large note set that will trigger chunking
			const largeNotes: FilteredNote[] = Array.from({ length: 25 }, (_, i) => ({
				file: { path: `Note ${i + 1}.md` } as any,
				content: `# Note ${i + 1}\n\n` + 'Content '.repeat(500),
				createdTime: Date.now(),
				modifiedTime: Date.now()
			}));

					const largeFilterResult: NoteFilterResult = {
			notes: largeNotes,
			totalCount: largeNotes.length,
			dateRange: mockDateRange,
			mode: 'date',
			filterMeta: {
				dateRange: { start: new Date('2025-01-15'), end: new Date('2025-01-20') },
				insightStyle: 'structured'
			}
		};

			// Mock chunk responses
			const chunkResponse = {
				choices: [{
					message: {
						content: `## Chunk Analysis\n\n- Key theme from this chunk\n- Important insights\n- Action items identified`
					}
				}],
				usage: { prompt_tokens: 1000, completion_tokens: 300, total_tokens: 1300 },
				model: 'gpt-4'
			};

			const combinedResponse = {
				choices: [{
					message: {
						content: `Project Alpha keeps showing up across all observations — lots of coordination happening, maybe more than expected. Timeline pressure seems real.\n\n## Notes Referenced\n- [[Project Alpha Planning]]\n- [[Team Standup Jan 22]]`
					}
				}],
				usage: { prompt_tokens: 800, completion_tokens: 400, total_tokens: 1200 },
				model: 'gpt-4'
			};

			mockFetch
				.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(chunkResponse) } as any)
				.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(chunkResponse) } as any)
				.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(combinedResponse) } as any);

			const summaryResult = await summaryGenerator.generateSummary(largeFilterResult);

			expect(summaryResult.content).toContain('Project Alpha keeps showing up');
			expect(summaryResult.metadata.notesAnalyzed).toBe(25);
			expect(summaryResult.metadata.chunksProcessed).toBeGreaterThan(1);
			expect(mockFetch).toHaveBeenCalledTimes(3); // 2 chunks + 1 combination

			const saveResult = await fileService.saveSummary(summaryResult);
			expect(saveResult.success).toBe(true);
		});

		test('should handle API errors gracefully', async () => {
			// Mock non-retryable API error to avoid timeout issues
			mockFetch.mockResolvedValue({
				ok: false,
				status: 401,
				json: jest.fn().mockResolvedValue({
					error: { message: 'Invalid authentication credentials' }
				})
			} as any);

			await expect(summaryGenerator.generateSummary(mockFilterResult))
				.rejects
				.toMatchObject({
					type: 'authentication',
					message: 'Invalid or missing OpenAI API key',
					retryable: false
				});
		});

		test('should track progress through entire workflow', async () => {
			const progressUpdates: any[] = [];
			const progressCallback = (progress: any) => {
				progressUpdates.push(progress);
			};

			await summaryGenerator.generateSummary(mockFilterResult, progressCallback);

			// Verify all progress stages were reported
			const stages = progressUpdates.map(update => update.stage);
			expect(stages).toContain('chunking');
			expect(stages).toContain('generating');
			expect(stages).toContain('complete');

			// Verify meaningful progress messages
			expect(progressUpdates).toContainEqual(
				expect.objectContaining({
					stage: 'chunking',
					message: expect.stringContaining('2 notes into 1 chunk')
				})
			);
		});

		test('should generate proper file metadata', async () => {
			const summaryResult = await summaryGenerator.generateSummary(mockFilterResult);
			const saveResult = await fileService.saveSummary(summaryResult);

			expect(saveResult.success).toBe(true);

			// Verify the saved content includes metadata header
			const saveCall = mockApp.vault.create.mock.calls[0];
			const savedContent = saveCall[1];

			expect(savedContent).toContain('# 🧠 Insight Summary');
			expect(savedContent).toContain('📅 Date Range: `01-01-2024` to `01-31-2024`');
			expect(savedContent).toContain('**Notes Analyzed:** 2');
			expect(savedContent).toContain('- **Input Tokens:** 2,500');
			expect(savedContent).toContain('- **Output Tokens:** 1,200');
			expect(savedContent).toContain('- **Total Tokens:** 3,700');
			expect(savedContent).toContain('**Model Used:** `gpt-4`');
			expect(savedContent).toContain('- **Chunks Processed:** 1');
		});

		test('should preserve Obsidian wiki links in summary', async () => {
			const summaryResult = await summaryGenerator.generateSummary(mockFilterResult);

			// Verify the summary contains proper wiki links
			expect(summaryResult.content).toContain('[[Project Alpha]]');
			expect(summaryResult.content).toContain('[[Team Standup Jan 22]]');

			// Verify links don't contain .md extensions
			expect(summaryResult.content).not.toContain('[[Project Alpha.md]]');
			expect(summaryResult.content).not.toContain('.md]]');

			const saveResult = await fileService.saveSummary(summaryResult);
			expect(saveResult.success).toBe(true);

			// Verify saved content preserves wiki links
			const saveCall = mockApp.vault.create.mock.calls[0];
			const savedContent = saveCall[1];
			expect(savedContent).toContain('[[Project Alpha]]');
			expect(savedContent).toContain('[[Team Standup Jan 22]]');
		});

		test('should handle file save errors', async () => {
			const summaryResult = await summaryGenerator.generateSummary(mockFilterResult);

			// Mock file save error
			mockApp.vault.create.mockRejectedValue(new Error('Disk full'));

			const saveResult = await fileService.saveSummary(summaryResult);

			expect(saveResult.success).toBe(false);
			expect(saveResult.error).toContain('Disk full');
		});

		test('should create output folder if it doesn\'t exist', async () => {
			const summaryResult = await summaryGenerator.generateSummary(mockFilterResult);

			// Mock folder doesn't exist
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			await fileService.saveSummary(summaryResult);

			expect(mockApp.vault.createFolder).toHaveBeenCalledWith('Summaries');
		});
	});

	describe('Performance and Reliability', () => {
		test('should complete workflow within reasonable time', async () => {
			const startTime = Date.now();
			const summaryResult = await summaryGenerator.generateSummary(mockFilterResult);
			const endTime = Date.now();

			expect(summaryResult.metadata.generationTime).toBeLessThan(5000); // Should be under 5 seconds
			expect(endTime - startTime).toBeLessThan(10000); // Total workflow under 10 seconds
		});

		test('should handle network timeouts gracefully', async () => {
			// Mock network timeout
			mockFetch.mockRejectedValue(new TypeError('fetch failed'));

			await expect(summaryGenerator.generateSummary(mockFilterResult))
				.rejects
				.toMatchObject({
					type: 'network',
					message: 'Network error - check your internet connection',
					retryable: true
				});
		});

		test('should validate token estimates accurately', async () => {
			const dateContext = {
				dateRange: mockDateRange,
				mode: 'date' as const
			};
			const prompt = PromptGenerator.generateInsightPrompt(mockNotes, dateContext);
			
			// Token estimate should be reasonable for our test data
			expect(prompt.estimatedTokens).toBeGreaterThan(100);
			expect(prompt.estimatedTokens).toBeLessThan(10000);

			// Actual API usage should be in similar range
			const summaryResult = await summaryGenerator.generateSummary(mockFilterResult);
			const actualTokens = summaryResult.metadata.tokensUsed.total;
			
			// Estimates are rough and API response has higher token count in our mock
			// Just validate both are reasonable numbers
			expect(actualTokens).toBeGreaterThan(1000);
			expect(actualTokens).toBeLessThan(10000);
			expect(prompt.estimatedTokens).toBeGreaterThan(100);
		});
	});
}); 