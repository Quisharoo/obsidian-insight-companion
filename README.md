# Insight Companion - Obsidian Plugin

Automatically generate insightful summaries from collections of your vault notes using OpenAI's language models.

<!-- Simple verification change for testing PR workflow -->

## Features

- **Interactive Date Picker**: Select custom date ranges with preset options (Last 7/30/90 days, This month)
- **Folder-based Summarisation**: Choose a folder to summarise all markdown files within it recursively
- **Real-time Validation**: Ensures end date is after start date
- **Date Range Caching**: Remembers your last used date range
- **OpenAI Integration**: Generate summaries using GPT models with token estimation and cost preview
- **Dual Summary Modes**: Choose between date-based or folder-based note filtering

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- Obsidian (for testing)

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

### Testing in Obsidian

1. Copy the built files to your Obsidian plugins folder:
   ```
   .obsidian/plugins/insight-companion/
   ├── main.js
   ├── manifest.json
   └── styles.css (if any)
   ```

2. Enable the plugin in Obsidian Settings → Community Plugins

3. Run either command from the command palette:
   - "Insight Companion: Generate Summary" (date-based filtering)
   - "Insight Companion: Summarise by Folder" (folder-based filtering)

### Current Status

✅ **Implemented:**
- Plugin scaffold with proper Obsidian integration
- Interactive date picker modal with validation
- Interactive folder picker modal
- Preset date range buttons
- Settings tab for API key and output folder
- Date range caching
- Note filtering by date range and folder
- Token estimation and confirmation dialog
- OpenAI API integration
- Summary generation and output
- Folder-based and date-based summarisation modes
- Comprehensive test coverage (219 tests passing)

## Development Commands

- `npm run dev` - Start development with file watching
- `npm run build` - Build for production
- `npm run version` - Version bump utilities

## Architecture

- `src/insight-companion/main.ts` - Main plugin class and command registration
- `src/insight-companion/date-picker-modal.ts` - Interactive date picker component
- `manifest.json` - Plugin metadata for Obsidian

## Plugin Structure

```
src/insight-companion/
├── main.ts                 # Plugin entry point
├── date-picker-modal.ts    # Date picker UI component
└── manifest.json           # Plugin metadata
```  