import { FilteredNote } from './note-filter';

export interface TrendOptions {
  maxTerms: number; // Top N terms to return
  minMentions: number; // Minimum total mentions across corpus to include
  entityHeuristics: boolean; // Enable entity heuristics (People/Projects)
  dateSource: 'created' | 'modified'; // Which timestamp to use for first/last seen
}

export interface TrendEntry {
  term: string;
  mentions: number;
  notesCount: number;
  firstSeen: string; // ISO date
  lastSeen: string; // ISO date
}

export interface TrendResult {
  terms: TrendEntry[];
}

const DEFAULT_STOPWORDS = new Set<string>([
  // Articles / conjunctions / prepositions / pronouns
  'the','and','a','an','of','to','in','is','it','for','on','with','as','at','by','from','or','be','are','was','were','that','this','these','those','but','if','not','can','could','should','would','will','just','about','into','than','then','so','very','over','under','between','because','while','during','where','when','who','whom','which','what','why','how','also','we','you','they','he','she','i','me','my','our','your','their','them','us','there','here','out','up','down','off','again','once','only','both','each','few','more','most','other','some','such','no','nor','too','own','same','so','too','than','ever','never','always','sometimes','often','across','after','before','around','through','without','within','toward','towards','until','since','among','amongst','per','via','vs',
  // Common markdown / vault noise
  'http','https','www','com','md','jpg','png','gif','pdf','amp','nbsp'
]);

/**
 * Lightweight tokenizer with optional stemming. Preserves hashtags and wiki-links words.
 */
function tokenize(input: string): string[] {
  const cleaned = input
    .replace(/\[\[(.+?)\]\]/g, '$1') // unwrap wiki links
    .replace(/[^\p{L}\p{N}#\s'-]/gu, ' ') // keep letters, numbers, hashtags, spaces, apostrophes, hyphens
    .toLowerCase();
  const raw = cleaned.split(/\s+/).filter(Boolean);
  return raw.map(t => t.replace(/^'+|'+$/g, '')); // trim surrounding apostrophes
}

function simpleStem(token: string): string {
  // Do not stem hashtags; keep short tokens unmodified
  if (token.startsWith('#') || token.length <= 3) return token;
  // Basic suffix stripping
  const patterns: RegExp[] = [/(ing|ed|ly|ness|ment|ers|er|s)$/];
  let stem = token;
  for (const re of patterns) {
    stem = stem.replace(re, '');
  }
  return stem.length >= 3 ? stem : token;
}

function extractTitleFromPath(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  return fileName.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
}

function extractFrontmatterPeople(content: string): string[] {
  const fmMatch = content.match(/^---[\s\S]*?---/m);
  if (!fmMatch) return [];
  const fm = fmMatch[0];
  const peopleLine = fm.match(/^\s*(people|person|persons)\s*:\s*(.+)$/im);
  if (!peopleLine) return [];
  const raw = peopleLine[2].trim();
  // Support YAML array [A, B] or comma-separated "A, B"
  const list = raw
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(/[,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return list;
}

function hasProjectTag(content: string): boolean {
  return /(^|\s)#project(\/[^\s#]+)?\b/i.test(content);
}

export class TrendExtractor {
  static extractTrends(notes: FilteredNote[], options: TrendOptions): TrendResult {
    const termToMentions = new Map<string, number>();
    const termToNotes = new Map<string, Set<number>>();
    const termFirstSeen = new Map<string, number>();
    const termLastSeen = new Map<string, number>();

    notes.forEach((note, idx) => {
      const content = note.content || '';
      const title = extractTitleFromPath(note.file?.path || '');

      const titleTokens = tokenize(title);
      const headingTokens: string[] = [];
      const bodyTokens: string[] = [];

      const lines = content.split(/\n+/);
      for (const line of lines) {
        if (/^\s*#{1,6}\s+/.test(line)) {
          headingTokens.push(...tokenize(line.replace(/^\s*#{1,6}\s+/, '')));
        } else {
          bodyTokens.push(...tokenize(line));
        }
      }

      const people = options.entityHeuristics ? extractFrontmatterPeople(content) : [];
      const hasProj = options.entityHeuristics ? hasProjectTag(content) : false;

      const weightedTokens: Array<{ token: string; weight: number; preserve?: boolean }> = [];
      for (const t of titleTokens) weightedTokens.push({ token: t, weight: 2 });
      for (const t of headingTokens) weightedTokens.push({ token: t, weight: 1.5 });
      for (const t of bodyTokens) weightedTokens.push({ token: t, weight: 1 });
      // Entity heuristics: treat people names and project tag as strong signals
      for (const p of people) weightedTokens.push({ token: p.toLowerCase(), weight: 2.5, preserve: true });
      if (hasProj) weightedTokens.push({ token: '#project', weight: 2.0, preserve: true });

      const seenThisNote = new Set<string>();

      for (const { token, weight, preserve } of weightedTokens) {
        if (!token) continue;
        if (!preserve && DEFAULT_STOPWORDS.has(token)) continue;
        // Skip numeric-only tokens
        if (!preserve && /^\d+$/.test(token)) continue;
        // Skip tokens shorter than 3 chars unless hashtag or preserved entity
        if (!preserve && !token.startsWith('#') && token.length < 3) continue;

        const normalized = preserve ? token : simpleStem(token);
        if (!normalized || (!preserve && !normalized.startsWith('#') && normalized.length < 3)) continue;

        const curr = termToMentions.get(normalized) || 0;
        termToMentions.set(normalized, curr + weight);

        if (!seenThisNote.has(normalized)) {
          seenThisNote.add(normalized);
          if (!termToNotes.has(normalized)) termToNotes.set(normalized, new Set());
          termToNotes.get(normalized)!.add(idx);
        }

        const ts = options.dateSource === 'modified' ? note.modifiedTime : note.createdTime;
        if (typeof ts === 'number') {
          const first = termFirstSeen.get(normalized);
          const last = termLastSeen.get(normalized);
          termFirstSeen.set(normalized, first === undefined ? ts : Math.min(first, ts));
          termLastSeen.set(normalized, last === undefined ? ts : Math.max(last, ts));
        }
      }
    });

    // Build entries and filter by minMentions
    const entries: TrendEntry[] = [];
    for (const [term, mentions] of termToMentions.entries()) {
      if (mentions < options.minMentions) continue;
      const notesSet = termToNotes.get(term) || new Set<number>();
      const first = termFirstSeen.get(term);
      const last = termLastSeen.get(term);
      entries.push({
        term,
        mentions: Math.round(mentions),
        notesCount: notesSet.size,
        firstSeen: first ? new Date(first).toISOString().slice(0, 10) : '',
        lastSeen: last ? new Date(last).toISOString().slice(0, 10) : ''
      });
    }

    entries.sort((a, b) => {
      if (b.mentions !== a.mentions) return b.mentions - a.mentions;
      if (b.notesCount !== a.notesCount) return b.notesCount - a.notesCount;
      return a.term.localeCompare(b.term);
    });

    return { terms: entries.slice(0, options.maxTerms) };
  }

  static computeDelta(previous: TrendEntry[], current: TrendEntry[]): Array<{ term: string; deltaMentions: number }> {
    const prevMap = new Map(previous.map(t => [t.term, t.mentions] as const));
    return current.map(t => ({ term: t.term, deltaMentions: (t.mentions - (prevMap.get(t.term) || 0)) }));
  }
}


