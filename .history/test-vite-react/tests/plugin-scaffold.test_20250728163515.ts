import { App } from 'obsidian';
import InsightCompanionPlugin from '../../src/insight-companion/main';

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Replace global console for testing
global.console = mockConsole as any;

describe('Plugin Scaffold Tests', () => {
  let app: App;
  let plugin: InsightCompanionPlugin;
  let mockManifest: any;

  beforeEach(() => {
    // Reset console mocks
    jest.clearAllMocks();
    
    // Create mock app and manifest
    app = new App();
    mockManifest = {
      id: 'insight-companion',
      name: 'Insight Companion',
      version: '1.0.0'
    };

    // Create plugin instance
    plugin = new InsightCompanionPlugin(app, mockManifest);
    
    // Mock the plugin methods
    jest.spyOn(plugin, 'addCommand');
    jest.spyOn(plugin, 'addSettingTab');
    jest.spyOn(plugin, 'loadSettings').mockResolvedValue(undefined);
    jest.spyOn(plugin, 'saveSettings').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Plugin Loading', () => {
    it('should load without errors', async () => {
      await expect(plugin.onload()).resolves.not.toThrow();
    });

    it('should log the expected loading message', async () => {
      await plugin.onload();
      expect(mockConsole.log).toHaveBeenCalledWith('Insight Companion plugin loaded');
    });

    it('should load settings during plugin initialization', async () => {
      await plugin.onload();
      expect(plugin.loadSettings).toHaveBeenCalled();
    });
  });

  describe('Command Registration', () => {
    it('should register the "Generate Summary" command', async () => {
      await plugin.onload();
      
      expect(plugin.addCommand).toHaveBeenCalledWith({
        id: 'generate-insight-summary',
        name: 'Generate Summary',
        callback: expect.any(Function)
      });
    });

    it('should register exactly one command', async () => {
      await plugin.onload();
      expect(plugin.addCommand).toHaveBeenCalledTimes(1);
    });

    it('should have the correct command ID and name', async () => {
      await plugin.onload();
      
      const commandCall = (plugin.addCommand as jest.Mock).mock.calls[0][0];
      expect(commandCall.id).toBe('generate-insight-summary');
      expect(commandCall.name).toBe('Generate Summary');
    });
  });

  describe('Command Execution', () => {
    it('should execute command callback without errors', async () => {
      await plugin.onload();
      
      const commandCall = (plugin.addCommand as jest.Mock).mock.calls[0][0];
      const callback = commandCall.callback;
      
      expect(() => callback()).not.toThrow();
    });

    it('should log opening date picker when command is executed', async () => {
      await plugin.onload();
      
      const commandCall = (plugin.addCommand as jest.Mock).mock.calls[0][0];
      const callback = commandCall.callback;
      
      callback();
      
      expect(mockConsole.log).toHaveBeenCalledWith('Opening date picker modal...');
    });
  });

  describe('Settings Tab Registration', () => {
    it('should register a settings tab', async () => {
      await plugin.onload();
      expect(plugin.addSettingTab).toHaveBeenCalled();
    });

    it('should register exactly one settings tab', async () => {
      await plugin.onload();
      expect(plugin.addSettingTab).toHaveBeenCalledTimes(1);
    });
  });

  describe('Plugin Unloading', () => {
    it('should unload without errors', () => {
      expect(() => plugin.onunload()).not.toThrow();
    });

    it('should log the expected unloading message', () => {
      plugin.onunload();
      expect(mockConsole.log).toHaveBeenCalledWith('Insight Companion plugin unloaded');
    });
  });

  describe('Settings Management', () => {
    it('should have default settings structure', async () => {
      await plugin.onload();
      
      expect(plugin.settings).toEqual({
        lastDateRange: null,
        outputFolder: 'Summaries',
        openaiApiKey: ''
      });
    });

    it('should load settings from data', async () => {
      const mockData = {
        outputFolder: 'CustomFolder',
        openaiApiKey: 'test-key'
      };
      
      jest.spyOn(plugin, 'loadData').mockResolvedValue(mockData);
      
      await plugin.loadSettings();
      
      expect(plugin.settings.outputFolder).toBe('CustomFolder');
      expect(plugin.settings.openaiApiKey).toBe('test-key');
      expect(plugin.settings.lastDateRange).toBe(null); // Should keep default
    });

    it('should save settings correctly', async () => {
      plugin.settings = {
        lastDateRange: { startDate: '2023-01-01', endDate: '2023-01-31' },
        outputFolder: 'TestFolder',
        openaiApiKey: 'test-api-key'
      };

      jest.spyOn(plugin, 'saveData').mockResolvedValue(undefined);
      
      await plugin.saveSettings();
      
      expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
    });
  });
}); 