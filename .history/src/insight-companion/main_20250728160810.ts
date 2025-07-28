import { Plugin } from 'obsidian';

export default class InsightCompanionPlugin extends Plugin {
	async onload() {
		console.log('Insight Companion plugin loaded');

		// Add command to generate summary
		this.addCommand({
			id: 'generate-insight-summary',
			name: 'Generate Summary',
			callback: () => {
				console.log('Insight Companion: Generate Summary command executed');
			}
		});
	}

	onunload() {
		console.log('Insight Companion plugin unloaded');
	}
} 