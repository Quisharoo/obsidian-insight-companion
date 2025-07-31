import { App, Modal, Setting, TFolder } from 'obsidian';

export interface FolderPickerModalResult {
	folderPath: string;
	folderName: string;
	insightStyle?: 'structured' | 'freeform' | 'succinct';
}

export class FolderPickerModal extends Modal {
	private selectedFolder: string = '';
	private insightStyle: 'structured' | 'freeform' = 'structured';
	private onSubmit: (result: FolderPickerModalResult) => void;
	private folderDropdown: HTMLSelectElement;
	private submitButton: HTMLButtonElement;

	constructor(app: App, onSubmit: (result: FolderPickerModalResult) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Select Folder for Insight Summary' });

		// Description
		contentEl.createEl('p', { 
			text: 'Choose a folder to summarize. All markdown files in the folder and its subfolders will be included.',
			cls: 'mod-muted'
		});

		// Folder selection
		new Setting(contentEl)
			.setName('Folder')
			.setDesc('Select the folder to summarize')
			.addDropdown(dropdown => {
				this.folderDropdown = dropdown.selectEl;
				
				// Add root option
				dropdown.addOption('', 'Vault Root (all folders)');
				
				// Get all folders and add them to dropdown
				const folders = this.getAllFolders();
				folders.forEach(folder => {
					dropdown.addOption(folder.path, folder.path || 'Vault Root');
				});

				dropdown.onChange(value => {
					this.selectedFolder = value;
					this.validateSelection();
				});
			});

		// Insight style setting
		new Setting(contentEl)
			.setName('Insight Style')
			.setDesc('Choose the format for your insight summary')
			.addDropdown(dropdown => {
				dropdown.addOption('structured', 'Structured (Clear headings like Themes, People, Actions)');
				dropdown.addOption('freeform', 'Freeform (Memo-style summary with natural flow, only required heading is Notes Referenced)');
				dropdown.setValue(this.insightStyle);
				dropdown.onChange(value => {
					this.insightStyle = value as 'structured' | 'freeform';
				});
			});

		// Show folder info
		const infoEl = contentEl.createEl('div', { 
			cls: 'mod-warning',
			attr: { style: 'margin: 15px 0; padding: 10px; border-radius: 4px; display: none;' }
		});
		
		// Update info when selection changes
		const updateInfo = () => {
			const fileCount = this.getMarkdownFileCount(this.selectedFolder);
			if (fileCount > 0) {
				infoEl.style.display = 'block';
				infoEl.textContent = `This folder contains ${fileCount} markdown file${fileCount !== 1 ? 's' : ''}.`;
				infoEl.className = 'mod-info';
			} else if (this.selectedFolder !== '') {
				infoEl.style.display = 'block';
				infoEl.textContent = 'This folder contains no markdown files.';
				infoEl.className = 'mod-warning';
			} else {
				infoEl.style.display = 'none';
			}
		};

		this.folderDropdown.addEventListener('change', updateInfo);

		// Action buttons
		const buttonContainer = contentEl.createEl('div', { 
			attr: { style: 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;' }
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.close();
		});

		// Submit button
		this.submitButton = buttonContainer.createEl('button', { 
			text: 'Select Folder',
			cls: 'mod-cta'
		});
		this.submitButton.addEventListener('click', () => {
			this.handleSubmit();
		});

		// Initial validation
		this.validateSelection();

		// Focus on dropdown
		this.folderDropdown.focus();
	}

	private getAllFolders(): TFolder[] {
		const folders: TFolder[] = [];
		
		// Recursively collect all folders
		const collectFolders = (folder: TFolder) => {
			folders.push(folder);
			folder.children.forEach(child => {
				if (child instanceof TFolder) {
					collectFolders(child);
				}
			});
		};

		// Start with root folders
		this.app.vault.getAllLoadedFiles().forEach(file => {
			if (file instanceof TFolder && file.parent === this.app.vault.getRoot()) {
				collectFolders(file);
			}
		});

		// Sort folders by path for better UX
		return folders.sort((a, b) => a.path.localeCompare(b.path));
	}

	private getMarkdownFileCount(folderPath: string): number {
		if (folderPath === '') {
			// Root - count all markdown files
			return this.app.vault.getMarkdownFiles().length;
		}

		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) {
			return 0;
		}

		// Count markdown files recursively
		let count = 0;
		const countInFolder = (currentFolder: TFolder) => {
			currentFolder.children.forEach(child => {
				if (child.path.endsWith('.md')) {
					count++;
				} else if (child instanceof TFolder) {
					countInFolder(child);
				}
			});
		};

		countInFolder(folder);
		return count;
	}

	private validateSelection(): void {
		const isValid = this.selectedFolder !== undefined; // Allow empty string for root
		this.submitButton.disabled = !isValid;
	}

	private handleSubmit(): void {
		if (this.selectedFolder === undefined) {
			return;
		}

		const folderName = this.selectedFolder === '' 
			? 'Vault Root' 
			: this.selectedFolder.split('/').pop() || this.selectedFolder;

		const result: FolderPickerModalResult = {
			folderPath: this.selectedFolder,
			folderName: folderName,
			insightStyle: this.insightStyle
		};

		this.onSubmit(result);
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
} 