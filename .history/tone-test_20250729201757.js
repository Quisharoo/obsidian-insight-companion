// Test script to verify the new tone lands correctly
import { PromptGenerator } from './src/insight-companion/prompt-generator.js';

// Sample notes that would typically generate corporate-speak
const testNotes = [
  {
    file: { path: 'Team Communication Review.md' },
    content: 'Another meeting with Sarah about standup format. People still not sharing blockers. The whole process feels forced and people are just going through motions. Need to figure out what\'s actually wrong here.',
    createdTime: Date.now(),
    modifiedTime: Date.now()
  },
  {
    file: { path: 'Leavers Project Status.md' },
    content: 'Leavers estimation API integration delayed again. John mentioned timeline revision but seemed vague about root cause. Something fundamental feels off about our approach. Maybe we\'re solving the wrong problem?',
    createdTime: Date.now(),
    modifiedTime: Date.now()
  },
  {
    file: { path: 'Secret Key Security Issue.md' },
    content: 'Security team flagged the Secret Key naming. Not clear if this is about actual credentials or just convention. Sarah mentioned it in passing during the review. Feels like there might be more to this.',
    createdTime: Date.now(),
    modifiedTime: Date.now()
  },
  {
    file: { path: 'Weekly Planning Session.md' },
    content: 'Discussed Q4 objectives. Sarah brought up communication patterns again. Team seems scattered on priorities. John suggested process changes but no concrete ideas. Another session scheduled for next week.',
    createdTime: Date.now(),
    modifiedTime: Date.now()
  },
  {
    file: { path: 'Client Feedback Discussion.md' },
    content: 'Client wants faster iterations. The feedback loop is broken somewhere. Sarah thinks it\'s internal communication, John thinks it\'s scope creep. Both might be right. Or both might be missing something.',
    createdTime: Date.now(),
    modifiedTime: Date.now()
  }
];

const context = {
  dateRange: { startDate: '2024-01-15', endDate: '2024-01-25' },
  mode: 'date'
};

console.log('=== TESTING NEW TONE ===\n');

const prompt = PromptGenerator.generateInsightPrompt(testNotes, context);

// Extract just the system prompt portion to verify tone
const lines = prompt.content.split('\n');
const systemPromptEnd = lines.findIndex(line => line.includes('NOTES TO ANALYZE'));
const systemPrompt = lines.slice(0, systemPromptEnd).join('\n');

console.log('SYSTEM PROMPT PREVIEW:');
console.log('='.repeat(50));
console.log(systemPrompt.substring(0, 600) + '...\n');

console.log('FULL PROMPT LENGTH:', prompt.content.length);
console.log('ESTIMATED TOKENS:', prompt.estimatedTokens); 