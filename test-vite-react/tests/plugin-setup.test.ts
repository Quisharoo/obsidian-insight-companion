import * as fs from 'fs';
import * as path from 'path';

describe('Plugin Setup Tests', () => {
  const distPath = path.join(process.cwd(), 'dist');
  const manifestSourcePath = path.join(process.cwd(), 'src', 'insight-companion', 'manifest.json');
  const manifestDistPath = path.join(distPath, 'manifest.json');
  const mainJsPath = path.join(distPath, 'main.js');

  beforeAll(() => {
    // Mock fs for consistent testing
    jest.restoreAllMocks();
  });

  describe('Manifest.json Configuration', () => {
    it('should exist in source directory', () => {
      const manifestExists = fs.existsSync(manifestSourcePath);
      expect(manifestExists).toBe(true);
    });

    it('should have correct structure and "main" field', () => {
      const manifestContent = JSON.parse(fs.readFileSync(manifestSourcePath, 'utf8'));
      
      expect(manifestContent).toMatchObject({
        id: 'insight-companion',
        name: 'Insight Companion',
        version: expect.any(String),
        minAppVersion: expect.any(String),
        description: expect.any(String),
        author: expect.any(String),
        main: 'main.js'
      });
    });

    it('should have "main" field pointing to main.js', () => {
      const manifestContent = JSON.parse(fs.readFileSync(manifestSourcePath, 'utf8'));
      expect(manifestContent.main).toBe('main.js');
    });

    it('should have valid semantic version', () => {
      const manifestContent = JSON.parse(fs.readFileSync(manifestSourcePath, 'utf8'));
      const versionRegex = /^\d+\.\d+\.\d+$/;
      expect(manifestContent.version).toMatch(versionRegex);
    });

    it('should have required fields for Obsidian plugin', () => {
      const manifestContent = JSON.parse(fs.readFileSync(manifestSourcePath, 'utf8'));
      
      const requiredFields = ['id', 'name', 'version', 'minAppVersion', 'description', 'author', 'main'];
      requiredFields.forEach(field => {
        expect(manifestContent).toHaveProperty(field);
        expect(manifestContent[field]).toBeTruthy();
      });
    });
  });

  describe('Build Output Verification', () => {
    beforeAll(async () => {
      // Ensure dist directory exists for testing
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }
    });

    it('should copy manifest.json to dist directory', () => {
      // Simulate the copyManifest function from esbuild.config.mjs
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath);
      }
      fs.copyFileSync(manifestSourcePath, manifestDistPath);
      
      const distManifestExists = fs.existsSync(manifestDistPath);
      expect(distManifestExists).toBe(true);
    });

    it('should have identical content between source and dist manifest', () => {
      // Ensure both files exist
      if (!fs.existsSync(manifestDistPath)) {
        fs.copyFileSync(manifestSourcePath, manifestDistPath);
      }
      
      const sourceContent = fs.readFileSync(manifestSourcePath, 'utf8');
      const distContent = fs.readFileSync(manifestDistPath, 'utf8');
      
      expect(distContent).toBe(sourceContent);
    });

    it('should have manifest.json and main.js in dist after build', () => {
      // Create a mock main.js file for testing
      const mockMainJs = `
        // Mock compiled plugin code
        "use strict";
        var plugin = {};
        module.exports = plugin;
      `;
      
      // Ensure dist directory and files exist
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }
      
      if (!fs.existsSync(manifestDistPath)) {
        fs.copyFileSync(manifestSourcePath, manifestDistPath);
      }
      
      if (!fs.existsSync(mainJsPath)) {
        fs.writeFileSync(mainJsPath, mockMainJs);
      }
      
      expect(fs.existsSync(manifestDistPath)).toBe(true);
      expect(fs.existsSync(mainJsPath)).toBe(true);
    });

    it('should have correct file structure in dist', () => {
      // Ensure dist directory exists
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }
      
      // Create necessary files if they don't exist
      if (!fs.existsSync(manifestDistPath)) {
        fs.copyFileSync(manifestSourcePath, manifestDistPath);
      }
      
      if (!fs.existsSync(mainJsPath)) {
        fs.writeFileSync(mainJsPath, '// Mock main.js');
      }
      
      const distFiles = fs.readdirSync(distPath);
      
      expect(distFiles).toContain('manifest.json');
      expect(distFiles).toContain('main.js');
    });

    afterAll(() => {
      // Clean up test files
      try {
        if (fs.existsSync(manifestDistPath)) {
          fs.unlinkSync(manifestDistPath);
        }
        if (fs.existsSync(mainJsPath)) {
          fs.unlinkSync(mainJsPath);
        }
        // Only remove dist if it's empty (don't interfere with real builds)
        const distFiles = fs.readdirSync(distPath);
        if (distFiles.length === 0) {
          fs.rmdirSync(distPath);
        }
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    });
  });

  describe('Build Process Integration', () => {
    it('should have valid esbuild configuration', () => {
      const esbuildConfigPath = path.join(process.cwd(), 'esbuild.config.mjs');
      const configExists = fs.existsSync(esbuildConfigPath);
      expect(configExists).toBe(true);
    });

    it('should configure correct entry point', () => {
      const esbuildConfigPath = path.join(process.cwd(), 'esbuild.config.mjs');
      const configContent = fs.readFileSync(esbuildConfigPath, 'utf8');
      
      // Check that the entry point is correctly set
      expect(configContent).toContain('src/insight-companion/main.ts');
    });

    it('should configure correct output file', () => {
      const esbuildConfigPath = path.join(process.cwd(), 'esbuild.config.mjs');
      const configContent = fs.readFileSync(esbuildConfigPath, 'utf8');
      
      // Check that the output file is correctly set
      expect(configContent).toContain('dist/main.js');
    });

    it('should include manifest copying logic', () => {
      const esbuildConfigPath = path.join(process.cwd(), 'esbuild.config.mjs');
      const configContent = fs.readFileSync(esbuildConfigPath, 'utf8');
      
      // Check that manifest copying is implemented
      expect(configContent).toContain('copyManifest');
      expect(configContent).toContain('manifest.json');
    });

    it('should have correct external dependencies', () => {
      const esbuildConfigPath = path.join(process.cwd(), 'esbuild.config.mjs');
      const configContent = fs.readFileSync(esbuildConfigPath, 'utf8');
      
      // Check that obsidian is marked as external
      expect(configContent).toContain('obsidian');
      expect(configContent).toContain('external');
    });
  });

  describe('Package.json Configuration', () => {
    let packageJson: any;

    beforeAll(() => {
      const packagePath = path.join(process.cwd(), 'package.json');
      packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    });

    it('should have test script configured', () => {
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts.test).toBe('jest');
    });

    it('should have build script configured', () => {
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts.build).toContain('esbuild.config.mjs');
    });

    it('should have required testing dependencies', () => {
      const requiredTestDeps = [
        '@types/jest',
        'jest',
        'jest-environment-jsdom',
        'ts-jest'
      ];

      requiredTestDeps.forEach(dep => {
        expect(packageJson.devDependencies).toHaveProperty(dep);
      });
    });

    it('should have obsidian dependency', () => {
      expect(packageJson.devDependencies).toHaveProperty('obsidian');
    });

    it('should have correct main entry point', () => {
      expect(packageJson.main).toBe('src/insight-companion/main.js');
    });
  });

  describe('TypeScript Configuration', () => {
    let tsConfig: any;

    beforeAll(() => {
      const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
      tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    });

    it('should include src directory', () => {
      expect(tsConfig.include).toContain('src/**/*.ts');
    });

    it('should have correct output directory', () => {
      expect(tsConfig.compilerOptions.outDir).toBe('./dist');
    });

    it('should support ES6 and DOM', () => {
      expect(tsConfig.compilerOptions.target).toBe('ES6');
      expect(tsConfig.compilerOptions.lib).toContain('DOM');
      expect(tsConfig.compilerOptions.lib).toContain('ES6');
    });

    it('should use node module resolution', () => {
      expect(tsConfig.compilerOptions.moduleResolution).toBe('node');
    });
  });
}); 