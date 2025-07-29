import { OpenAIService, OpenAIConfig, OpenAIResponse, OpenAIError, OpenAIModelUtils } from '../../src/insight-companion/openai-service';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenAIService', () => {
	let openaiService: OpenAIService;
	let mockFetch: jest.MockedFunction<typeof fetch>;

	const validConfig: OpenAIConfig = {
		apiKey: 'sk-test-api-key',
		model: 'gpt-4',
		maxTokens: 1000,
		temperature: 0.7
	};

	beforeEach(() => {
		mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
		mockFetch.mockClear();
		openaiService = new OpenAIService(validConfig);
	});

	describe('constructor', () => {
		test('should initialize with default configuration', () => {
			const service = new OpenAIService({ apiKey: 'test' });
			expect(service).toBeDefined();
		});

		test('should merge provided config with defaults', () => {
			const customConfig = {
				apiKey: 'test',
				temperature: 0.9
			};
			const service = new OpenAIService(customConfig);
			expect(service).toBeDefined();
		});
	});

	describe('generateCompletion', () => {
		test('should successfully generate completion', async () => {
			const mockResponse = {
				choices: [{
					message: {
						content: 'Test completion response'
					}
				}],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 20,
					total_tokens: 30
				},
				model: 'gpt-4-0125-preview' // Updated to reflect Turbo upgrade
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(mockResponse)
			} as any);

			const result = await openaiService.generateCompletion('Test prompt');

			expect(result).toEqual({
				content: 'Test completion response',
				tokensUsed: {
					prompt: 10,
					completion: 20,
					total: 30
				},
				model: 'gpt-4-0125-preview'
			});

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.openai.com/v1/chat/completions',
				expect.objectContaining({
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer sk-test-api-key'
					},
					body: JSON.stringify({
						model: 'gpt-4-0125-preview', // Updated to reflect Turbo upgrade
						messages: [{
							role: 'user',
							content: 'Test prompt'
						}],
						max_tokens: 1000,
						temperature: 0.7
					})
				})
			);
		});

		test('should throw authentication error when API key is missing', async () => {
			const serviceWithoutKey = new OpenAIService({ apiKey: '' });

			await expect(serviceWithoutKey.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'authentication',
					message: 'OpenAI API key is required',
					retryable: false
				});
		});

		test('should handle authentication errors from API', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: jest.fn().mockResolvedValueOnce({
					error: { message: 'Invalid authentication credentials' }
				})
			} as any);

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'authentication',
					message: 'Invalid or missing OpenAI API key',
					retryable: false
				});
		});

		test('should handle rate limit errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				json: jest.fn().mockResolvedValueOnce({
					error: { message: 'Rate limit exceeded' }
				})
			} as any);

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'rate_limit',
					message: 'OpenAI API rate limit exceeded',
					retryable: true
				});
		});

		test('should handle token limit errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: jest.fn().mockResolvedValueOnce({
					error: { message: 'Maximum token limit exceeded' }
				})
			} as any);

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'token_limit',
					message: 'Request exceeds token limits',
					retryable: false
				});
		});

		test('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'network',
					message: 'Network error - check your internet connection',
					retryable: true
				});
		});

		test('should handle server errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: jest.fn().mockResolvedValueOnce({
					error: { message: 'Internal server error' }
				})
			} as any);

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'network',
					message: 'OpenAI API server error',
					retryable: true
				});
		});

		test('should handle invalid response format', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({
					choices: []
				})
			} as any);

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'invalid_response',
					message: 'No completion choices returned from API',
					retryable: false
				});
		});

		test('should handle response without content', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({
					choices: [{ message: {} }]
				})
			} as any);

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'invalid_response',
					message: 'No content in API response',
					retryable: false
				});
		});

		test('should extract retry-after time from rate limit errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				json: jest.fn().mockResolvedValueOnce({
					error: { message: 'Rate limit exceeded. Please retry after 60 seconds.' }
				})
			} as any);

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'rate_limit',
					retryable: true,
					retryAfter: 60
				});
		});
	});

	describe('testConnection', () => {
		test('should return success for valid connection', async () => {
			const mockResponse = {
				choices: [{
					message: { content: 'OK' }
				}],
				usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
				model: 'gpt-4'
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(mockResponse)
			} as any);

			const result = await openaiService.testConnection();
			expect(result).toEqual({ success: true });
		});

		test('should return failure for invalid connection', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: jest.fn().mockResolvedValueOnce({
					error: { message: 'Invalid API key' }
				})
			} as any);

			const result = await openaiService.testConnection();
			expect(result).toEqual({
				success: false,
				error: 'Invalid or missing OpenAI API key'
			});
		});
	});

	describe('updateConfig', () => {
		test('should update configuration', () => {
			openaiService.updateConfig({ temperature: 0.5 });
			// We can't directly test the internal config, but we can test it affects subsequent calls
			expect(openaiService).toBeDefined();
		});

		test('should merge with existing configuration', () => {
			openaiService.updateConfig({ model: 'gpt-3.5-turbo' });
			expect(openaiService).toBeDefined();
		});
	});

	describe('error handling edge cases', () => {
		test('should handle unknown error types', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: jest.fn().mockResolvedValueOnce({
					error: { message: 'Some unknown error' }
				})
			} as any);

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'unknown',
					retryable: true
				});
		});

		test('should handle malformed JSON responses', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON'))
			} as any);

			await expect(openaiService.generateCompletion('test'))
				.rejects
				.toMatchObject({
					type: 'unknown',
					retryable: true
				});
		});
	});

	describe('GPT-4 Turbo Model Upgrade', () => {
		test('should use GPT-4 Turbo by default when no model specified', () => {
			const config: OpenAIConfig = { apiKey: 'test-key' };
			const openaiService = new OpenAIService(config);

			expect(openaiService.getCurrentModel()).toBe('gpt-4-0125-preview');
		});

		test('should upgrade legacy GPT-4 to Turbo', () => {
			const config: OpenAIConfig = { 
				apiKey: 'test-key',
				model: 'gpt-4'
			};
			const openaiService = new OpenAIService(config);

			expect(openaiService.getCurrentModel()).toBe('gpt-4-0125-preview');
		});

		test('should upgrade GPT-4-0613 to Turbo', () => {
			const config: OpenAIConfig = { 
				apiKey: 'test-key',
				model: 'gpt-4-0613'
			};
			const openaiService = new OpenAIService(config);

			expect(openaiService.getCurrentModel()).toBe('gpt-4-0125-preview');
		});

		test('should preserve existing Turbo model when specified', () => {
			const config: OpenAIConfig = { 
				apiKey: 'test-key',
				model: 'gpt-4-1106-preview'
			};
			const openaiService = new OpenAIService(config);

			expect(openaiService.getCurrentModel()).toBe('gpt-4-1106-preview');
		});

		test('should preserve custom Turbo model', () => {
			const config: OpenAIConfig = { 
				apiKey: 'test-key',
				model: 'gpt-4-turbo'
			};
			const openaiService = new OpenAIService(config);

			expect(openaiService.getCurrentModel()).toBe('gpt-4-turbo');
		});

		test('should preserve non-standard but Turbo-named models', () => {
			const config: OpenAIConfig = { 
				apiKey: 'test-key',
				model: 'gpt-4-turbo-custom'
			};
			const openaiService = new OpenAIService(config);

			expect(openaiService.getCurrentModel()).toBe('gpt-4-turbo-custom');
		});
	});

	describe('OpenAIModelUtils', () => {
		test('should correctly identify Turbo models', () => {
			expect(OpenAIModelUtils.isTurboModel('gpt-4-0125-preview')).toBe(true);
			expect(OpenAIModelUtils.isTurboModel('gpt-4-1106-preview')).toBe(true);
			expect(OpenAIModelUtils.isTurboModel('gpt-4-turbo')).toBe(true);
			expect(OpenAIModelUtils.isTurboModel('gpt-4-turbo-preview')).toBe(true);
			expect(OpenAIModelUtils.isTurboModel('gpt-4-turbo-custom')).toBe(true);
		});

		test('should correctly identify legacy models', () => {
			expect(OpenAIModelUtils.isTurboModel('gpt-4')).toBe(false);
			expect(OpenAIModelUtils.isTurboModel('gpt-4-0613')).toBe(false);
			expect(OpenAIModelUtils.isTurboModel('gpt-3.5-turbo')).toBe(true); // Has turbo in name
		});

		test('should identify models that need upgrading', () => {
			expect(OpenAIModelUtils.shouldUpgradeModel()).toBe(true); // No model
			expect(OpenAIModelUtils.shouldUpgradeModel('gpt-4')).toBe(true);
			expect(OpenAIModelUtils.shouldUpgradeModel('gpt-4-0613')).toBe(true);
			expect(OpenAIModelUtils.shouldUpgradeModel('gpt-4-0125-preview')).toBe(false);
			expect(OpenAIModelUtils.shouldUpgradeModel('gpt-4-turbo')).toBe(false);
		});

		test('should return optimal model for various inputs', () => {
			expect(OpenAIModelUtils.getOptimalModel()).toBe('gpt-4-0125-preview');
			expect(OpenAIModelUtils.getOptimalModel('gpt-4')).toBe('gpt-4-0125-preview');
			expect(OpenAIModelUtils.getOptimalModel('gpt-4-0613')).toBe('gpt-4-0125-preview');
			expect(OpenAIModelUtils.getOptimalModel('gpt-4-1106-preview')).toBe('gpt-4-1106-preview');
			expect(OpenAIModelUtils.getOptimalModel('gpt-4-turbo')).toBe('gpt-4-turbo');
		});
	});
}); 