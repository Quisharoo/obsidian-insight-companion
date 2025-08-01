import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App, TFolder, TFile } from 'obsidian';
import { FolderPickerModal, FolderPickerModalResult } from '../../src/insight-companion/folder-picker-modal';

// Mock Obsidian
vi.mock('obsidian', () => ({
	Modal: class {
		app: any;
		contentEl: any;
		constructor(app: any) {
			this.app = app;
			this.contentEl = {
				empty: vi.fn(),
				createEl: vi.fn((tag: string, attrs?: any) => {
					const element = {
						createEl: vi.fn().mockReturnThis(),
						textContent: '',
						className: '',
						classList: { add: vi.fn() },
						addEventListener: vi.fn(),
						style: {},
						focus: vi.fn(),
						disabled: false
					};
					if (tag === 'select') {
						element.selectEl = element;
					}
					return element;
				})
			};
		}
		open() {}
		close() {}
		onOpen() {}
		onClose() {}
	},
	Setting: class {
		constructor(containerEl: any) {
			this.containerEl = containerEl;
		}
		setName(name: string) { return this; }
		setDesc(desc: string) { return this; }
		addDropdown(callback: (dropdown: any) => void) {
			const dropdown = {
				selectEl: {
					addEventListener: vi.fn()
				},
				addOption: vi.fn(),
				onChange: vi.fn()
			};
			callback(dropdown);
			return this;
		}
	},
	TFolder: class {
		path: string;
		children: any[];
		parent: any;
		constructor(path: string) {
			this.path = path;
			this.children = [];
		}
	},
	TFile: class {
		path: string;
		constructor(path: string) {
			this.path = path;
		}
	}
}));

describe('FolderPickerModal', () => {
	let app: App;
	let onSubmit: ReturnType<typeof vi.fn>;
	let modal: FolderPickerModal;

	beforeEach(() => {
		// Create mock app with vault structure
		const mockVault = {
			getAllLoadedFiles: vi.fn(),
			getAbstractFileByPath: vi.fn(),
			getMarkdownFiles: vi.fn(),
			getRoot: vi.fn(() => ({ path: '' }))
		};

		app = {
			vault: mockVault
		} as any;

		onSubmit = vi.fn();
		modal = new FolderPickerModal(app, onSubmit);
	});

	describe('getAllFolders', () => {
		it('should collect all folders recursively', () => {
			// Create mock folder structure
			const rootFolder = new TFolder('');
			const projectsFolder = new TFolder('projects');
			const meetingsFolder = new TFolder('projects/meetings');
			const dailyFolder = new TFolder('daily');

			projectsFolder.children = [meetingsFolder];
			rootFolder.children = [projectsFolder, dailyFolder];

			app.vault.getAllLoadedFiles.mockReturnValue([
				projectsFolder,
				dailyFolder,
				meetingsFolder
			]);
			app.vault.getRoot.mockReturnValue(rootFolder);

			// Access private method for testing
			const getAllFolders = (modal as any).getAllFolders.bind(modal);
			const folders = getAllFolders();

			expect(folders).toHaveLength(3);
			expect(folders.map((f: TFolder) => f.path)).toEqual([
				'daily',
				'projects',
				'projects/meetings'
			]);
		});

		it('should return empty array when no folders exist', () => {
			app.vault.getAllLoadedFiles.mockReturnValue([]);

			const getAllFolders = (modal as any).getAllFolders.bind(modal);
			const folders = getAllFolders();

			expect(folders).toHaveLength(0);
		});
	});

	describe('getMarkdownFileCount', () => {
		it('should count all markdown files for root folder', () => {
			app.vault.getMarkdownFiles.mockReturnValue([
				new TFile('note1.md'),
				new TFile('note2.md'),
				new TFile('projects/note3.md')
			]);

			const getMarkdownFileCount = (modal as any).getMarkdownFileCount.bind(modal);
			const count = getMarkdownFileCount('');

			expect(count).toBe(3);
		});

		it('should count markdown files in specific folder recursively', () => {
			const folder = new TFolder('projects');
			const subFolder = new TFolder('projects/meetings');
			
			folder.children = [
				{ path: 'projects/note1.md' },
				{ path: 'projects/note2.md' },
				subFolder
			];
			
			subFolder.children = [
				{ path: 'projects/meetings/meeting1.md' },
				{ path: 'projects/meetings/meeting2.md' }
			];

			app.vault.getAbstractFileByPath.mockReturnValue(folder);

			const getMarkdownFileCount = (modal as any).getMarkdownFileCount.bind(modal);
			const count = getMarkdownFileCount('projects');

			expect(count).toBe(4);
		});

		it('should return 0 for non-existent folder', () => {
			app.vault.getAbstractFileByPath.mockReturnValue(null);

			const getMarkdownFileCount = (modal as any).getMarkdownFileCount.bind(modal);
			const count = getMarkdownFileCount('nonexistent');

			expect(count).toBe(0);
		});
	});

	describe('handleSubmit', () => {
		it('should call onSubmit with correct folder result for root', () => {
			// Set up modal with root selection
			(modal as any).selectedFolder = '';

			const handleSubmit = (modal as any).handleSubmit.bind(modal);
			handleSubmit();

			expect(onSubmit).toHaveBeenCalledWith({
				folderPath: '',
				folderName: 'Vault Root'
			});
		});

		it('should call onSubmit with correct folder result for specific folder', () => {
			(modal as any).selectedFolder = 'projects/meetings';

			const handleSubmit = (modal as any).handleSubmit.bind(modal);
			handleSubmit();

			expect(onSubmit).toHaveBeenCalledWith({
				folderPath: 'projects/meetings',
				folderName: 'meetings'
			});
		});

		it('should not call onSubmit if no folder selected', () => {
			(modal as any).selectedFolder = undefined;

			const handleSubmit = (modal as any).handleSubmit.bind(modal);
			handleSubmit();

			expect(onSubmit).not.toHaveBeenCalled();
		});
	});

	describe('modal behavior', () => {
		it('should validate selection correctly', () => {
			const validateSelection = (modal as any).validateSelection.bind(modal);
			const submitButton = { disabled: false };
			(modal as any).submitButton = submitButton;

			// Valid selection (even empty string for root)
			(modal as any).selectedFolder = '';
			validateSelection();
			expect(submitButton.disabled).toBe(false);

			// Valid selection (specific folder)
			(modal as any).selectedFolder = 'projects';
			validateSelection();
			expect(submitButton.disabled).toBe(false);

			// Invalid selection (undefined)
			(modal as any).selectedFolder = undefined;
			validateSelection();
			expect(submitButton.disabled).toBe(true);
		});
	});
}); 