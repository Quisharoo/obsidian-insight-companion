// Mock implementation of Obsidian API for testing

export class App {
  constructor() {}
}

export class Plugin {
  app: App;
  settings: any = {};
  
  constructor(app: App, manifest: any) {
    this.app = app;
  }

  async onload() {}
  async onunload() {}
  async loadSettings() {}
  async saveSettings() {}
  async loadData(): Promise<any> {
    return {};
  }
  async saveData(data: any): Promise<void> {}

  addCommand(command: any) {
    return command;
  }

  addSettingTab(settingTab: any) {
    return settingTab;
  }
}

export class Modal {
  app: App;
  contentEl: MockHTMLElement;

  constructor(app: App) {
    this.app = app;
    this.contentEl = new MockHTMLElement();
  }

  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}

export class PluginSettingTab {
  app: App;
  plugin: any;
  containerEl: MockHTMLElement;

  constructor(app: App, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = new MockHTMLElement();
  }

  display() {}
}

export class Setting {
  private containerEl: MockHTMLElement;
  private nameEl: MockHTMLElement;
  private descEl: MockHTMLElement;

  constructor(containerEl: MockHTMLElement) {
    this.containerEl = containerEl;
    this.nameEl = new MockHTMLElement();
    this.descEl = new MockHTMLElement();
  }

  setName(name: string) {
    this.nameEl.textContent = name;
    return this;
  }

  setDesc(desc: string) {
    this.descEl.textContent = desc;
    return this;
  }

  addText(callback: (text: any) => void) {
    const mockText = {
      inputEl: new MockHTMLInputElement(),
      setPlaceholder: jest.fn().mockReturnThis(),
      setValue: jest.fn().mockReturnThis(),
      onChange: jest.fn().mockReturnThis(),
    };
    callback(mockText);
    return this;
  }
}

// Mock HTML elements for testing
class MockHTMLElement {
  textContent: string = '';
  innerHTML: string = '';
  style: any = {};
  children: MockHTMLElement[] = [];
  attributes: Record<string, string> = {};

  createEl(tagName: string, options?: any): MockHTMLElement {
    const element = new MockHTMLElement();
    if (options?.text) element.textContent = options.text;
    if (options?.cls) element.attributes.class = options.cls;
    if (options?.attr) Object.assign(element.attributes, options.attr);
    this.children.push(element);
    return element;
  }

  empty() {
    this.children = [];
    this.textContent = '';
    this.innerHTML = '';
  }

  addEventListener(event: string, callback: Function) {
    // Store for potential testing
  }

  removeEventListener(event: string, callback: Function) {
    // Store for potential testing
  }

  // Add find method to children array for testing
  get length() {
    return this.children.length;
  }
}

class MockHTMLInputElement extends MockHTMLElement {
  type: string = 'text';
  value: string = '';
  placeholder: string = '';
}

// Export additional mocks that might be needed
export const mockObsidianApi = {
  App,
  Plugin,
  Modal,
  PluginSettingTab,
  Setting,
}; 