import { describe, it, expect } from 'vitest';
import { shouldSkip, isDiffOnly, isBinary } from './file-rules.js';

/**
 * Tests for file-rules helper functions.
 * These functions take config as parameters - actual rules come from API.
 */

describe('shouldSkip', () => {
  describe('with null/empty config', () => {
    it('should return false when skipExtensions is null', () => {
      expect(shouldSkip('image.png', null)).toBe(false);
    });

    it('should return false when skipExtensions is undefined', () => {
      expect(shouldSkip('image.png', undefined)).toBe(false);
    });

    it('should return false when skipExtensions is empty array', () => {
      expect(shouldSkip('image.png', [])).toBe(false);
    });
  });

  describe('with extensions provided', () => {
    const testExtensions = ['.png', '.jpg', '.exe'];

    it('should skip files matching extensions', () => {
      expect(shouldSkip('image.png', testExtensions)).toBe(true);
      expect(shouldSkip('photo.jpg', testExtensions)).toBe(true);
      expect(shouldSkip('program.exe', testExtensions)).toBe(true);
    });

    it('should not skip files not matching extensions', () => {
      expect(shouldSkip('index.js', testExtensions)).toBe(false);
      expect(shouldSkip('style.css', testExtensions)).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(shouldSkip('IMAGE.PNG', testExtensions)).toBe(true);
      expect(shouldSkip('Photo.JPG', testExtensions)).toBe(true);
    });

    it('should handle paths with directories', () => {
      expect(shouldSkip('assets/images/logo.png', testExtensions)).toBe(true);
      expect(shouldSkip('src/index.js', testExtensions)).toBe(false);
    });
  });
});

describe('isDiffOnly', () => {
  describe('with null/empty config', () => {
    it('should return false when both params are null', () => {
      expect(isDiffOnly('config.json', null, null)).toBe(false);
    });

    it('should return false when both params are empty arrays', () => {
      expect(isDiffOnly('config.json', [], [])).toBe(false);
    });
  });

  describe('with extensions provided', () => {
    const testExtensions = ['.json', '.lock'];
    const testFiles = [];

    it('should match extension-based diff-only files', () => {
      expect(isDiffOnly('config.json', testExtensions, testFiles)).toBe(true);
      expect(isDiffOnly('composer.lock', testExtensions, testFiles)).toBe(true);
    });

    it('should not match non-diff-only files', () => {
      expect(isDiffOnly('index.js', testExtensions, testFiles)).toBe(false);
    });

    it('should be case insensitive for extensions', () => {
      expect(isDiffOnly('CONFIG.JSON', testExtensions, testFiles)).toBe(true);
    });
  });

  describe('with specific filenames provided', () => {
    const testExtensions = [];
    const testFiles = ['package-lock.json', 'yarn.lock'];

    it('should match specific filenames', () => {
      expect(isDiffOnly('package-lock.json', testExtensions, testFiles)).toBe(true);
      expect(isDiffOnly('yarn.lock', testExtensions, testFiles)).toBe(true);
    });

    it('should match filenames in paths', () => {
      expect(isDiffOnly('node_modules/package-lock.json', testExtensions, testFiles)).toBe(true);
    });

    it('should be case insensitive for filenames', () => {
      expect(isDiffOnly('PACKAGE-LOCK.JSON', testExtensions, testFiles)).toBe(true);
    });
  });

  describe('with both extensions and filenames', () => {
    const testExtensions = ['.json'];
    const testFiles = ['go.sum'];

    it('should work with only extensions provided', () => {
      expect(isDiffOnly('config.json', testExtensions, null)).toBe(true);
    });

    it('should work with only files provided', () => {
      expect(isDiffOnly('go.sum', null, testFiles)).toBe(true);
    });
  });
});

describe('isBinary', () => {
  describe('empty/null content', () => {
    it('should return false for empty string', () => {
      expect(isBinary('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isBinary(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBinary(undefined)).toBe(false);
    });
  });

  describe('text content', () => {
    it('should return false for plain text', () => {
      expect(isBinary('Hello, World!')).toBe(false);
    });

    it('should return false for code', () => {
      const code = `function hello() {\n  console.log('Hello');\n}`;
      expect(isBinary(code)).toBe(false);
    });

    it('should return false for content with whitespace', () => {
      expect(isBinary('Line 1\n\tIndented\r\nWindows line')).toBe(false);
    });

    it('should return false for UTF-8 non-Latin text', () => {
      // Chinese, Japanese, Cyrillic - all valid UTF-8, no null bytes
      expect(isBinary('你好世界')).toBe(false);
      expect(isBinary('こんにちは')).toBe(false);
      expect(isBinary('Привет мир')).toBe(false);
    });

    it('should return false for text with control characters (non-null)', () => {
      // Control chars like \x01-\x1F are not null bytes
      const content = 'text\x01\x02\x03more text';
      expect(isBinary(content)).toBe(false);
    });
  });

  describe('binary content (null bytes)', () => {
    it('should return true for content with null byte at start', () => {
      expect(isBinary('\x00some text')).toBe(true);
    });

    it('should return true for content with null byte in middle', () => {
      expect(isBinary('some\x00text')).toBe(true);
    });

    it('should return true for content with null byte at end', () => {
      expect(isBinary('some text\x00')).toBe(true);
    });

    it('should return true for content with many null bytes', () => {
      const binary = '\x00\x00\x00\x00some text\x00\x00\x00';
      expect(isBinary(binary)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should only sample first 8192 characters', () => {
      // Null byte after 8192 chars should not be detected
      const textPart = 'a'.repeat(10000);
      const binaryPart = '\x00';
      expect(isBinary(textPart + binaryPart)).toBe(false);
    });

    it('should detect null byte within first 8192 characters', () => {
      const textPart = 'a'.repeat(8000);
      const binaryPart = '\x00';
      expect(isBinary(textPart + binaryPart)).toBe(true);
    });
  });
});
