export interface OpenAIConfig {
	apiKey: string;
	model?: string;
	maxTokens?: number;
	temperature?: number;
}

export interface OpenAIResponse {
	content: string;
	tokensUsed: {
		prompt: number;
		completion: number;
		total: number;
	};
	model: string;
}

export interface OpenAIError {
	type: 'authentication' | 'rate_limit' | 'token_limit' | 'network' | 'invalid_response' | 'unknown';
	message: string;
	retryable: boolean;
	retryAfter?: number; // seconds
}

/**
 * Utility functions for OpenAI model management
 */
export class OpenAIModelUtils {
	// Current recommended GPT-4 Turbo model
	static readonly DEFAULT_TURBO_MODEL = 'gpt-4-0125-preview';
	
	// List of known Turbo-compatible models
	static readonly TURBO_MODELS = [
		'gpt-4-0125-preview',
		'gpt-4-1106-preview', 
		'gpt-4-turbo',
		'gpt-4-turbo-preview'
	];

	// Legacy models that should be upgraded
	static readonly LEGACY_MODELS = [
		'gpt-4',
		'gpt-4-0613'
	];

	/**
	 * Check if a model is a Turbo variant
	 */
	static isTurboModel(model: string): boolean {
		return this.TURBO_MODELS.includes(model) || model.includes('turbo');
	}

	/**
	 * Check if a model should be upgraded to Turbo
	 */
	static shouldUpgradeModel(model?: string): boolean {
		if (!model) return true; // No model specified, use Turbo
		return this.LEGACY_MODELS.includes(model);
	}

	/**
	 * Get the appropriate model, upgrading legacy models to Turbo
	 */
	static getOptimalModel(requestedModel?: string): string {
		if (!requestedModel || this.shouldUpgradeModel(requestedModel)) {
			return this.DEFAULT_TURBO_MODEL;
		}
		return requestedModel;
	}
}

export class OpenAIService {
	private config: OpenAIConfig;
	private readonly BASE_URL = 'https://api.openai.com/v1';
	
	constructor(config: OpenAIConfig) {
		// Automatically upgrade to Turbo if using legacy model or no model specified
		const optimalModel = OpenAIModelUtils.getOptimalModel(config.model);
		
		this.config = {
			maxTokens: 4096,
			temperature: 0.7,
			...config,
			// Ensure model is set to the optimal choice (override user config if needed)
			model: optimalModel
		};

		// Log model upgrade if it occurred
		if (config.model && config.model !== optimalModel) {
			console.log(`OpenAI model upgraded from '${config.model}' to '${optimalModel}' for better performance and cost efficiency`);
		}
	}

	/**
	 * Generate a completion using OpenAI's chat completion API
	 */
	async generateCompletion(prompt: string): Promise<OpenAIResponse> {
		if (!this.config.apiKey) {
			throw this.createError('authentication', 'OpenAI API key is required');
		}

		const requestBody = {
			model: this.config.model,
			messages: [
				{
					role: 'user',
					content: prompt
				}
			],
			max_tokens: this.config.maxTokens,
			temperature: this.config.temperature
		};

        try {
            const response = await this.makeRequest('/chat/completions', requestBody);
            return this.parseResponse(response);
        } catch (error) {
            throw this.handleError(error);
        }
	}

	/**
	 * Make HTTP request to OpenAI API with proper headers and error handling
	 */
	private async makeRequest(endpoint: string, body: any): Promise<any> {
		const url = `${this.BASE_URL}${endpoint}`;
		
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.config.apiKey}`
			},
			body: JSON.stringify(body)
		});

		const responseData = await response.json();

		if (!response.ok) {
			const errorMessage = responseData.error?.message || 'Unknown error';
			// Include status code for better error categorization
			const error = new Error(`HTTP ${response.status}: ${errorMessage}`);
			(error as any).status = response.status;
			(error as any).responseData = responseData;
			// Respect Retry-After header if present for rate limits
			const retryAfterHeader = response.headers?.get?.('retry-after');
			if (retryAfterHeader) {
				(error as any).retryAfter = parseInt(retryAfterHeader, 10);
			}
			throw error;
		}

		return responseData;
	}

	/**
	 * Parse OpenAI API response into our standard format
	 */
	private parseResponse(response: any): OpenAIResponse {
		if (!response.choices || response.choices.length === 0) {
			throw this.createError('invalid_response', 'No completion choices returned from API');
		}

		const choice = response.choices[0];
		if (!choice.message || !choice.message.content) {
			throw this.createError('invalid_response', 'No content in API response');
		}

		return {
			content: choice.message.content.trim(),
			tokensUsed: {
				prompt: response.usage?.prompt_tokens || 0,
				completion: response.usage?.completion_tokens || 0,
				total: response.usage?.total_tokens || 0
			},
			model: response.model || this.config.model
		};
	}

	/**
	 * Handle and categorize errors from the OpenAI API
	 */
	private handleError(error: any): OpenAIError {
		const message = error.message || 'Unknown error occurred';
		const status = error.status;
        const retryAfterFromHeader: number | undefined = (error as any).retryAfter;

		// Check HTTP status codes first for more reliable categorization
		if (status === 401 || message.includes('authentication') || message.includes('Invalid authentication')) {
			return this.createError('authentication', 'Invalid or missing OpenAI API key');
		}

		if (status === 429 || message.includes('rate limit')) {
			const retryAfter = retryAfterFromHeader ?? this.extractRetryAfter(message);
			return this.createError('rate_limit', 'OpenAI API rate limit exceeded', true, retryAfter);
		}

		if (message.includes('token') && (message.includes('limit') || message.includes('maximum'))) {
			return this.createError('token_limit', 'Request exceeds token limits');
		}

		// Check for our own custom errors first
		if (message.includes('No completion choices returned from API')) {
			return this.createError('invalid_response', 'No completion choices returned from API');
		}

		if (message.includes('No content in API response')) {
			return this.createError('invalid_response', 'No content in API response');
		}

		// Network errors
		if (error instanceof TypeError && error.message.includes('fetch')) {
			return this.createError('network', 'Network error - check your internet connection', true);
		}

		// HTTP server errors
		if (status >= 500 || message.includes('HTTP 5')) {
			return this.createError('network', 'OpenAI API server error', true);
		}

		// Default to unknown error
		return this.createError('unknown', `Unexpected error: ${message}`, true);
	}

	/**
	 * Create a standardized error object
	 */
	private createError(
		type: OpenAIError['type'], 
		message: string, 
		retryable: boolean = false, 
		retryAfter?: number
	): OpenAIError {
		return {
			type,
			message,
			retryable,
			retryAfter
		};
	}

	/**
	 * Extract retry-after header value from error message
	 */
	private extractRetryAfter(message: string): number | undefined {
		const match = message.match(/retry after (\d+)/i);
		return match ? parseInt(match[1], 10) : undefined;
	}

	/**
	 * Test the API connection and key validity
	 */
	async testConnection(): Promise<{ success: boolean; error?: string }> {
		try {
			await this.generateCompletion('Test connection. Respond with "OK".');
			return { success: true };
		} catch (error) {
			const openaiError = error as OpenAIError;
			return { 
				success: false, 
				error: openaiError.message 
			};
		}
	}

	/**
	 * Get the current model being used
	 */
	getCurrentModel(): string {
		return this.config.model || OpenAIModelUtils.DEFAULT_TURBO_MODEL;
	}

	/**
	 * Update the configuration
	 */
	updateConfig(newConfig: Partial<OpenAIConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}
} 