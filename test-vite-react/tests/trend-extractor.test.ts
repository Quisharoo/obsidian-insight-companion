import { TrendExtractor, TrendOptions } from '../../src/insight-companion/trend-extractor';
import { FilteredNote } from '../../src/insight-companion/note-filter';

describe('TrendExtractor', () => {
  const notes: FilteredNote[] = [
    {
      file: { path: 'Project Alpha.md' } as any,
      content: `---\npeople: [Alice, Bob]\n---\n# Kickoff\nDiscussing Project Alpha timeline. #project/alpha`,
      createdTime: new Date('2025-01-10').getTime(),
      modifiedTime: new Date('2025-01-11').getTime(),
    },
    {
      file: { path: 'Daily Standup - Monday.md' } as any,
      content: `### Updates\nAlice mentioned blockers on Alpha. Meeting with Bob later.`,
      createdTime: new Date('2025-01-12').getTime(),
      modifiedTime: new Date('2025-01-12').getTime(),
    },
    {
      file: { path: 'Retrospective.md' } as any,
      content: `# Learnings\nImproved coordination on Project Alpha.`,
      createdTime: new Date('2025-01-15').getTime(),
      modifiedTime: new Date('2025-01-16').getTime(),
    },
  ];

  const options: TrendOptions = {
    maxTerms: 10,
    minMentions: 2,
    entityHeuristics: true,
    dateSource: 'created',
  };

  test('extracts top terms with counts and dates', () => {
    const result = TrendExtractor.extractTrends(notes, options);
    expect(result.terms.length).toBeGreaterThan(0);
    const alpha = result.terms.find(t => t.term.includes('alpha') || t.term === '#project');
    expect(alpha).toBeDefined();
    expect(typeof result.terms[0].mentions).toBe('number');
    expect(result.terms[0].firstSeen).toMatch(/2025-01/);
    expect(result.terms[0].lastSeen).toMatch(/2025-01/);
  });

  test('respects minMentions threshold', () => {
    const low = { ...options, minMentions: 100 };
    const result = TrendExtractor.extractTrends(notes, low);
    expect(result.terms.length).toBe(0);
  });

  test('computes delta between runs', () => {
    const current = TrendExtractor.extractTrends(notes, options).terms;
    const previous = current.map(t => ({ ...t, mentions: Math.max(0, t.mentions - 2) }));
    const delta = TrendExtractor.computeDelta(previous, current);
    expect(delta.length).toBe(current.length);
    expect(delta[0]).toHaveProperty('term');
    expect(delta[0]).toHaveProperty('deltaMentions');
  });
});


