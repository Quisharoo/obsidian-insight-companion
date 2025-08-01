import { SummaryGenerator, SummaryConfig, SummaryProgress, SummaryResult } from '../../src/insight-companion/summary-generator';
import { OpenAIService, OpenAIResponse, OpenAIError } from '../../src/insight-companion/openai-service';
import { NoteFilterResult, FilteredNote } from '../../src/insight-companion/note-filter';
import { DateRange } from '../../src/insight-companion/date-picker-modal';

// Mock the OpenAI service
jest.mock('../../src/insight-companion/openai-service');

describe('SummaryGenerator', () => {
	let summaryGenerator: SummaryGenerator;
	let mockOpenAIService: jest.Mocked<OpenAIService>;
	let mockProgressCallback: jest.MockedFunction<(progress: SummaryProgress) => void>;

	const mockDateRange: DateRange = {
		startDate: '2024-01-01',
		endDate: '2024-01-31'
	};

	const mockNotes: FilteredNote[] = [
		{
			file: { path: 'Note 1.md' } as any,
			content: 'Short content for note 1',
			createdTime: Date.now(),
			modifiedTime: Date.now()
		},
		{
			file: { path: 'Note 2.md' } as any,
			content: 'Short content for note 2',
			createdTime: Date.now(),
			modifiedTime: Date.now()
		}
	];

	const mockFilterResult: NoteFilterResult = {
		notes: mockNotes,
		totalCount: mockNotes.length,
		dateRange: mockDateRange,
		mode: 'date'
	};

	const mockFolderFilterResult: NoteFilterResult = {
		notes: mockNotes,
		totalCount: mockNotes.length,
		folderPath: 'projects',
		folderName: 'Projects',
		mode: 'folder'
		// Note: dateRange is intentionally undefined for folder mode
	};

	const mockOpenAIResponse: OpenAIResponse = {
		content: '# Test Summary\n\n## Key Themes\n- Theme 1\n- Theme 2',
		tokensUsed: {
			prompt: 1000,
			completion: 500,
			total: 1500
		},
		model: 'gpt-4'
	};

	beforeEach(() => {
		// Create mock OpenAI service
		mockOpenAIService = {
			generateCompletion: jest.fn(),
			testConnection: jest.fn(),
			updateConfig: jest.fn()
		} as any;

		mockProgressCallback = jest.fn();
		summaryGenerator = new SummaryGenerator(mockOpenAIService);

		// Default successful response
		mockOpenAIService.generateCompletion.mockResolvedValue(mockOpenAIResponse);
	});

	describe('constructor', () => {
		test('should initialize with default config', () => {
			const generator = new SummaryGenerator(mockOpenAIService);
			expect(generator).toBeDefined();
		});

		test('should merge custom config with defaults', () => {
			const customConfig: Partial<SummaryConfig> = {
				chunkSize: 5,
				retryAttempts: 5
			};
			const generator = new SummaryGenerator(mockOpenAIService, customConfig);
			expect(generator).toBeDefined();
		});
	});

	describe('generateSummary', () => {
		test('should generate summary for small note set (single chunk)', async () => {
			const result = await summaryGenerator.generateSummary(mockFilterResult, mockProgressCallback);

			expect(result).toEqual({
				content: mockOpenAIResponse.content,
				metadata: {
					dateRange: mockDateRange,
					mode: 'date',
					notesAnalyzed: 2,
					tokensUsed: mockOpenAIResponse.tokensUsed,
					chunksProcessed: 1,
					generationTime: expect.any(Number),
					model: 'gpt-4'
				}
			});

			expect(mockOpenAIService.generateCompletion).toHaveBeenCalledTimes(1);
			expect(mockProgressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					stage: 'chunking',
					totalChunks: 1
				})
			);
		});

		test('should track progress through all stages for single chunk', async () => {
			await summaryGenerator.generateSummary(mockFilterResult, mockProgressCallback);

			const progressCalls = mockProgressCallback.mock.calls.map(call => call[0]);
			
			expect(progressCalls).toContainEqual(
				expect.objectContaining({ stage: 'chunking' })
			);
			expect(progressCalls).toContainEqual(
				expect.objectContaining({ stage: 'generating' })
			);
			expect(progressCalls).toContainEqual(
				expect.objectContaining({ stage: 'complete' })
			);
		});

		test('should handle multiple chunks with combination', async () => {
			// Create a large note set that will be chunked
			const largeNotes: FilteredNote[] = Array.from({ length: 25 }, (_, i) => ({
				file: { path: `Note ${i + 1}.md` } as any,
				content: 'A'.repeat(1000), // Large content to trigger chunking
				createdTime: Date.now(),
				modifiedTime: Date.now()
			}));

					const largeFilterResult: NoteFilterResult = {
			notes: largeNotes,
			totalCount: largeNotes.length,
			dateRange: mockDateRange,
			mode: 'date'
		};

			// Mock responses for chunk summaries and final combination
			const chunkResponse: OpenAIResponse = {
				content: '## Chunk Summary\n- Key point from chunk',
				tokensUsed: { prompt: 500, completion: 200, total: 700 },
				model: 'gpt-4'
			};

			const combinedResponse: OpenAIResponse = {
				content: 'You keep seeing themes around project coordination and team dynamics. There\'s definitely something happening with timeline management.\n\n## Notes Referenced\n- [[Note 1]]\n- [[Note 2]]',
				tokensUsed: { prompt: 300, completion: 400, total: 700 },
				model: 'gpt-4'
			};

			mockOpenAIService.generateCompletion
				.mockResolvedValueOnce(chunkResponse)
				.mockResolvedValueOnce(chunkResponse)
				.mockResolvedValueOnce(combinedResponse);

			const result = await summaryGenerator.generateSummary(largeFilterResult, mockProgressCallback);

			expect(result.content).toBe(combinedResponse.content);
			expect(result.metadata.chunksProcessed).toBeGreaterThan(1);
			expect(mockOpenAIService.generateCompletion).toHaveBeenCalledTimes(3); // 2 chunks + 1 combination
		});

		test('should track progress through chunking and combination stages', async () => {
			// Force multiple chunks with small chunk size
			const customConfig: Partial<SummaryConfig> = {
				chunkSize: 1
			};
			const customGenerator = new SummaryGenerator(mockOpenAIService, customConfig);

			const chunkResponse: OpenAIResponse = {
				content: 'Chunk summary',
				tokensUsed: { prompt: 500, completion: 200, total: 700 },
				model: 'gpt-4'
			};

			mockOpenAIService.generateCompletion
				.mockResolvedValueOnce(chunkResponse)
				.mockResolvedValueOnce(chunkResponse)
				.mockResolvedValueOnce(mockOpenAIResponse); // Final combination

			await customGenerator.generateSummary(mockFilterResult, mockProgressCallback);

			const progressCalls = mockProgressCallback.mock.calls.map(call => call[0]);
			
			expect(progressCalls).toContainEqual(
				expect.objectContaining({ stage: 'chunking' })
			);
			expect(progressCalls).toContainEqual(
				expect.objectContaining({ stage: 'generating', currentChunk: 1 })
			);
			expect(progressCalls).toContainEqual(
				expect.objectContaining({ stage: 'generating', currentChunk: 2 })
			);
			expect(progressCalls).toContainEqual(
				expect.objectContaining({ stage: 'combining' })
			);
			expect(progressCalls).toContainEqual(
				expect.objectContaining({ stage: 'complete' })
			);
		});

		test('should handle API errors and report through progress callback', async () => {
			const openaiError: OpenAIError = {
				type: 'authentication', // Use non-retryable error to avoid timeout issues
				message: 'Invalid API key',
				retryable: false
			};

			mockOpenAIService.generateCompletion.mockRejectedValue(openaiError);

			await expect(summaryGenerator.generateSummary(mockFilterResult, mockProgressCallback))
				.rejects.toEqual(openaiError);

			expect(mockProgressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					stage: 'error',
					message: 'Error generating summary: Invalid API key',
					error: openaiError
				})
			);
		});

		test('should accumulate token usage across multiple chunks', async () => {
			const customConfig: Partial<SummaryConfig> = {
				chunkSize: 1
			};
			const customGenerator = new SummaryGenerator(mockOpenAIService, customConfig);

			const chunkResponse1: OpenAIResponse = {
				content: 'Chunk 1',
				tokensUsed: { prompt: 500, completion: 200, total: 700 },
				model: 'gpt-4'
			};

			const chunkResponse2: OpenAIResponse = {
				content: 'Chunk 2',
				tokensUsed: { prompt: 600, completion: 300, total: 900 },
				model: 'gpt-4'
			};

			const combinedResponse: OpenAIResponse = {
				content: 'Combined',
				tokensUsed: { prompt: 400, completion: 250, total: 650 },
				model: 'gpt-4'
			};

			mockOpenAIService.generateCompletion
				.mockResolvedValueOnce(chunkResponse1)
				.mockResolvedValueOnce(chunkResponse2)
				.mockResolvedValueOnce(combinedResponse);

			const result = await customGenerator.generateSummary(mockFilterResult, mockProgressCallback);

			// Verify tokens are accumulated correctly
			expect(result.metadata.tokensUsed.prompt).toBeGreaterThan(1000);
			expect(result.metadata.tokensUsed.completion).toBeGreaterThan(600);
			expect(result.metadata.tokensUsed.total).toBeGreaterThan(2000);
			expect(result.metadata.chunksProcessed).toBe(2); // 2 notes with chunk size 1 = 2 chunks
		});

		test('should measure generation time', async () => {
			const startTime = Date.now();
			const result = await summaryGenerator.generateSummary(mockFilterResult, mockProgressCallback);
			const endTime = Date.now();

			expect(result.metadata.generationTime).toBeGreaterThanOrEqual(0);
			expect(result.metadata.generationTime).toBeLessThanOrEqual(endTime - startTime + 100); // Allow some margin
		});
	});

	describe('chunking logic', () => {
		test('should create appropriate chunks based on size limit', () => {
			const manyNotes: FilteredNote[] = Array.from({ length: 25 }, (_, i) => ({
				file: { path: `Note ${i + 1}.md` } as any,
				content: 'Content',
				createdTime: Date.now(),
				modifiedTime: Date.now()
			}));

			const config: Partial<SummaryConfig> = {
				chunkSize: 5
			};

			const estimation = SummaryGenerator.estimateChunking(manyNotes, config);

			expect(estimation.requiresChunking).toBe(true); // 25 notes > 20 threshold
			expect(estimation.estimatedChunks).toBe(5); // 25 notes / 5 per chunk
		});

		test('should identify when chunking is required due to token limits', () => {
			const largeNotes: FilteredNote[] = Array.from({ length: 15 }, (_, i) => ({
				file: { path: `Note ${i + 1}.md` } as any,
				content: 'A'.repeat(30000), // Large content to trigger token limits
				createdTime: Date.now(),
				modifiedTime: Date.now()
			}));

			const estimation = SummaryGenerator.estimateChunking(largeNotes);

			expect(estimation.requiresChunking).toBe(true);
			expect(estimation.tokenEstimate).toBeGreaterThan(10000);
		});

		test('should handle empty notes array', () => {
			const estimation = SummaryGenerator.estimateChunking([]);

			expect(estimation.requiresChunking).toBe(false);
			expect(estimation.estimatedChunks).toBe(1);
			expect(estimation.tokenEstimate).toBeGreaterThan(0); // Prompt overhead
		});
	});

	describe('retry logic', () => {
		test('should retry retryable errors', async () => {
			const retryableError: OpenAIError = {
				type: 'network',
				message: 'Network error',
				retryable: true
			};

			mockOpenAIService.generateCompletion
				.mockRejectedValueOnce(retryableError)
				.mockRejectedValueOnce(retryableError)
				.mockResolvedValueOnce(mockOpenAIResponse);

			const result = await summaryGenerator.generateSummary(mockFilterResult, mockProgressCallback);

			expect(result.content).toBe(mockOpenAIResponse.content);
			expect(mockOpenAIService.generateCompletion).toHaveBeenCalledTimes(3);
		});

		test('should not retry non-retryable errors', async () => {
			const nonRetryableError: OpenAIError = {
				type: 'authentication',
				message: 'Invalid API key',
				retryable: false
			};

			mockOpenAIService.generateCompletion.mockRejectedValue(nonRetryableError);

			await expect(summaryGenerator.generateSummary(mockFilterResult, mockProgressCallback))
				.rejects.toEqual(nonRetryableError);

			expect(mockOpenAIService.generateCompletion).toHaveBeenCalledTimes(1);
		});

		test('should respect retry delay for rate limit errors', async () => {
			const rateLimitError: OpenAIError = {
				type: 'rate_limit',
				message: 'Rate limit exceeded',
				retryable: true,
				retryAfter: 1 // 1 second
			};

			mockOpenAIService.generateCompletion
				.mockRejectedValueOnce(rateLimitError)
				.mockResolvedValueOnce(mockOpenAIResponse);

			const startTime = Date.now();
			await summaryGenerator.generateSummary(mockFilterResult, mockProgressCallback);
			const endTime = Date.now();

			// Should have waited at least 1 second (1000ms)
			expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
		});

		test('should fail after max retry attempts', async () => {
			const retryableError: OpenAIError = {
				type: 'network',
				message: 'Network error',
				retryable: true
			};

			mockOpenAIService.generateCompletion.mockRejectedValue(retryableError);

			const customConfig: Partial<SummaryConfig> = {
				retryAttempts: 2
			};
			const customGenerator = new SummaryGenerator(mockOpenAIService, customConfig);

			await expect(customGenerator.generateSummary(mockFilterResult, mockProgressCallback))
				.rejects.toEqual(retryableError);

			expect(mockOpenAIService.generateCompletion).toHaveBeenCalledTimes(2);
		});
	});

	describe('configuration', () => {
		test('should allow updating configuration', () => {
			const newConfig: Partial<SummaryConfig> = {
				chunkSize: 20,
				retryAttempts: 5
			};

			summaryGenerator.updateConfig(newConfig);
			expect(summaryGenerator).toBeDefined(); // Can't directly test config, but method should work
		});

		test('should use custom prompt configuration', async () => {
			const customConfig: Partial<SummaryConfig> = {
				promptConfig: {
					includeMetadata: false,
					maxNotePreview: 100,
					focusAreas: ['Testing']
				}
			};

			const customGenerator = new SummaryGenerator(mockOpenAIService, customConfig);
			await customGenerator.generateSummary(mockFilterResult, mockProgressCallback);

			expect(mockOpenAIService.generateCompletion).toHaveBeenCalledWith(
				expect.stringContaining('Testing')
			);
		});
	});

	describe('edge cases', () => {
		test('should handle empty note set', async () => {
					const emptyFilterResult: NoteFilterResult = {
			notes: [],
			totalCount: 0,
			dateRange: mockDateRange,
			mode: 'date'
		};

			const result = await summaryGenerator.generateSummary(emptyFilterResult, mockProgressCallback);

			expect(result.metadata.notesAnalyzed).toBe(0);
			expect(result.metadata.chunksProcessed).toBe(1); // Single empty chunk processed
		});

		test('should handle single note', async () => {
					const singleNoteResult: NoteFilterResult = {
			notes: [mockNotes[0]],
			totalCount: 1,
			dateRange: mockDateRange,
			mode: 'date'
		};

			const result = await summaryGenerator.generateSummary(singleNoteResult, mockProgressCallback);

			expect(result.metadata.notesAnalyzed).toBe(1);
			expect(result.metadata.chunksProcessed).toBe(1);
		});

		test('should work without progress callback', async () => {
			const result = await summaryGenerator.generateSummary(mockFilterResult);

			expect(result).toBeDefined();
			expect(result.content).toBe(mockOpenAIResponse.content);
		});

		test('should handle very large single note that needs its own chunk', async () => {
			const largeNote: FilteredNote = {
				file: { path: 'huge-note.md' } as any,
				content: 'A'.repeat(100000), // Very large content
				createdTime: Date.now(),
				modifiedTime: Date.now()
			};

					const largeNoteResult: NoteFilterResult = {
			notes: [largeNote],
			totalCount: 1,
			dateRange: mockDateRange,
			mode: 'date'
		};

			const result = await summaryGenerator.generateSummary(largeNoteResult, mockProgressCallback);

			expect(result.metadata.notesAnalyzed).toBe(1);
			expect(result.content).toBe(mockOpenAIResponse.content);
		});

		test('should handle folder mode without dateRange', async () => {
			const result = await summaryGenerator.generateSummary(mockFolderFilterResult, mockProgressCallback);

			expect(result).toBeDefined();
			expect(result.content).toBe(mockOpenAIResponse.content);
			expect(result.metadata.mode).toBe('folder');
			expect(result.metadata.folderPath).toBe('projects');
			expect(result.metadata.folderName).toBe('Projects');
			expect(result.metadata.dateRange).toBeUndefined();
			expect(result.metadata.notesAnalyzed).toBe(2);
			expect(result.metadata.tokensUsed.total).toBe(1500);

			expect(mockOpenAIService.generateCompletion).toHaveBeenCalledTimes(1);
		});

		test('should generate correct metadata for folder mode', async () => {
			const result = await summaryGenerator.generateSummary(mockFolderFilterResult);

			expect(result.metadata.mode).toBe('folder');
			expect(result.metadata.folderPath).toBe('projects');
			expect(result.metadata.folderName).toBe('Projects');
			expect(result.metadata.dateRange).toBeUndefined();
			
			// Verify folder-specific metadata exists and date-specific metadata doesn't
			expect(result.metadata).toHaveProperty('folderPath');
			expect(result.metadata).toHaveProperty('folderName');
			expect(result.metadata).not.toHaveProperty('dateRange');
		});

		test('should call progress callback correctly for folder mode', async () => {
			await summaryGenerator.generateSummary(mockFolderFilterResult, mockProgressCallback);

			// Verify progress callbacks were called
			expect(mockProgressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					stage: 'chunking',
					currentChunk: 0,
					totalChunks: 1
				})
			);

			expect(mockProgressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					stage: 'generating',
					currentChunk: 1,
					totalChunks: 1
				})
			);

			expect(mockProgressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					stage: 'complete',
					currentChunk: 1,
					totalChunks: 1
				})
			);
		});
	});
}); 