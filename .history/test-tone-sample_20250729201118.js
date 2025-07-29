const { PromptGenerator } = require('./src/insight-companion/prompt-generator.ts');

// Sample notes for testing tone
const sampleNotes = [
  {
    file: { path: 'Team Meeting Notes.md' },
    content: 'Had another conversation with Sarah about the communication issues. The daily standups are still feeling rushed and people aren\'t really sharing what they\'re stuck on. Need to figure out a better format.',
    createdTime: Date.now(),
    modifiedTime: Date.now()
  },
  {
    file: { path: 'Leavers Project Update.md' },
    content: 'Leavers estimation is still unclear. The API integration with the external service is taking longer than expected. John mentioned we might need to revise the timeline again. Feeling like we\'re missing something fundamental.',
    createdTime: Date.now(),
    modifiedTime: Date.now()
  },
  {
    file: { path: 'Secret Key Security.md' },
    content: 'Found out about the Secret Key issue during the security review. Not sure if this is about the actual credentials or just the naming convention. Need to follow up with the security team.',
    createdTime: Date.now(),
    modifiedTime: Date.now()
  }
];

const context = {
  dateRange: { startDate: '2024-01-15', endDate: '2024-01-20' },
  mode: 'date'
};

console.log('=== NEW TONE SAMPLE ===');
const prompt = PromptGenerator.generateInsightPrompt(sampleNotes, context);
console.log(prompt.content); 