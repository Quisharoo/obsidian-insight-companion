import { MarkdownFormatter, FormattingConfig } from '../../src/insight-companion/markdown-formatter';
import { SummaryResult } from '../../src/insight-companion/summary-generator';

describe('MarkdownFormatter', () => {
	let mockSummaryResult: SummaryResult;

	beforeEach(() => {
		mockSummaryResult = {
			content: `# Key Themes

### Personal Development
- Focus on improving evenings and personal time
- Reading self-help books like [[How to Change Your Evenings]]

### Work Projects
- Team collaboration on [[Project Alpha]]
- Meeting notes from [[Daily Standup - Monday]]

# Important People

- **John Doe** - Project Manager mentioned in [[Project Alpha]]
- **Jane Smith** - Referenced in [[Team Retrospective]]

# Action Items

1. Complete code review for [[Feature X]]
2. Schedule meeting with team

# Note References

- [[How to Change Your Evenings]]
- [[Project Alpha]]
- [[Daily Standup - Monday]]
- [[Team Retrospective]]`,
			metadata: {
				dateRange: {
					startDate: '2025-01-15',
					endDate: '2025-01-20'
				},
				notesAnalyzed: 12,
				tokensUsed: {
					prompt: 3562,
					completion: 1538,
					total: 5100
				},
				chunksProcessed: 2,
				generationTime: 81600, // 81.6 seconds in milliseconds
				model: 'gpt-4-0613'
			}
		};
	});

	describe('formatSummary', () => {
		it('should format a complete summary with all sections', () => {
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);

			// Check title
			expect(result).toContain('# 🧠 Insight Summary');

			// Check metadata section
			expect(result).toContain('### 📅 Date Range: `01-15-2025` to `01-20-2025`');
			expect(result).toContain('**Notes Analyzed:** 12');
			expect(result).toContain('**Processing Time:** 81.6s');
			expect(result).toContain('**Model Used:** `gpt-4-0613`');

			// Check token usage section
			expect(result).toContain('## 📊 Token Usage');
			expect(result).toContain('- **Input Tokens:** 3,562');
			expect(result).toContain('- **Output Tokens:** 1,538');
			expect(result).toContain('- **Total Tokens:** 5,100');

			// Check processing section
			expect(result).toContain('## ⚙️ Processing');
			expect(result).toContain('- **Chunks Processed:** 2');
			expect(result).toContain('- **Method:** Multi-chunk with aggregation');

			// Check emoji section headers are transformed
			expect(result).toContain('## 🔍 Key Themes');
			expect(result).toContain('## 👤 Key People Referenced');
			expect(result).toContain('## ✅ Action Items');
			expect(result).toContain('## 📝 Notes Referenced');

			// Check original content is preserved with wiki links
			expect(result).toContain('[[How to Change Your Evenings]]');
			expect(result).toContain('[[Project Alpha]]');
		});

		it('should format single chunk processing correctly', () => {
			mockSummaryResult.metadata.chunksProcessed = 1;
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);

			expect(result).toContain('- **Method:** Single-pass analysis');
		});

		it('should include cost estimate by default', () => {
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);
			expect(result).toContain('- **Estimated Cost:**');
		});

		it('should exclude cost estimate when configured', () => {
			const config: Partial<FormattingConfig> = {
				includeCostEstimate: false
			};
			const result = MarkdownFormatter.formatSummary(mockSummaryResult, config);
			expect(result).not.toContain('- **Estimated Cost:**');
		});

		it('should exclude metadata when configured', () => {
			const config: Partial<FormattingConfig> = {
				includeMetadata: false
			};
			const result = MarkdownFormatter.formatSummary(mockSummaryResult, config);
			
			expect(result).toContain('# 🧠 Insight Summary');
			expect(result).not.toContain('📅 Date Range');
			expect(result).not.toContain('📊 Token Usage');
			expect(result).not.toContain('⚙️ Processing');
		});

		it('should use ISO date format when configured', () => {
			const config: Partial<FormattingConfig> = {
				dateFormat: 'iso'
			};
			const result = MarkdownFormatter.formatSummary(mockSummaryResult, config);
			expect(result).toContain('`2025-01-15` to `2025-01-20`');
		});
	});

	describe('section header transformation', () => {
		it('should transform key themes headers', () => {
			const content = '# Key Themes\n## Main Themes\n### Themes';
			const testResult = { ...mockSummaryResult, content };
			const result = MarkdownFormatter.formatSummary(testResult);

			expect(result).toContain('## 🔍 Key Themes');
		});

		it('should transform people headers', () => {
			const content = '# Important People\n## Key People\n### People Mentioned';
			const testResult = { ...mockSummaryResult, content };
			const result = MarkdownFormatter.formatSummary(testResult);

			expect(result).toContain('## 👤 Key People Referenced');
		});

		it('should transform action items headers', () => {
			const content = '# Action Items\n## Actions\n### Next Steps';
			const testResult = { ...mockSummaryResult, content };
			const result = MarkdownFormatter.formatSummary(testResult);

			expect(result).toContain('## ✅ Action Items');
		});

		it('should transform cross-chunk insights headers', () => {
			const content = '# Cross-Chunk Insights\n## Cross-cutting Insights\n### Overall Insights';
			const testResult = { ...mockSummaryResult, content };
			const result = MarkdownFormatter.formatSummary(testResult);

			expect(result).toContain('## 🔁 Cross-Chunk Insights');
		});

		it('should transform note references headers', () => {
			const content = '# Note References\n## Notes Referenced\n### Referenced Notes';
			const testResult = { ...mockSummaryResult, content };
			const result = MarkdownFormatter.formatSummary(testResult);

			expect(result).toContain('## 📝 Notes Referenced');
		});

		it('should preserve unknown headers', () => {
			const content = '# Unknown Section\n## Random Header';
			const testResult = { ...mockSummaryResult, content };
			const result = MarkdownFormatter.formatSummary(testResult);

			expect(result).toContain('# Unknown Section');
			expect(result).toContain('## Random Header');
		});

		it('should preserve wiki links in content', () => {
			const content = 'References to [[Note 1]] and [[Note 2 with spaces]] should remain intact.';
			const testResult = { ...mockSummaryResult, content };
			const result = MarkdownFormatter.formatSummary(testResult);

			expect(result).toContain('[[Note 1]]');
			expect(result).toContain('[[Note 2 with spaces]]');
		});

		it('should preserve markdown formatting in content', () => {
			const content = '**Bold text** and *italic text* and `code` should be preserved.';
			const testResult = { ...mockSummaryResult, content };
			const result = MarkdownFormatter.formatSummary(testResult);

			expect(result).toContain('**Bold text**');
			expect(result).toContain('*italic text*');
			expect(result).toContain('`code`');
		});
	});

	describe('cost estimation', () => {
		it('should calculate cost for GPT-4 Turbo models correctly', () => {
			mockSummaryResult.metadata.model = 'gpt-4-turbo';
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);
			
			// GPT-4 Turbo: $0.01 per 1K input tokens, $0.03 per 1K output tokens
			// Expected: (3562/1000 * 0.01) + (1538/1000 * 0.03) = 0.03562 + 0.04614 = 0.08176
			expect(result).toContain('$0.0818');
		});

		it('should calculate cost for legacy GPT-4 models correctly', () => {
			mockSummaryResult.metadata.model = 'gpt-4';
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);
			
			// Legacy GPT-4: $0.03 per 1K input tokens, $0.06 per 1K output tokens
			// Expected: (3562/1000 * 0.03) + (1538/1000 * 0.06) = 0.10686 + 0.09228 = 0.19914
			expect(result).toContain('$0.1991');
		});

		it('should detect turbo models by name pattern', () => {
			const turboModels = [
				'gpt-4-0125-preview',
				'gpt-4-1106-preview', 
				'gpt-4-turbo',
				'gpt-4-turbo-preview'
			];

			for (const model of turboModels) {
				mockSummaryResult.metadata.model = model;
				const result = MarkdownFormatter.formatSummary(mockSummaryResult);
				// Should use turbo pricing (lower cost)
				expect(result).toContain('$0.0818');
			}
		});
	});

	describe('date formatting', () => {
		it('should handle various date formats gracefully', () => {
			const dateVariants = [
				{ startDate: '2025-01-15', endDate: '2025-01-20' },
				{ startDate: '15/01/2025', endDate: '20/01/2025' },
				{ startDate: 'Jan 15, 2025', endDate: 'Jan 20, 2025' }
			];

			for (const dateRange of dateVariants) {
				mockSummaryResult.metadata.dateRange = dateRange;
				const result = MarkdownFormatter.formatSummary(mockSummaryResult);
				expect(result).toContain('📅 Date Range:');
			}
		});

		it('should preserve existing readable date formats', () => {
			mockSummaryResult.metadata.dateRange = {
				startDate: 'January 15, 2025',
				endDate: 'January 20, 2025'
			};
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);
			expect(result).toContain('`January 15, 2025`');
			expect(result).toContain('`January 20, 2025`');
		});
	});

	describe('edge cases', () => {
		it('should handle empty content gracefully', () => {
			mockSummaryResult.content = '';
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);
			
			expect(result).toContain('# 🧠 Insight Summary');
			expect(result).toContain('📅 Date Range');
		});

		it('should handle content with only whitespace', () => {
			mockSummaryResult.content = '   \n\n   \n   ';
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);
			
			expect(result).toContain('# 🧠 Insight Summary');
		});

		it('should handle very large token numbers with proper formatting', () => {
			mockSummaryResult.metadata.tokensUsed = {
				prompt: 1234567,
				completion: 987654,
				total: 2222221
			};
			
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);
			expect(result).toContain('1,234,567');
			expect(result).toContain('987,654');
			expect(result).toContain('2,222,221');
		});

		it('should handle zero processing time', () => {
			mockSummaryResult.metadata.generationTime = 0;
			const result = MarkdownFormatter.formatSummary(mockSummaryResult);
			expect(result).toContain('**Processing Time:** 0.0s');
		});
	});
}); 