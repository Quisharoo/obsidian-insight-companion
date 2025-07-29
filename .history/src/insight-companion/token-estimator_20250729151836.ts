import { FilteredNote } from './note-filter';

export interface TokenEstimate {
	contentTokens: number;
	promptOverheadTokens: number;
	totalTokens: number;
	characterCount: number;
	wordCount: number;
	noteCount: number;
}

export class TokenEstimator {
	// Conservative estimation: ~4 characters per token
	private static readonly CHARS_PER_TOKEN = 4;
	
	// Estimated tokens for the system prompt and response formatting
	private static readonly PROMPT_OVERHEAD_TOKENS = 500;
	
	// Additional overhead per note for metadata and structure
	private static readonly TOKENS_PER_NOTE_OVERHEAD = 50;

	/**
	 * Estimates the total token count for a collection of filtered notes
	 */
	static estimateTokens(notes: FilteredNote[]): TokenEstimate {
		let totalCharacters = 0;
		let totalWords = 0;

		for (const note of notes) {
			totalCharacters += note.content.length;
			totalWords += this.countWords(note.content);
		}

		// Estimate content tokens based on character count
		const contentTokens = Math.ceil(totalCharacters / this.CHARS_PER_TOKEN);
		
		// Calculate overhead: base prompt + per-note overhead
		const promptOverheadTokens = this.PROMPT_OVERHEAD_TOKENS + 
			(notes.length * this.TOKENS_PER_NOTE_OVERHEAD);
		
		const totalTokens = contentTokens + promptOverheadTokens;

		return {
			contentTokens,
			promptOverheadTokens,
			totalTokens,
			characterCount: totalCharacters,
			wordCount: totalWords,
			noteCount: notes.length
		};
	}

	/**
	 * Estimates tokens for a single note
	 */
	static estimateTokensForNote(content: string): number {
		return Math.ceil(content.length / this.CHARS_PER_TOKEN);
	}

	/**
	 * Gets a human-readable estimate string
	 */
	static formatEstimate(estimate: TokenEstimate): string {
		const { totalTokens, noteCount, characterCount, wordCount } = estimate;
		
		return `${totalTokens.toLocaleString()} tokens estimated from ${noteCount} note${noteCount !== 1 ? 's' : ''} ` +
			   `(${characterCount.toLocaleString()} characters, ${wordCount.toLocaleString()} words)`;
	}

	/**
	 * Estimates the cost in USD for OpenAI API calls based on token count
	 * Automatically detects and applies appropriate pricing for the model being used
	 */
	static estimateCost(tokenCount: number, model?: string): { inputCost: number; outputCost: number; totalCost: number; modelType: 'turbo' | 'legacy' } {
		// Determine pricing based on model
		const isTurbo = model ? this.isTurboModel(model) : true; // Default to Turbo pricing
		
		let INPUT_COST_PER_1K: number;
		let OUTPUT_COST_PER_1K: number;
		
		if (isTurbo) {
			// GPT-4 Turbo pricing (as of 2024): $0.01 per 1K input tokens, $0.03 per 1K output tokens
			INPUT_COST_PER_1K = 0.01;
			OUTPUT_COST_PER_1K = 0.03;
		} else {
			// Legacy GPT-4 pricing: $0.03 per 1K input tokens, $0.06 per 1K output tokens
			INPUT_COST_PER_1K = 0.03;
			OUTPUT_COST_PER_1K = 0.06;
		}
		
		// Assume output will be ~10% of input tokens for summary
		const estimatedOutputTokens = Math.ceil(tokenCount * 0.1);
		
		const inputCost = (tokenCount / 1000) * INPUT_COST_PER_1K;
		const outputCost = (estimatedOutputTokens / 1000) * OUTPUT_COST_PER_1K;
		const totalCost = inputCost + outputCost;

		return {
			inputCost: Math.round(inputCost * 100) / 100, // Round to cents
			outputCost: Math.round(outputCost * 100) / 100,
			totalCost: Math.round(totalCost * 100) / 100,
			modelType: isTurbo ? 'turbo' : 'legacy'
		};
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

	/**
	 * Checks if the token count exceeds common API limits
	 */
	static checkTokenLimits(tokenCount: number): { 
		withinGPT4Limit: boolean; 
		withinGPT4TurboLimit: boolean; 
		recommendations: string[] 
	} {
		const GPT4_LIMIT = 8192;
		const GPT4_TURBO_LIMIT = 128000;
		
		const recommendations: string[] = [];
		
		if (tokenCount > GPT4_TURBO_LIMIT) {
			recommendations.push('Consider chunking notes into smaller batches');
			recommendations.push('Filter to a smaller date range');
		} else if (tokenCount > GPT4_LIMIT) {
			recommendations.push('Consider using GPT-4 Turbo for larger contexts');
			recommendations.push('Or chunk notes into smaller batches');
		}

		return {
			withinGPT4Limit: tokenCount <= GPT4_LIMIT,
			withinGPT4TurboLimit: tokenCount <= GPT4_TURBO_LIMIT,
			recommendations
		};
	}

	/**
	 * Counts words in a text string
	 */
	private static countWords(text: string): number {
		// Simple word counting: split by whitespace and filter empty strings
		return text.trim().split(/\s+/).filter(word => word.length > 0).length;
	}
} 