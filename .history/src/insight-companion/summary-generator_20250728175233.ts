import { FilteredNote, NoteFilterResult } from './note-filter';
import { DateRange } from './date-picker-modal';
import { OpenAIService, OpenAIResponse, OpenAIError } from './openai-service';
import { PromptGenerator, PromptConfig, GeneratedPrompt } from './prompt-generator';
import { TokenEstimator } from './token-estimator';

export interface SummaryConfig {
	chunkSize: number; // Maximum notes per chunk
	maxTokensPerChunk: number; // Token limit per API call
	retryAttempts: number;
	retryDelayMs: number;
	promptConfig?: Partial<PromptConfig>;
}

export interface SummaryProgress {
	stage: 'chunking' | 'generating' | 'combining' | 'complete' | 'error';
	currentChunk: number;
	totalChunks: number;
	message: string;
	error?: OpenAIError;
}

export interface SummaryResult {
	content: string;
	metadata: {
		dateRange: DateRange;
		notesAnalyzed: number;
		tokensUsed: {
			prompt: number;
			completion: number;
			total: number;
		};
		chunksProcessed: number;
		generationTime: number; // milliseconds
		model: string;
	};
}

export type ProgressCallback = (progress: SummaryProgress) => void;

export class SummaryGenerator {
	private openaiService: OpenAIService;
	private config: SummaryConfig;

	private static readonly DEFAULT_CONFIG: SummaryConfig = {
		chunkSize: 10, // Max 10 notes per chunk
		maxTokensPerChunk: 100000, // Leave buffer for response
		retryAttempts: 3,
		retryDelayMs: 1000,
		promptConfig: {
			includeMetadata: true,
			maxNotePreview: 500
		}
	};

	constructor(openaiService: OpenAIService, config: Partial<SummaryConfig> = {}) {
		this.openaiService = openaiService;
		this.config = { ...SummaryGenerator.DEFAULT_CONFIG, ...config };
	}

	/**
	 * Generate an insight summary from filtered notes
	 */
	async generateSummary(
		filterResult: NoteFilterResult,
		progressCallback?: ProgressCallback
	): Promise<SummaryResult> {
		const startTime = Date.now();
		const { notes, dateRange } = filterResult;

		try {
			// Determine if chunking is needed
			const chunks = notes.length > 0 ? this.chunkNotes(notes) : [[]];
			const totalChunks = chunks.length;

			progressCallback?.({
				stage: 'chunking',
				currentChunk: 0,
				totalChunks,
				message: `Divided ${notes.length} notes into ${totalChunks} chunk${totalChunks > 1 ? 's' : ''}`
			});

			let finalSummary: string;
			let totalTokensUsed = { prompt: 0, completion: 0, total: 0 };
			let model = '';

			if (totalChunks === 1) {
				// Single chunk - direct generation
				const result = await this.generateSingleSummary(chunks[0], dateRange, progressCallback);
				finalSummary = result.content;
				totalTokensUsed = result.tokensUsed;
				model = result.model;
			} else {
				// Multiple chunks - generate partial summaries then combine
				const chunkSummaries: string[] = [];

				// Generate summaries for each chunk
				for (let i = 0; i < chunks.length; i++) {
					progressCallback?.({
						stage: 'generating',
						currentChunk: i + 1,
						totalChunks,
						message: `Generating insights for chunk ${i + 1} of ${totalChunks}...`
					});

					const chunkResult = await this.generateChunkSummary(
						chunks[i], 
						i, 
						totalChunks, 
						dateRange
					);

					chunkSummaries.push(chunkResult.content);
					totalTokensUsed.prompt += chunkResult.tokensUsed.prompt;
					totalTokensUsed.completion += chunkResult.tokensUsed.completion;
					totalTokensUsed.total += chunkResult.tokensUsed.total;
					model = chunkResult.model;
				}

				// Combine chunk summaries
				progressCallback?.({
					stage: 'combining',
					currentChunk: totalChunks,
					totalChunks,
					message: 'Combining chunk summaries into final insight...'
				});

				const combinedResult = await this.combineSummaries(
					chunkSummaries, 
					notes.length, 
					dateRange
				);

				finalSummary = combinedResult.content;
				totalTokensUsed.prompt += combinedResult.tokensUsed.prompt;
				totalTokensUsed.completion += combinedResult.tokensUsed.completion;
				totalTokensUsed.total += combinedResult.tokensUsed.total;
			}

			progressCallback?.({
				stage: 'complete',
				currentChunk: totalChunks,
				totalChunks,
				message: 'Summary generation completed successfully!'
			});

			const generationTime = Date.now() - startTime;

			return {
				content: finalSummary,
				metadata: {
					dateRange,
					notesAnalyzed: notes.length,
					tokensUsed: totalTokensUsed,
					chunksProcessed: totalChunks,
					generationTime,
					model
				}
			};

		} catch (error) {
			const openaiError = error as OpenAIError;
			progressCallback?.({
				stage: 'error',
				currentChunk: 0,
				totalChunks: 0,
				message: `Error generating summary: ${openaiError.message}`,
				error: openaiError
			});
			throw error;
		}
	}

	/**
	 * Divide notes into manageable chunks for processing
	 */
	private chunkNotes(notes: FilteredNote[]): FilteredNote[][] {
		const chunks: FilteredNote[][] = [];
		
		// Simple chunking by count first
		for (let i = 0; i < notes.length; i += this.config.chunkSize) {
			const chunk = notes.slice(i, i + this.config.chunkSize);
			chunks.push(chunk);
		}

		// Validate chunk sizes don't exceed token limits
		const validatedChunks: FilteredNote[][] = [];
		
		for (const chunk of chunks) {
			const tokenEstimate = TokenEstimator.estimateTokens(chunk);
			
			if (tokenEstimate.totalTokens <= this.config.maxTokensPerChunk) {
				validatedChunks.push(chunk);
			} else {
				// Further subdivide this chunk
				const subChunks = this.subdivideChunk(chunk);
				validatedChunks.push(...subChunks);
			}
		}

		return validatedChunks;
	}

	/**
	 * Subdivide a chunk that's too large
	 */
	private subdivideChunk(chunk: FilteredNote[]): FilteredNote[][] {
		const subChunks: FilteredNote[][] = [];
		let currentChunk: FilteredNote[] = [];
		let currentTokens = 0;

		for (const note of chunk) {
			const noteTokens = TokenEstimator.estimateTokensForNote(note.content);
			
			if (currentTokens + noteTokens > this.config.maxTokensPerChunk && currentChunk.length > 0) {
				subChunks.push(currentChunk);
				currentChunk = [note];
				currentTokens = noteTokens;
			} else {
				currentChunk.push(note);
				currentTokens += noteTokens;
			}
		}

		if (currentChunk.length > 0) {
			subChunks.push(currentChunk);
		}

		return subChunks;
	}

	/**
	 * Generate summary for a single chunk (no combination needed)
	 */
	private async generateSingleSummary(
		notes: FilteredNote[], 
		dateRange: DateRange,
		progressCallback?: ProgressCallback
	): Promise<OpenAIResponse> {
		progressCallback?.({
			stage: 'generating',
			currentChunk: 1,
			totalChunks: 1,
			message: 'Generating insights from notes...'
		});

		const prompt = PromptGenerator.generateInsightPrompt(
			notes, 
			dateRange, 
			this.config.promptConfig
		);

		return await this.executeWithRetry(prompt.content);
	}

	/**
	 * Generate summary for a chunk (when multiple chunks exist)
	 */
	private async generateChunkSummary(
		notes: FilteredNote[], 
		chunkIndex: number, 
		totalChunks: number, 
		dateRange: DateRange
	): Promise<OpenAIResponse> {
		const prompt = PromptGenerator.generateChunkPrompt(
			notes, 
			chunkIndex, 
			totalChunks, 
			dateRange, 
			this.config.promptConfig
		);

		return await this.executeWithRetry(prompt.content);
	}

	/**
	 * Combine multiple chunk summaries into a final summary
	 */
	private async combineSummaries(
		chunkSummaries: string[], 
		totalNoteCount: number, 
		dateRange: DateRange
	): Promise<OpenAIResponse> {
		const prompt = PromptGenerator.generateCombinationPrompt(
			chunkSummaries, 
			totalNoteCount, 
			dateRange
		);

		return await this.executeWithRetry(prompt.content);
	}

	/**
	 * Execute OpenAI API call with retry logic
	 */
	private async executeWithRetry(prompt: string): Promise<OpenAIResponse> {
		let lastError: OpenAIError | null = null;

		for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
			try {
				return await this.openaiService.generateCompletion(prompt);
			} catch (error) {
				const openaiError = error as OpenAIError;
				lastError = openaiError;

				// Don't retry non-retryable errors
				if (!openaiError.retryable) {
					throw openaiError;
				}

				// Wait before retrying
				if (attempt < this.config.retryAttempts - 1) {
					const delay = openaiError.retryAfter 
						? openaiError.retryAfter * 1000 
						: this.config.retryDelayMs * (attempt + 1);
					
					await this.sleep(delay);
				}
			}
		}

		// All retries failed
		throw lastError;
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Estimate if the notes will require chunking
	 */
	static estimateChunking(notes: FilteredNote[], config: Partial<SummaryConfig> = {}): {
		requiresChunking: boolean;
		estimatedChunks: number;
		tokenEstimate: number;
	} {
		const finalConfig = { ...SummaryGenerator.DEFAULT_CONFIG, ...config };
		const tokenEstimate = TokenEstimator.estimateTokens(notes);
		
		const requiresChunking = tokenEstimate.totalTokens > finalConfig.maxTokensPerChunk || notes.length > finalConfig.chunkSize;
		const estimatedChunks = requiresChunking 
			? Math.ceil(notes.length / finalConfig.chunkSize)
			: 1;

		return {
			requiresChunking,
			estimatedChunks,
			tokenEstimate: tokenEstimate.totalTokens
		};
	}

	/**
	 * Update the configuration
	 */
	updateConfig(newConfig: Partial<SummaryConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}
} 