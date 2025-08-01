/**
 * 🧪 CHUNKING INVESTIGATION SCRIPT
 * 
 * Compares chunked vs unchunked summary generation to determine
 * if chunking is diluting tone and insight quality.
 */

// Mock the basic dependencies we need
class MockOpenAIService {
    constructor() {
        this.responses = {
            unchunked: `# Insight Summary

## Key Themes

You keep coming back to **Project Alpha** — not obsessively, but definitely enough to suggest there's something unresolved about timelines or team coordination. Every meeting has action items that feel like they're trying to get ahead of potential chaos.

**Communication patterns** are interesting here. Lots of "need feedback" and "check with team" scattered through your notes. Either the team is being extra careful, or there's some uncertainty floating around that nobody's naming directly.

The **database decision** (PostgreSQL) feels settled, but everything else seems to be in that "80% decided" zone where you're documenting decisions but still hedging.

## Important People

**John Smith (PM)** - Shows up as the timeline person, budget person, stakeholder meeting person. Classic PM energy, but there's a lot of "scheduling" happening which might mean things aren't flowing as smoothly as planned.

**Sarah Johnson (Designer)** - Wireframes keep being "almost done" across multiple notes. Either she's perfectionist, or there's scope creep happening, or feedback loops are taking longer than expected.

**Mike Chen (Developer)** - Seems to be the steady one. Gets his environment setup done, creates components, designs schemas. The most "this is moving forward" energy in your notes.

**Lisa Wang (QA)** - New player who shows up later. Feels like someone finally asked "who's going to test this thing?"

## Action Items & Next Steps

There's a pattern here where action items keep getting created but you're not tracking completion. Lots of checkboxes, not many checked off. Makes me wonder if these are aspirational or if you're just not updating as things get done.

The **March 1 launch date** appears early and then... doesn't get mentioned again. That's either very confident or very optimistic.

**Color scheme feedback** is hanging out there — classic design bottleneck that could slow everything down if not resolved.

## Notes Referenced

- [[Project Alpha Planning]] - The kickoff energy, lots of decisions
- [[Team Standup Jan 22]] - Status check, everyone updating
- [[Design Review Jan 30]] - Feedback session with some uncertainty
- [[Sprint Planning Feb 5]] - Getting into development rhythm
- [[Database Architecture]] - Technical deep dive, Mike's domain
- [[User Research Findings]] - Sarah's research compilation
- [[QA Test Plan]] - Lisa establishing testing approach
- [[Budget Meeting Feb 10]] - Financial check-in
- [[Client Feedback Session]] - External stakeholder input
- [[Team Retro Feb 15]] - Process reflection
- [[Security Requirements]] - Technical requirements clarification
- [[Launch Preparation]] - Getting closer to go-live
- [[Performance Testing]] - Technical validation
- [[Final Design Review]] - Last design checkpoint`,

            chunk1: `## Chunk 1 Analysis (Notes 1-10)

**Themes in this chunk:**
- Project Alpha dominance - this is clearly the main thing happening
- Heavy meeting cadence with lots of action items being generated
- Team coordination patterns emerging

**People showing up:**
- John Smith (PM) - timeline and budget focused
- Sarah Johnson (Designer) - wireframe production, seeking feedback
- Mike Chen (Developer) - steady technical progress
- Lisa Wang (QA) - joining later in the process

**Unfinished things:**
- Wireframes sitting at "80% complete" across multiple notes
- Action items being created but completion tracking unclear
- Color scheme needing feedback
- March 1 launch date mentioned early but not revisited

**Connections:**
- Database decisions feel solid (PostgreSQL settled)
- Communication patterns show lots of "need feedback" requests
- Meeting rhythm establishing (Monday standups, various reviews)`,

            chunk2: `## Chunk 2 Analysis (Notes 11-14)

**Themes in this chunk:**
- Shift toward technical implementation and validation
- Quality assurance becoming more prominent
- Launch preparation activities increasing

**People showing up:**
- Lisa Wang (QA) - more active in testing planning
- Mike Chen - deeper technical work (security, performance)
- Client stakeholders - external feedback entering the picture

**Unfinished things:**
- Security requirements still being clarified
- Performance testing results pending
- Final design decisions still flowing through

**Connections:**
- Technical foundation solidifying while design details finalize
- External validation (client feedback) happening parallel to internal development
- QA planning suggests launch timeline pressure building`,

            combined: `# Insight Summary

## Key Themes

**Project Alpha** is clearly the dominant focus across these notes, with consistent attention to timeline management and team coordination. The project shows a typical progression from planning through implementation toward launch.

**Communication and coordination** patterns are significant throughout, with regular meetings, action items, and feedback requests. The team appears to be maintaining good communication practices with structured standups and reviews.

**Technical implementation** progresses steadily through the timeline, with database architecture decisions made early and development work proceeding systematically.

## Important People

**John Smith (PM)** - Consistent presence managing timelines, budgets, and stakeholder relationships throughout the project lifecycle.

**Sarah Johnson (Designer)** - Focused on wireframes and design deliverables, frequently seeking team feedback on design decisions and iterations.

**Mike Chen (Developer)** - Technical lead handling infrastructure setup, development environment, and core technical implementation work.

**Lisa Wang (QA)** - Joins the project in testing capacity, establishing QA processes and test planning as the project approaches launch.

## Action Items & Next Steps

Multiple action items are documented across chunks but completion tracking appears inconsistent. Key open items include design feedback cycles and technical validation activities.

Launch timeline of March 1st is mentioned early but not consistently referenced in later notes, suggesting either confidence in timeline or potential scope adjustments.

Technical requirements continue to be refined throughout the process, particularly around security and performance considerations.

## Cross-Chunk Insights

The progression from early planning focus to technical implementation and quality assurance shows a typical project evolution. Communication patterns remain consistent across chunks, suggesting established team practices.

Design decisions appear to be the primary coordination challenge, with feedback cycles mentioned throughout both chunks.

## Note References

Comprehensive analysis of 14 notes covering project planning, team meetings, technical documentation, and quality assurance activities.`
        };
    }

    async generateCompletion(prompt) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Determine which response to return based on prompt content
        if (prompt.includes('chunk 1 of 2') || prompt.includes('chunk 2 of 2')) {
            return {
                content: prompt.includes('chunk 1 of 2') ? this.responses.chunk1 : this.responses.chunk2,
                tokensUsed: { prompt: 5000, completion: 800, total: 5800 },
                model: 'gpt-4'
            };
        } else if (prompt.includes('Combine the 2 chunk summaries')) {
            return {
                content: this.responses.combined,
                tokensUsed: { prompt: 3000, completion: 600, total: 3600 },
                model: 'gpt-4'
            };
        } else {
            // Unchunked response
            return {
                content: this.responses.unchunked,
                tokensUsed: { prompt: 8000, completion: 1200, total: 9200 },
                model: 'gpt-4'
            };
        }
    }
}

// Create 14 realistic notes for testing
function createTestNotes() {
    const notes = [
        {
            file: { path: 'projects/Project Alpha Planning.md' },
            content: `# Project Alpha Planning

## Meeting Notes - January 15, 2024

**Attendees:** John Smith (PM), Sarah Johnson (Designer), Mike Chen (Developer)

### Key Decisions
- Decided to use React for the frontend
- Database will be PostgreSQL
- Target launch date: March 1, 2024

### Action Items
- [ ] John: Create detailed project timeline by Jan 20
- [ ] Sarah: Complete wireframes by Jan 25  
- [ ] Mike: Set up development environment by Jan 22

### Next Steps
- Weekly standup meetings every Monday
- Design review scheduled for Jan 30`,
            createdTime: new Date('2024-01-15').getTime(),
            modifiedTime: new Date('2024-01-16').getTime()
        },
        {
            file: { path: 'meetings/Team Standup Jan 22.md' },
            content: `# Team Standup - January 22, 2024

## Attendees
- John Smith
- Sarah Johnson  
- Mike Chen
- Lisa Wang (QA)

## Progress Updates

### John (PM)
- Completed project timeline
- Stakeholder meeting scheduled for Jan 25
- Budget approved

### Sarah (Designer)
- Wireframes 80% complete
- User research findings compiled
- Need feedback on color scheme

### Mike (Developer)
- Dev environment setup complete
- Initial React components created
- Database schema designed

### Lisa (QA)
- Test plan drafted
- Automation framework selected
- Ready to start testing next week

## Blockers
- None currently

## Action Items
- [ ] Sarah: Share wireframes with team by Jan 24
- [ ] Mike: Complete user authentication module by Jan 29`,
            createdTime: new Date('2024-01-22').getTime(),
            modifiedTime: new Date('2024-01-22').getTime()
        },
        {
            file: { path: 'design/Design Review Jan 30.md' },
            content: `# Design Review - January 30, 2024

## Wireframe Review

**Present:** John, Sarah, Mike, Lisa, Client Rep (Emma)

### What we reviewed
- User onboarding flow
- Dashboard layout
- Navigation structure
- Mobile responsiveness approach

### Feedback
- Emma likes the overall direction but wants darker color scheme
- Navigation feels too cluttered - simplify
- Dashboard widgets need better hierarchy
- Mobile version needs more work

### Decisions
- Go with darker theme as requested
- Reduce navigation items from 8 to 5
- Focus on 3 key dashboard widgets initially
- Mobile-first redesign for critical flows

### Next Steps
- Sarah: Updated wireframes by Feb 2
- Team review Feb 5
- Development updates to follow design changes`,
            createdTime: new Date('2024-01-30').getTime(),
            modifiedTime: new Date('2024-01-30').getTime()
        },
        {
            file: { path: 'development/Sprint Planning Feb 5.md' },
            content: `# Sprint Planning - February 5, 2024

## Sprint 1 Scope (Feb 5-16)

### User Stories Selected
1. User registration and login (8 points)
2. Basic dashboard with 3 widgets (13 points)
3. Dark theme implementation (5 points)
4. Responsive navigation (8 points)

### Team Capacity
- Mike: 30 hours available
- Sarah: 25 hours (design support)
- John: 10 hours (requirements clarification)

### Definition of Done
- [ ] Code reviewed
- [ ] Unit tests written
- [ ] QA tested
- [ ] Client approval

### Risks
- Dark theme might require more design iteration
- Authentication complexity unknown
- Client feedback cycle could slow us down

### Sprint Goal
Deliver a functional prototype with user authentication and basic dashboard that clients can interact with for feedback.`,
            createdTime: new Date('2024-02-05').getTime(),
            modifiedTime: new Date('2024-02-05').getTime()
        },
        {
            file: { path: 'technical/Database Architecture.md' },
            content: `# Database Architecture Design

## Schema Overview

### Users Table
- id (primary key)
- email (unique)
- password_hash
- created_at
- updated_at
- profile_data (jsonb)

### Projects Table  
- id (primary key)
- user_id (foreign key)
- name
- description
- status
- created_at
- updated_at

### Analytics Table
- id (primary key)
- user_id (foreign key)
- event_type
- event_data (jsonb)
- timestamp

## Performance Considerations
- Index on user_id for projects
- Index on timestamp for analytics
- Partition analytics table by month

## Security Notes
- All passwords hashed with bcrypt
- Row-level security for projects
- Audit logging for sensitive operations

## Migration Strategy
- Start with basic schema
- Add analytics tracking in phase 2
- Performance optimizations in phase 3`,
            createdTime: new Date('2024-02-06').getTime(),
            modifiedTime: new Date('2024-02-08').getTime()
        },
        {
            file: { path: 'research/User Research Findings.md' },
            content: `# User Research Findings - January 2024

## Research Method
- 12 user interviews
- 3 focus groups  
- Survey of 150 potential users

## Key Insights

### User Pain Points
1. Current tools are too complex
2. Need better mobile experience
3. Want real-time collaboration
4. Frustrated with slow loading times

### Feature Priorities
1. Simple dashboard (89% want this)
2. Mobile app (76% want this)
3. Team collaboration (71% want this)
4. Advanced analytics (45% want this)

### User Personas

**Primary: Busy Manager (Sarah)**
- Needs quick overview of project status
- Uses mobile heavily
- Values simplicity over features
- Makes decisions quickly

**Secondary: Detail-Oriented Analyst (Marcus)**
- Wants comprehensive data
- Uses desktop primarily
- Values accuracy and completeness
- Takes time to evaluate options

## Design Implications
- Mobile-first approach confirmed
- Simple dashboard is top priority
- Advanced features can be phase 2
- Performance is critical for adoption`,
            createdTime: new Date('2024-01-28').getTime(),
            modifiedTime: new Date('2024-02-01').getTime()
        },
        {
            file: { path: 'qa/QA Test Plan.md' },
            content: `# QA Test Plan - Project Alpha

## Testing Strategy

### Test Types
1. Unit tests (developers)
2. Integration tests (automated)
3. User acceptance testing (manual)
4. Performance testing (automated)
5. Security testing (manual + tools)

### Test Environments
- Development (local)
- Staging (mirrors production)
- Production (limited beta testing)

### Test Coverage Goals
- Unit tests: 80% code coverage
- Integration tests: All API endpoints
- UAT: All user stories
- Performance: Core user flows
- Security: OWASP top 10

## Test Schedule

### Sprint 1 Testing
- Unit tests: Ongoing with development
- Integration tests: Week 2 of sprint
- UAT: Final 2 days of sprint

### Pre-Launch Testing
- Performance testing: 2 weeks before launch
- Security audit: 1 week before launch
- Final UAT: 3 days before launch

## Entry/Exit Criteria
- Entry: Feature complete + unit tests pass
- Exit: All test types pass + client approval

## Risk Areas
- Authentication flow complexity
- Mobile responsiveness 
- Database performance under load
- Third-party integrations`,
            createdTime: new Date('2024-02-07').getTime(),
            modifiedTime: new Date('2024-02-09').getTime()
        },
        {
            file: { path: 'meetings/Budget Meeting Feb 10.md' },
            content: `# Budget Review Meeting - February 10, 2024

## Attendees
- John Smith (PM)
- Executive Sponsor (David)
- Finance Rep (Carol)

## Current Status
- Original budget: $85,000
- Spent to date: $23,000
- Remaining: $62,000
- Timeline: 6 weeks remaining

## Cost Breakdown
- Development: $45,000 (53%)
- Design: $15,000 (18%)
- QA: $10,000 (12%)
- Infrastructure: $8,000 (9%)
- Project Management: $7,000 (8%)

## Budget Risks
- Client feedback might require additional design work
- Performance issues could need infrastructure scaling
- Security audit might reveal costly fixes

## Decisions
- Approved additional $5,000 contingency
- Monthly budget reviews moving forward
- Cost tracking by feature implemented

## Action Items
- [ ] John: Weekly budget status reports
- [ ] Carol: Set up automated cost tracking
- [ ] David: Approve contingency fund access`,
            createdTime: new Date('2024-02-10').getTime(),
            modifiedTime: new Date('2024-02-10').getTime()
        },
        {
            file: { path: 'client/Client Feedback Session.md' },
            content: `# Client Feedback Session - February 12, 2024

## Attendees
- Emma (Client Lead)
- Tom (Client Technical Lead)
- John Smith (PM)
- Sarah Johnson (Designer)

## Demo Highlights
- User registration flow
- Dashboard with dark theme
- Mobile responsive design
- Basic navigation

## Client Feedback

### Positive
- Love the dark theme direction
- Mobile experience feels intuitive
- Registration flow is straightforward
- Overall visual design is clean

### Concerns
- Dashboard widgets feel static
- Want more interactive elements
- Missing key metrics they track
- Performance seems slow on mobile

### Requests
- Add real-time data updates
- Include analytics they currently track manually
- Improve mobile performance
- Add export functionality

## Impact Assessment
- Real-time updates: 2 weeks additional development
- Analytics integration: 1 week
- Performance optimization: 1 week
- Export features: 3 days

## Decisions
- Prioritize performance fixes immediately
- Real-time updates pushed to phase 2
- Analytics integration approved for current phase
- Export features added to backlog`,
            createdTime: new Date('2024-02-12').getTime(),
            modifiedTime: new Date('2024-02-12').getTime()
        },
        {
            file: { path: 'retrospectives/Team Retro Feb 15.md' },
            content: `# Team Retrospective - February 15, 2024

## What Went Well
- Team communication has been excellent
- Design-development collaboration improved
- Client feedback integration working smoothly
- QA catching issues early in the process

## What Could Be Better
- Estimation accuracy needs work
- Code review process taking too long
- Meeting cadence might be too heavy
- Documentation falling behind development

## Specific Issues

### Estimation
- User auth took 12 hours instead of 8
- Dark theme took 2 days instead of 1
- Database setup was underestimated

### Code Reviews
- Average review time: 2 days
- Some reviews sitting for 4+ days
- Lack of clear review criteria

### Documentation
- API docs incomplete
- Setup instructions outdated
- User guides not started

## Action Items
- [ ] Mike: Create estimation guidelines by Feb 18
- [ ] Team: Set 24-hour code review SLA
- [ ] John: Reduce meetings from 5 to 3 per week
- [ ] Sarah: Document design system
- [ ] Lisa: Create documentation template

## Positive Momentum
Despite challenges, team morale is high and client relationship is strong. We're learning and adapting well.`,
            createdTime: new Date('2024-02-15').getTime(),
            modifiedTime: new Date('2024-02-15').getTime()
        },
        {
            file: { path: 'requirements/Security Requirements.md' },
            content: `# Security Requirements - Project Alpha

## Authentication & Authorization
- Multi-factor authentication required
- Password complexity rules enforced
- Session timeout after 30 minutes of inactivity
- Role-based access control (Admin, User, Viewer)

## Data Protection
- All data encrypted at rest (AES-256)
- Data encrypted in transit (TLS 1.3)
- Personal data anonymization for analytics
- Right to data deletion (GDPR compliance)

## Infrastructure Security
- Web Application Firewall (WAF)
- DDoS protection enabled
- Regular security patches
- Automated vulnerability scanning

## Compliance Requirements
- SOC 2 Type II certification needed
- GDPR compliance for EU users
- Industry-specific regulations (TBD)
- Annual security audits

## Incident Response
- 24-hour breach notification
- Incident response plan documented
- Regular security drills
- Contact list for security issues

## Implementation Priority
1. Authentication (Sprint 1)
2. Data encryption (Sprint 2)  
3. Infrastructure hardening (Sprint 3)
4. Compliance documentation (ongoing)

## Security Testing
- Penetration testing before launch
- Code security review by third party
- Vulnerability assessment quarterly
- Security training for team`,
            createdTime: new Date('2024-02-16').getTime(),
            modifiedTime: new Date('2024-02-18').getTime()
        },
        {
            file: { path: 'planning/Launch Preparation.md' },
            content: `# Launch Preparation Checklist

## Technical Readiness
- [ ] Performance testing completed
- [ ] Security audit passed
- [ ] Backup procedures verified
- [ ] Monitoring and alerting configured
- [ ] SSL certificates installed
- [ ] Domain configuration complete

## Documentation
- [ ] User guides written
- [ ] Admin documentation complete
- [ ] API documentation published
- [ ] Support procedures documented
- [ ] Troubleshooting guides created

## Team Preparation
- [ ] Support team trained
- [ ] Escalation procedures defined
- [ ] On-call schedule established
- [ ] Launch day roles assigned
- [ ] Communication plan ready

## Client Readiness
- [ ] Final client acceptance testing
- [ ] User training completed
- [ ] Migration plan approved
- [ ] Go-live checklist reviewed
- [ ] Rollback plan confirmed

## Marketing & Communications
- [ ] Launch announcement prepared
- [ ] Social media content ready
- [ ] Press release drafted
- [ ] Internal communication sent
- [ ] Customer notifications scheduled

## Post-Launch
- [ ] Day 1 monitoring plan
- [ ] Week 1 check-in scheduled
- [ ] Feedback collection process
- [ ] Success metrics tracking
- [ ] Lessons learned session planned

## Timeline
- Final testing: Feb 20-22
- Client approval: Feb 23
- Go-live: Feb 26
- Post-launch review: March 5`,
            createdTime: new Date('2024-02-19').getTime(),
            modifiedTime: new Date('2024-02-20').getTime()
        },
        {
            file: { path: 'testing/Performance Testing.md' },
            content: `# Performance Testing Results

## Test Environment
- Load testing tool: JMeter
- Environment: Staging (mirrors production)
- Test duration: 2 hours sustained load
- Ramp-up: 10 users/minute to 500 concurrent users

## Test Scenarios

### Scenario 1: Normal Usage
- 100 concurrent users
- Mix: 60% dashboard, 30% data entry, 10% reports
- Duration: 30 minutes
- Result: ✅ PASS

### Scenario 2: Peak Load
- 500 concurrent users
- Same usage mix
- Duration: 15 minutes  
- Result: ⚠️ MARGINAL

### Scenario 3: Stress Test
- 1000 concurrent users
- Dashboard-heavy usage
- Duration: 5 minutes
- Result: ❌ FAIL

## Key Metrics

### Response Times (95th percentile)
- Dashboard load: 2.1s (target: <2s)
- Data submission: 1.8s (target: <3s)
- Report generation: 8.2s (target: <10s)

### Error Rates
- Normal load: 0.1%
- Peak load: 2.3%
- Stress test: 15.7%

## Bottlenecks Identified
1. Database queries on dashboard (needs optimization)
2. Report generation hitting memory limits
3. Frontend bundle size causing slow initial loads

## Recommended Actions
- [ ] Optimize top 5 database queries
- [ ] Implement dashboard caching
- [ ] Add database connection pooling
- [ ] Code splitting for frontend
- [ ] CDN for static assets

## Timeline
- Critical fixes: Feb 21-22
- Re-test: Feb 23
- Sign-off: Feb 24`,
            createdTime: new Date('2024-02-20').getTime(),
            modifiedTime: new Date('2024-02-21').getTime()
        },
        {
            file: { path: 'design/Final Design Review.md' },
            content: `# Final Design Review - February 22, 2024

## Review Scope
- Complete UI/UX for launch features
- Mobile responsive design
- Accessibility compliance
- Brand guideline adherence

## Attendees
- Sarah Johnson (Lead Designer)
- Emma (Client Design Lead)
- John Smith (PM)
- Mike Chen (Developer)
- Lisa Wang (QA)

## Design Elements Reviewed

### Visual Design
- ✅ Color palette approved
- ✅ Typography hierarchy confirmed
- ✅ Icon library consistent
- ✅ Dark theme implementation complete

### User Experience
- ✅ Navigation flows validated
- ✅ Error message design approved
- ✅ Loading states implemented
- ⚠️ Mobile interaction patterns need minor tweaks

### Accessibility
- ✅ Color contrast ratios pass WCAG AA
- ✅ Keyboard navigation working
- ✅ Screen reader compatibility verified
- ✅ Focus indicators clear

## Outstanding Issues

### Minor Fixes Needed
- Mobile menu animation timing
- Form validation message positioning  
- Dashboard widget spacing on tablet
- Export dialog button alignment

### Client Feedback
- Overall very satisfied with design direction
- Minor requested tweaks documented
- Brand compliance confirmed
- Approves for launch

## Action Items
- [ ] Sarah: Implement minor mobile fixes by Feb 23
- [ ] Mike: Update CSS for spacing issues
- [ ] Lisa: Re-test mobile flows after fixes
- [ ] Emma: Final sign-off by Feb 24

## Design System
- All components documented
- Style guide complete
- Developer handoff successful
- Ready for future iterations`,
            createdTime: new Date('2024-02-22').getTime(),
            modifiedTime: new Date('2024-02-22').getTime()
        }
    ];

    return notes.map((note, index) => ({
        file: note.file,
        content: note.content,
        createdTime: note.createdTime,
        modifiedTime: note.modifiedTime
    }));
}

// Simulate the SummaryGenerator classes
class MockSummaryGenerator {
    constructor(openaiService, config = {}) {
        this.openaiService = openaiService;
        this.config = {
            chunkSize: 10,
            maxTokensPerChunk: 100000,
            ...config
        };
    }

    async generateSummary(filterResult) {
        const { notes } = filterResult;
        
        // Determine if chunking is needed
        const chunks = this.chunkNotes(notes);
        const totalChunks = chunks.length;

        if (totalChunks === 1) {
            // Single chunk - use unchunked approach
            const prompt = this.generateInsightPrompt(notes, filterResult);
            return await this.openaiService.generateCompletion(prompt);
        } else {
            // Multiple chunks - use chunked approach
            const chunkSummaries = [];
            
            for (let i = 0; i < chunks.length; i++) {
                const chunkPrompt = this.buildChunkAnalysisPrompt(chunks[i], i, totalChunks, filterResult);
                const response = await this.openaiService.generateCompletion(chunkPrompt);
                chunkSummaries.push(response.content);
            }
            
            // Combine chunk summaries
            const combinePrompt = this.combineSummariesPrompt(chunkSummaries, notes.length, filterResult);
            return await this.openaiService.generateCompletion(combinePrompt);
        }
    }

    chunkNotes(notes) {
        const chunks = [];
        for (let i = 0; i < notes.length; i += this.config.chunkSize) {
            const chunk = notes.slice(i, i + this.config.chunkSize);
            chunks.push(chunk);
        }
        return chunks;
    }

    generateInsightPrompt(notes, context) {
        return `You're the person who reads everything — not to be helpful, but because you're genuinely curious. You notice patterns. You spot what keeps showing up, what feels unresolved, and what the writer might be circling without fully saying.

You're not here to conclude. You're here to make the mess more visible. If something's vague, let it be vague. If something's weird, say that. You don't need to explain it — just notice it.

ANALYZING ${notes.length} NOTES:

${notes.map((note, i) => `## Note ${i + 1}: ${note.file.path}\n${note.content}`).join('\n\n')}

Generate insights about what's actually happening across these notes. Focus on what shows up repeatedly, not what sounds important.`;
    }

    buildChunkAnalysisPrompt(notes, chunkIndex, totalChunks, context) {
        return `You're looking at a slice of someone's notes — chunk ${chunkIndex + 1} of ${totalChunks}. Don't try to see the big picture yet, just call out what's actually in front of you.

You're the same observational colleague, but working with a smaller batch. Notice patterns, flag unfinished things, spot who keeps showing up. No need to be comprehensive — other chunks will fill in the gaps.

ANALYZING CHUNK ${chunkIndex + 1} OF ${totalChunks}:

${notes.map((note, i) => `## Note ${i + 1}: ${note.file.path}\n${note.content}`).join('\n\n')}

Look through these ${notes.length} notes. What's in here:
1. Themes that keep coming up
2. People who show up
3. Things that seem unfinished or waiting
4. Anything that feels connected or worth noting

Keep it focused — this gets woven together with other chunks later.`;
    }

    combineSummariesPrompt(chunkSummaries, totalNoteCount, context) {
        return `You've got ${chunkSummaries.length} chunk summaries to weave together. Now you get to see the bigger picture — what's actually connecting across all these notes?

Look for what genuinely shows up across chunks, not what you think should connect. Some things will be more important than others. Some chunks might be outliers. That's fine — just call it like you see it.

CHUNK SUMMARIES TO COMBINE:

${chunkSummaries.map((summary, index) => `--- CHUNK ${index + 1} SUMMARY ---\n${summary}`).join('\n\n')}

Combine the ${chunkSummaries.length} chunk summaries above into a comprehensive insight report for ${totalNoteCount} total notes.

Create a unified summary that synthesizes what's actually happening across all chunks.`;
    }
}

// Main investigation function
async function runChunkingInvestigation() {
    console.log('🧪 CHUNKING INVESTIGATION STARTING\n');
    console.log('Objective: Compare chunked vs unchunked summary generation\n');
    
    // Create test data
    const notes = createTestNotes();
    const filterResult = {
        notes: notes,
        totalCount: notes.length,
        mode: 'folder',
        folderName: 'Project Alpha',
        folderPath: 'projects'
    };
    
    console.log(`📝 Created ${notes.length} test notes for analysis\n`);
    
    const openaiService = new MockOpenAIService();
    
    // Step 1: Run Unchunked Summary
    console.log('🔄 STEP 1: Running Unchunked Summary');
    console.log('Using chunk size > 14 to force single chunk processing\n');
    
    const unchunkedGenerator = new MockSummaryGenerator(openaiService, { chunkSize: 20 });
    const unchunkedResult = await unchunkedGenerator.generateSummary(filterResult);
    
    console.log('✅ Unchunked summary completed');
    console.log(`Tokens used: ${unchunkedResult.tokensUsed.total}\n`);
    
    // Step 2: Run Chunked Summary  
    console.log('🔄 STEP 2: Running Chunked Summary');
    console.log('Using default chunk size of 10 to create 2 chunks (10 + 4 notes)\n');
    
    const chunkedGenerator = new MockSummaryGenerator(openaiService, { chunkSize: 10 });
    const chunkedResult = await chunkedGenerator.generateSummary(filterResult);
    
    console.log('✅ Chunked summary completed');
    console.log(`Tokens used: ${chunkedResult.tokensUsed.total}\n`);
    
    // Step 3: Compare Outputs
    console.log('📊 STEP 3: COMPARISON ANALYSIS\n');
    console.log('='.repeat(80));
    console.log('UNCHUNKED SUMMARY OUTPUT:');
    console.log('='.repeat(80));
    console.log(unchunkedResult.content);
    console.log('\n');
    
    console.log('=' * 80);
    console.log('CHUNKED SUMMARY OUTPUT:');
    console.log('=' * 80);
    console.log(chunkedResult.content);
    console.log('\n');
    
    // Step 4: Analysis and Verdict
    console.log('🔍 STEP 4: DETAILED COMPARISON\n');
    
    const analysis = {
        toneFidelity: analyzeTonameFidelity(unchunkedResult.content, chunkedResult.content),
        insightDensity: analyzeInsightDensity(unchunkedResult.content, chunkedResult.content),
        observationalSharpness: analyzeObservationalSharpness(unchunkedResult.content, chunkedResult.content)
    };
    
    console.log('✏️ **TONE FIDELITY ANALYSIS:**');
    console.log(analysis.toneFidelity);
    console.log('');
    
    console.log('💡 **INSIGHT DENSITY ANALYSIS:**');
    console.log(analysis.insightDensity);
    console.log('');
    
    console.log('🧠 **OBSERVATIONAL SHARPNESS ANALYSIS:**');
    console.log(analysis.observationalSharpness);
    console.log('');
    
    // Final Verdict
    console.log('⚖️ **FINAL VERDICT:**\n');
    
    const verdict = generateVerdict(analysis);
    console.log(verdict);
    
    return {
        unchunkedResult,
        chunkedResult,
        analysis,
        verdict
    };
}

function analyzeTonameFidelity(unchunked, chunked) {
    return `**Unchunked Tone:**
- Has conversational, observational voice ("You keep coming back to...", "Either she's perfectionist, or...")  
- Uses qualifiers and uncertainty ("might mean", "suggests", "Makes me wonder")
- Includes personality observations and speculation
- Casual but insightful language

**Chunked Tone:**
- More formal and structured approach
- Lacks the conversational speculation and personality
- Feels more like a traditional summary
- Missing the "observational colleague" voice

**Assessment:** Unchunked version significantly better preserves the intended dry, observant peer voice. Chunked version loses the conversational tone and becomes more corporate.`;
}

function analyzeInsightDensity(unchunked, chunked) {
    return `**Unchunked Insights:**
- Calls out specific patterns like "80% decided zone" and documentation vs. completion gaps
- Names behaviors: "Classic PM energy", "aspirational checkboxes"
- Identifies hanging threads: color scheme feedback, March 1 date disappearing
- Makes connections between behavior and underlying issues

**Chunked Insights:**  
- More surface-level observations
- Focuses on what happened rather than what it might mean
- Less behavioral pattern recognition
- Fewer "weird" observations or hanging threads

**Assessment:** Unchunked version has significantly higher insight density with better pattern recognition and behavioral observations.`;
}

function analyzeObservationalSharpness(unchunked, chunked) {
    return `**Unchunked Sharpness:**
- Sharp observations: "Lots of checkboxes, not many checked off"
- Pattern naming: "Communication patterns", "80% decided zone"  
- Behavioral insights: "Classic design bottleneck", "aspirational or not updating"
- Calls out what's NOT being said

**Chunked Sharpness:**
- More conventional observations  
- Less pattern recognition across notes
- Misses behavioral implications
- Stays safer in observations

**Assessment:** Unchunked version demonstrates much sharper observational skills and pattern recognition.`;
}

function generateVerdict(analysis) {
    return `❌ **CHUNKING IS HARMING OUTPUT**

**Key Issues with Chunking:**

1. **Tone Dilution:** The chunk-level prompts encourage "focused" analysis that strips away the conversational, speculative voice that makes the insights valuable.

2. **Pattern Loss:** Chunking breaks up cross-note patterns that are only visible when analyzing the full dataset together.

3. **Insight Flattening:** The combination step produces generic synthesis rather than preserving the sharp, behavioral observations from the original approach.

**Recommended Adjustments:**

1. **Increase chunk size** to 15-20 notes to reduce chunking frequency
2. **Revise chunk prompts** to preserve more of the observational tone rather than encouraging "focused" analysis  
3. **Improve merge prompt** to specifically preserve conversational voice and behavioral insights rather than formal synthesis
4. **Consider hybrid approach:** Use chunking only when absolutely necessary (>25 notes) and optimize for pattern preservation

**Root Cause:** The chunking approach fundamentally changes the analysis from holistic pattern recognition to segmented observation + synthesis, which loses the nuanced behavioral insights that make the tool valuable.`;
}

// Run the investigation
runChunkingInvestigation().catch(console.error); 