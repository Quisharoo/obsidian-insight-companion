# Insight Companion - Obsidian Plugin

Automatically generate insightful summaries from collections of your vault notes using OpenAI's language models.

## Features

- **Interactive Date Picker**: Select custom date ranges with preset options (Last 7/30/90 days, This month)
- **Real-time Validation**: Ensures end date is after start date
- **Date Range Caching**: Remembers your last used date range
- **OpenAI Integration**: Generate summaries using GPT models (coming soon)

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

3. Run the command "Insight Companion: Generate Summary" from the command palette

### Current Status

✅ **Implemented:**
- Plugin scaffold with proper Obsidian integration
- Interactive date picker modal with validation
- Preset date range buttons
- Settings tab for API key and output folder
- Date range caching

🚧 **Coming Next:**
- Note filtering by date range
- Token estimation and confirmation dialog
- OpenAI API integration
- Summary generation and output

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