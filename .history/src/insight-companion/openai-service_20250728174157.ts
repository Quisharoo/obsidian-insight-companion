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

export class OpenAIService {
	private config: OpenAIConfig;
	private readonly BASE_URL = 'https://api.openai.com/v1';
	
	constructor(config: OpenAIConfig) {
		this.config = {
			model: 'gpt-4',
			maxTokens: 4096,
			temperature: 0.7,
			...config
		};
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
			throw new Error(`HTTP ${response.status}: ${responseData.error?.message || 'Unknown error'}`);
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

		// Authentication errors
		if (message.includes('401') || message.includes('authentication') || message.includes('API key')) {
			return this.createError('authentication', 'Invalid or missing OpenAI API key');
		}

		// Rate limit errors
		if (message.includes('429') || message.includes('rate limit')) {
			const retryAfter = this.extractRetryAfter(message);
			return this.createError('rate_limit', 'OpenAI API rate limit exceeded', true, retryAfter);
		}

		// Token limit errors
		if (message.includes('token') && (message.includes('limit') || message.includes('maximum'))) {
			return this.createError('token_limit', 'Request exceeds token limits');
		}

		// Network errors
		if (error instanceof TypeError && error.message.includes('fetch')) {
			return this.createError('network', 'Network error - check your internet connection', true);
		}

		// HTTP errors
		if (message.includes('HTTP 5')) {
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
	 * Update the configuration
	 */
	updateConfig(newConfig: Partial<OpenAIConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}
} 