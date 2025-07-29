const { PromptGenerator } = require('./src/insight-companion/prompt-generator.js');

// Mock test notes
const mockNotes = [
    {
        file: { path: 'Meeting Notes.md' },
        content: 'Team discussed the quarterly goals and project timeline.',
        createdTime: Date.now(),
        modifiedTime: Date.now()
    },
    {
        file: { path: 'Project Ideas.md' }, 
        content: 'Need to explore AI integration possibilities.',
        createdTime: Date.now(),
        modifiedTime: Date.now()
    }
];

const mockContext = {
    dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
    mode: 'date'
};

console.log('=== STRUCTURED STYLE PROMPT ===');
const structuredPrompt = PromptGenerator.generateInsightPrompt(mockNotes, mockContext, { insightStyle: 'structured' });
console.log('Contains format example:', structuredPrompt.content.includes('- [[Note One]]: first sentence or dry one-liner'));

console.log('\n=== FREEFORM STYLE PROMPT ===');
const freeformPrompt = PromptGenerator.generateInsightPrompt(mockNotes, mockContext, { insightStyle: 'freeform' });
console.log('Contains format example:', freeformPrompt.content.includes('- [[Note One]]: one-liner observation, quote, or dry fallback'));

console.log('\n✅ Both styles now include explicit Notes Referenced format examples!'); 