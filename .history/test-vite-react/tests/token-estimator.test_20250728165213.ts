import { TFile } from 'obsidian';
import { TokenEstimator, TokenEstimate } from '../../src/insight-companion/token-estimator';
import { FilteredNote } from '../../src/insight-companion/note-filter';

// Mock TFile for testing
class MockTFile implements Partial<TFile> {
	path: string;
	stat: { ctime: number; mtime: number; size: number };
	
	constructor(path: string) {
		this.path = path;
		this.stat = { ctime: Date.now(), mtime: Date.now(), size: 1000 };
	}
}

describe('TokenEstimator Tests', () => {
	describe('estimateTokens', () => {
		it('should estimate tokens for a single note', () => {
			const notes: FilteredNote[] = [
				{
					file: new MockTFile('test.md') as TFile,
					content: 'This is a test note with some content.',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const estimate = TokenEstimator.estimateTokens(notes);

			expect(estimate.noteCount).toBe(1);
			expect(estimate.characterCount).toBe(39); // Length of test content
			expect(estimate.wordCount).toBe(8); // Number of words
			expect(estimate.contentTokens).toBe(Math.ceil(39 / 4)); // Characters / 4
			expect(estimate.promptOverheadTokens).toBe(500 + 50); // Base + per-note overhead
			expect(estimate.totalTokens).toBe(estimate.contentTokens + estimate.promptOverheadTokens);
		});

		it('should estimate tokens for multiple notes', () => {
			const notes: FilteredNote[] = [
				{
					file: new MockTFile('test1.md') as TFile,
					content: 'First note with some content.',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				},
				{
					file: new MockTFile('test2.md') as TFile,
					content: 'Second note with different content and more words to test.',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const estimate = TokenEstimator.estimateTokens(notes);

			expect(estimate.noteCount).toBe(2);
			expect(estimate.characterCount).toBe(30 + 55); // Sum of both contents
			expect(estimate.wordCount).toBe(6 + 11); // Sum of word counts
			expect(estimate.contentTokens).toBe(Math.ceil(85 / 4));
			expect(estimate.promptOverheadTokens).toBe(500 + (2 * 50)); // Base + 2 notes overhead
		});

		it('should handle empty notes array', () => {
			const notes: FilteredNote[] = [];

			const estimate = TokenEstimator.estimateTokens(notes);

			expect(estimate.noteCount).toBe(0);
			expect(estimate.characterCount).toBe(0);
			expect(estimate.wordCount).toBe(0);
			expect(estimate.contentTokens).toBe(0);
			expect(estimate.promptOverheadTokens).toBe(500); // Just base overhead
			expect(estimate.totalTokens).toBe(500);
		});

		it('should handle notes with empty content', () => {
			const notes: FilteredNote[] = [
				{
					file: new MockTFile('empty.md') as TFile,
					content: '',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const estimate = TokenEstimator.estimateTokens(notes);

			expect(estimate.noteCount).toBe(1);
			expect(estimate.characterCount).toBe(0);
			expect(estimate.wordCount).toBe(0);
			expect(estimate.contentTokens).toBe(0);
			expect(estimate.promptOverheadTokens).toBe(550); // Base + 1 note overhead
		});

		it('should handle notes with only whitespace', () => {
			const notes: FilteredNote[] = [
				{
					file: new MockTFile('whitespace.md') as TFile,
					content: '   \n\t  \r\n  ',
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const estimate = TokenEstimator.estimateTokens(notes);

			expect(estimate.wordCount).toBe(0); // Should not count whitespace as words
			expect(estimate.characterCount).toBe(12); // Should count all characters including whitespace
		});

		it('should handle large content correctly', () => {
			const largeContent = 'A'.repeat(10000); // 10,000 characters
			const notes: FilteredNote[] = [
				{
					file: new MockTFile('large.md') as TFile,
					content: largeContent,
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const estimate = TokenEstimator.estimateTokens(notes);

			expect(estimate.characterCount).toBe(10000);
			expect(estimate.contentTokens).toBe(Math.ceil(10000 / 4));
			expect(estimate.totalTokens).toBeGreaterThan(2500); // Should be substantial
		});
	});

	describe('estimateTokensForNote', () => {
		it('should estimate tokens for single note content', () => {
			const content = 'This is a test with exactly twenty characters.';
			const tokens = TokenEstimator.estimateTokensForNote(content);
			
			expect(tokens).toBe(Math.ceil(46 / 4)); // 12 tokens for 46 characters
		});

		it('should handle empty content', () => {
			const tokens = TokenEstimator.estimateTokensForNote('');
			expect(tokens).toBe(0);
		});

		it('should round up for partial tokens', () => {
			const content = 'ABC'; // 3 characters should round up to 1 token
			const tokens = TokenEstimator.estimateTokensForNote(content);
			expect(tokens).toBe(1);
		});
	});

	describe('formatEstimate', () => {
		it('should format estimate with singular note', () => {
			const estimate: TokenEstimate = {
				contentTokens: 100,
				promptOverheadTokens: 550,
				totalTokens: 650,
				characterCount: 400,
				wordCount: 80,
				noteCount: 1
			};

			const formatted = TokenEstimator.formatEstimate(estimate);
			
			expect(formatted).toContain('650 tokens');
			expect(formatted).toContain('1 note');
			expect(formatted).toContain('400 characters');
			expect(formatted).toContain('80 words');
			expect(formatted).not.toContain('notes'); // Should be singular
		});

		it('should format estimate with multiple notes', () => {
			const estimate: TokenEstimate = {
				contentTokens: 500,
				promptOverheadTokens: 600,
				totalTokens: 1100,
				characterCount: 2000,
				wordCount: 400,
				noteCount: 3
			};

			const formatted = TokenEstimator.formatEstimate(estimate);
			
			expect(formatted).toContain('1,100 tokens');
			expect(formatted).toContain('3 notes');
			expect(formatted).toContain('2,000 characters');
			expect(formatted).toContain('400 words');
		});

		it('should handle zero values', () => {
			const estimate: TokenEstimate = {
				contentTokens: 0,
				promptOverheadTokens: 500,
				totalTokens: 500,
				characterCount: 0,
				wordCount: 0,
				noteCount: 0
			};

			const formatted = TokenEstimator.formatEstimate(estimate);
			
			expect(formatted).toContain('500 tokens');
			expect(formatted).toContain('0 notes');
		});
	});

	describe('estimateCost', () => {
		it('should estimate cost for typical token count', () => {
			const tokenCount = 1000;
			const cost = TokenEstimator.estimateCost(tokenCount);

			expect(cost.inputCost).toBe(0.03); // $0.03 per 1K tokens
			expect(cost.outputCost).toBe(0.01); // 10% of input tokens at $0.06 per 1K
			expect(cost.totalCost).toBe(0.04);
		});

		it('should estimate cost for large token count', () => {
			const tokenCount = 50000;
			const cost = TokenEstimator.estimateCost(tokenCount);

			expect(cost.inputCost).toBe(1.5); // 50K tokens * $0.03/1K
			expect(cost.outputCost).toBe(0.3); // 5K output tokens * $0.06/1K
			expect(cost.totalCost).toBe(1.8);
		});

		it('should handle zero token count', () => {
			const cost = TokenEstimator.estimateCost(0);

			expect(cost.inputCost).toBe(0);
			expect(cost.outputCost).toBe(0);
			expect(cost.totalCost).toBe(0);
		});

		it('should round costs to cents', () => {
			const tokenCount = 123; // Should result in fractional costs
			const cost = TokenEstimator.estimateCost(tokenCount);

			expect(cost.inputCost).toBe(0); // Should round to nearest cent
			expect(cost.totalCost).toBe(cost.inputCost + cost.outputCost);
		});
	});

	describe('checkTokenLimits', () => {
		it('should indicate within GPT-4 limits for small token count', () => {
			const result = TokenEstimator.checkTokenLimits(5000);

			expect(result.withinGPT4Limit).toBe(true);
			expect(result.withinGPT4TurboLimit).toBe(true);
			expect(result.recommendations).toHaveLength(0);
		});

		it('should suggest GPT-4 Turbo for counts above GPT-4 limit', () => {
			const result = TokenEstimator.checkTokenLimits(10000);

			expect(result.withinGPT4Limit).toBe(false);
			expect(result.withinGPT4TurboLimit).toBe(true);
			expect(result.recommendations).toContain('Consider using GPT-4 Turbo for larger contexts');
		});

		it('should suggest chunking for counts above GPT-4 Turbo limit', () => {
			const result = TokenEstimator.checkTokenLimits(150000);

			expect(result.withinGPT4Limit).toBe(false);
			expect(result.withinGPT4TurboLimit).toBe(false);
			expect(result.recommendations).toContain('Consider chunking notes into smaller batches');
			expect(result.recommendations).toContain('Filter to a smaller date range');
		});

		it('should handle exact limit boundaries', () => {
			const gpt4Result = TokenEstimator.checkTokenLimits(8192);
			expect(gpt4Result.withinGPT4Limit).toBe(true);

			const gpt4TurboResult = TokenEstimator.checkTokenLimits(128000);
			expect(gpt4TurboResult.withinGPT4TurboLimit).toBe(true);
		});
	});

	describe('word counting', () => {
		it('should count words correctly', () => {
			// Access private method for testing
			const countWords = (TokenEstimator as any).countWords;

			expect(countWords('Hello world')).toBe(2);
			expect(countWords('  Hello   world  ')).toBe(2); // Extra whitespace
			expect(countWords('One')).toBe(1);
			expect(countWords('')).toBe(0);
			expect(countWords('   ')).toBe(0); // Only whitespace
			expect(countWords('Word1 Word2 Word3')).toBe(3);
			expect(countWords('Word1\nWord2\tWord3')).toBe(3); // Different whitespace types
		});

		it('should handle special characters and punctuation', () => {
			const countWords = (TokenEstimator as any).countWords;

			expect(countWords('Hello, world!')).toBe(2);
			expect(countWords('test@example.com')).toBe(1);
			expect(countWords('one-two three')).toBe(2);
		});
	});

	describe('integration with realistic data', () => {
		it('should provide reasonable estimates for typical markdown content', () => {
			const markdownContent = `
# My Daily Note

## Morning Thoughts
Today I worked on the **Insight Companion** project. It's coming along nicely.

## Tasks
- [ ] Implement note filtering
- [x] Add token estimation
- [ ] Write comprehensive tests

## Meeting Notes
Discussed the following topics:
1. API rate limiting
2. User experience improvements
3. Performance optimization

*This note has various markdown elements including lists, emphasis, and headers.*
			`.trim();

			const notes: FilteredNote[] = [
				{
					file: new MockTFile('daily-note.md') as TFile,
					content: markdownContent,
					createdTime: Date.now(),
					modifiedTime: Date.now()
				}
			];

			const estimate = TokenEstimator.estimateTokens(notes);

			expect(estimate.characterCount).toBeGreaterThan(400);
			expect(estimate.wordCount).toBeGreaterThan(50);
			expect(estimate.totalTokens).toBeGreaterThan(600); // Should include overhead
			expect(estimate.contentTokens).toBeGreaterThan(0);
			expect(estimate.promptOverheadTokens).toBe(550); // Base + 1 note overhead
		});
	});
}); 