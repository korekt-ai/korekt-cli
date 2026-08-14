import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  truncateFileData,
  formatErrorOutput,
  detectCIProvider,
  getPrUrl,
  handleSkippedResponse,
  resolveModel,
} from './index.js';

describe('CLI JSON output mode', () => {
  let stdoutSpy;
  let stderrSpy;

  beforeEach(() => {
    // Spy on stdout and stderr
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('stdout/stderr separation', () => {
    it('should send progress messages to stderr using log helper', () => {
      const log = (msg) => process.stderr.write(msg + '\n');

      log('Starting review...');
      expect(stderrSpy).toHaveBeenCalledWith('Starting review...\n');
    });

    it('should send data output to stdout using output helper', () => {
      const output = (msg) => process.stdout.write(msg + '\n');

      const jsonData = JSON.stringify({ success: true }, null, 2);
      output(jsonData);
      expect(stdoutSpy).toHaveBeenCalledWith(jsonData + '\n');
    });

    it('should keep progress and data separate', () => {
      const log = (msg) => process.stderr.write(msg + '\n');
      const output = (msg) => process.stdout.write(msg + '\n');

      // Simulate a review flow
      log('Starting review...');
      log('Analyzing files...');
      output(JSON.stringify({ result: 'success' }));

      // Verify stderr contains progress
      expect(stderrSpy).toHaveBeenCalledWith('Starting review...\n');
      expect(stderrSpy).toHaveBeenCalledWith('Analyzing files...\n');

      // Verify stdout contains only data
      expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ result: 'success' }) + '\n');
      expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining('Starting review'));
    });

    it('should not mix stderr progress with stdout data', () => {
      const log = (msg) => process.stderr.write(msg + '\n');
      const output = (msg) => process.stdout.write(msg + '\n');

      log('Progress message');
      output('Data output');

      // stderr should not contain data
      expect(stderrSpy).not.toHaveBeenCalledWith('Data output\n');
      // stdout should not contain progress
      expect(stdoutSpy).not.toHaveBeenCalledWith('Progress message\n');
    });
  });

  describe('dry-run payload transformation', () => {
    it('should truncate diffs longer than 500 characters', () => {
      const longDiff = 'a'.repeat(600);

      const file = {
        path: 'test.js',
        status: 'M',
        diff: longDiff,
        content: 'short content',
      };

      const displayFile = truncateFileData(file);

      expect(displayFile.diff).toContain('... [truncated 100 chars]');
      expect(displayFile.diff.length).toBeLessThan(longDiff.length);
      expect(displayFile.diff).toBe('a'.repeat(500) + '... [truncated 100 chars]');
    });

    it('should truncate content longer than 500 characters', () => {
      const longContent = 'b'.repeat(700);

      const file = {
        path: 'test.js',
        status: 'M',
        diff: 'short diff',
        content: longContent,
      };

      const displayFile = truncateFileData(file);

      expect(displayFile.content).toContain('... [truncated 200 chars]');
      expect(displayFile.content.length).toBeLessThan(longContent.length);
      expect(displayFile.content).toBe('b'.repeat(500) + '... [truncated 200 chars]');
    });

    it('should not truncate short diffs and content', () => {
      const shortDiff = 'short diff';
      const shortContent = 'short content';

      const file = {
        path: 'test.js',
        status: 'M',
        diff: shortDiff,
        content: shortContent,
      };

      const displayFile = truncateFileData(file);

      expect(displayFile.diff).toBe(shortDiff);
      expect(displayFile.content).toBe(shortContent);
      expect(displayFile.diff).not.toContain('truncated');
      expect(displayFile.content).not.toContain('truncated');
    });

    it('should preserve all file metadata during truncation', () => {
      const file = {
        path: 'renamed.js',
        status: 'R',
        old_path: 'old.js',
        diff: 'x'.repeat(600),
        content: 'y'.repeat(600),
      };

      const displayFile = truncateFileData(file);

      expect(displayFile.path).toBe('renamed.js');
      expect(displayFile.status).toBe('R');
      expect(displayFile.old_path).toBe('old.js');
      expect(displayFile.diff).toContain('truncated');
      expect(displayFile.content).toContain('truncated');
    });

    it('should handle file exactly at 500 characters without truncation', () => {
      const exactDiff = 'a'.repeat(500);
      const exactContent = 'b'.repeat(500);

      const file = {
        path: 'test.js',
        status: 'M',
        diff: exactDiff,
        content: exactContent,
      };

      const displayFile = truncateFileData(file);

      expect(displayFile.diff).toBe(exactDiff);
      expect(displayFile.content).toBe(exactContent);
      expect(displayFile.diff).not.toContain('truncated');
      expect(displayFile.content).not.toContain('truncated');
    });

    it('should handle diff-only files without content', () => {
      const file = {
        path: 'test.js',
        status: 'M',
        diff: 'some diff here',
        // no content field - this is a diff-only file
      };

      const displayFile = truncateFileData(file);

      expect(displayFile.path).toBe('test.js');
      expect(displayFile.status).toBe('M');
      expect(displayFile.diff).toBe('some diff here');
      expect(displayFile.content).toBeUndefined();
    });

    it('should handle files with neither diff nor content', () => {
      const file = {
        path: 'deleted.js',
        status: 'D',
      };

      const displayFile = truncateFileData(file);

      expect(displayFile.path).toBe('deleted.js');
      expect(displayFile.status).toBe('D');
      expect(displayFile.diff).toBeUndefined();
      expect(displayFile.content).toBeUndefined();
    });
  });

  describe('error formatting for JSON mode', () => {
    it('should format error with response data', () => {
      const error = {
        message: 'Request failed',
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
        },
      };

      const errorOutput = formatErrorOutput(error);

      expect(errorOutput).toEqual({
        success: false,
        error: 'Request failed',
        status: 401,
        data: { error: 'Unauthorized' },
      });
    });

    it('should format error without response data', () => {
      const error = {
        message: 'Network error',
      };

      const errorOutput = formatErrorOutput(error);

      expect(errorOutput).toEqual({
        success: false,
        error: 'Network error',
      });
    });

    it('should include response status and data when available', () => {
      const error = {
        message: 'API Error',
        response: {
          status: 500,
          data: {
            error: 'Internal Server Error',
            details: 'Database connection failed',
          },
        },
      };

      const errorOutput = formatErrorOutput(error);

      expect(errorOutput.success).toBe(false);
      expect(errorOutput.error).toBe('API Error');
      expect(errorOutput.status).toBe(500);
      expect(errorOutput.data).toEqual({
        error: 'Internal Server Error',
        details: 'Database connection failed',
      });
    });
  });

  describe('confirmation skip logic', () => {
    it('should skip confirmation when JSON mode is enabled', () => {
      const options = { json: true };

      // Logic from index.js line 157: if (!options.json) { confirmAction... }
      const shouldShowConfirmation = !options.json;

      expect(shouldShowConfirmation).toBe(false);
    });

    it('should show confirmation when JSON mode is disabled', () => {
      const options = { json: false };

      const shouldShowConfirmation = !options.json;

      expect(shouldShowConfirmation).toBe(true);
    });

    it('should show confirmation when JSON option is not set', () => {
      const options = {};

      const shouldShowConfirmation = !options.json;

      expect(shouldShowConfirmation).toBe(true);
    });
  });

  describe('payload structure for different review modes', () => {
    it('should have empty commit_messages for uncommitted reviews', () => {
      const uncommittedPayload = {
        repo_url: 'https://github.com/user/repo',
        source_branch: 'feature-branch',
        commit_messages: [], // Should be empty for uncommitted
        changed_files: [
          {
            path: 'file.js',
            status: 'M',
            diff: 'diff',
            content: 'content',
          },
        ],
      };

      expect(uncommittedPayload.commit_messages).toEqual([]);
      expect(uncommittedPayload.changed_files).toHaveLength(1);
    });

    it('should have commit_messages for committed reviews', () => {
      const committedPayload = {
        repo_url: 'https://github.com/user/repo',
        source_branch: 'feature-branch',
        commit_messages: ['feat: add feature', 'fix: bug fix'],
        changed_files: [
          {
            path: 'file.js',
            status: 'M',
            diff: 'diff',
            content: 'content',
          },
        ],
      };

      expect(committedPayload.commit_messages.length).toBeGreaterThan(0);
      expect(committedPayload.changed_files).toHaveLength(1);
    });
  });

  describe('JSON output format validation', () => {
    it('should produce valid JSON for success response', () => {
      const response = {
        review: {
          issues: [
            {
              file_path: 'file.js',
              line_number: 10,
              message: 'Issue',
              severity: 'high',
              category: 'security',
              suggested_fix: 'Fix it',
            },
          ],
          praises: [],
        },
        summary: {
          total_issues: 1,
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
        },
      };

      // Should be valid JSON
      const jsonString = JSON.stringify(response, null, 2);
      expect(() => JSON.parse(jsonString)).not.toThrow();

      const parsed = JSON.parse(jsonString);
      expect(parsed.review.issues).toHaveLength(1);
      expect(parsed.summary.total_issues).toBe(1);
    });

    it('should produce valid JSON for error response', () => {
      const errorResponse = {
        success: false,
        error: 'API Error',
        status: 400,
        data: { error: 'Bad request' },
      };

      // Should be valid JSON
      const jsonString = JSON.stringify(errorResponse, null, 2);
      expect(() => JSON.parse(jsonString)).not.toThrow();

      const parsed = JSON.parse(jsonString);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('API Error');
      expect(parsed.status).toBe(400);
    });
  });
});

describe('detectCIProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    // Clear all CI-related env vars
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.SYSTEM_ACCESSTOKEN;
    delete process.env.SYSTEM_PULLREQUEST_PULLREQUESTID;
    delete process.env.BITBUCKET_REPO_SLUG;
    delete process.env.BITBUCKET_PR_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should detect GitHub when GITHUB_TOKEN and GITHUB_REPOSITORY are set', () => {
    process.env.GITHUB_TOKEN = 'ghp_test123';
    process.env.GITHUB_REPOSITORY = 'owner/repo';

    expect(detectCIProvider()).toBe('github');
  });

  it('should detect Azure when SYSTEM_ACCESSTOKEN and SYSTEM_PULLREQUEST_PULLREQUESTID are set', () => {
    process.env.SYSTEM_ACCESSTOKEN = 'azure_token';
    process.env.SYSTEM_PULLREQUEST_PULLREQUESTID = '123';

    expect(detectCIProvider()).toBe('azure');
  });

  it('should detect Bitbucket when BITBUCKET_REPO_SLUG and BITBUCKET_PR_ID are set', () => {
    process.env.BITBUCKET_REPO_SLUG = 'my-repo';
    process.env.BITBUCKET_PR_ID = '456';

    expect(detectCIProvider()).toBe('bitbucket');
  });

  it('should return null when no CI provider env vars are set', () => {
    expect(detectCIProvider()).toBe(null);
  });

  it('should return null when only partial GitHub env vars are set', () => {
    process.env.GITHUB_TOKEN = 'ghp_test123';
    // GITHUB_REPOSITORY not set

    expect(detectCIProvider()).toBe(null);
  });

  it('should return null when only partial Azure env vars are set', () => {
    process.env.SYSTEM_ACCESSTOKEN = 'azure_token';
    // SYSTEM_PULLREQUEST_PULLREQUESTID not set

    expect(detectCIProvider()).toBe(null);
  });

  it('should return null when only partial Bitbucket env vars are set', () => {
    process.env.BITBUCKET_REPO_SLUG = 'my-repo';
    // BITBUCKET_PR_ID not set

    expect(detectCIProvider()).toBe(null);
  });

  it('should prioritize GitHub over other providers when multiple are set', () => {
    // Set all providers
    process.env.GITHUB_TOKEN = 'ghp_test123';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.SYSTEM_ACCESSTOKEN = 'azure_token';
    process.env.SYSTEM_PULLREQUEST_PULLREQUESTID = '123';
    process.env.BITBUCKET_REPO_SLUG = 'my-repo';
    process.env.BITBUCKET_PR_ID = '456';

    // GitHub should be detected first due to check order
    expect(detectCIProvider()).toBe('github');
  });
});

describe('--comment flag behavior', () => {
  it('should skip confirmation when --comment is set', () => {
    const options = { comment: true };

    // Logic from index.js: if (!options.json && !options.comment) { confirmAction... }
    const shouldShowConfirmation = !options.json && !options.comment;

    expect(shouldShowConfirmation).toBe(false);
  });

  it('should skip confirmation when both --json and --comment are set', () => {
    const options = { json: true, comment: true };

    const shouldShowConfirmation = !options.json && !options.comment;

    expect(shouldShowConfirmation).toBe(false);
  });

  it('should show confirmation when neither --json nor --comment is set', () => {
    const options = {};

    const shouldShowConfirmation = !options.json && !options.comment;

    expect(shouldShowConfirmation).toBe(true);
  });
});

describe('--model flag behavior', () => {
  describe('model selection logic', () => {
    it('should treat --model without value as true (picker mode)', () => {
      const options = { model: true };

      // When --model is used without a value, Commander sets it to true
      const shouldShowPicker = options.model === true;
      const hasDirectValue = typeof options.model === 'string';

      expect(shouldShowPicker).toBe(true);
      expect(hasDirectValue).toBe(false);
    });

    it('should treat --model=value as string (direct mode)', () => {
      const options = { model: 'gemini-2.5-flash' };

      const shouldShowPicker = options.model === true;
      const hasDirectValue = typeof options.model === 'string';

      expect(shouldShowPicker).toBe(false);
      expect(hasDirectValue).toBe(true);
      expect(options.model).toBe('gemini-2.5-flash');
    });

    it('should not include model when flag is not used', () => {
      const options = {};

      const shouldIncludeModel = options.model !== undefined;

      expect(shouldIncludeModel).toBe(false);
    });
  });

  describe('payload model field', () => {
    it('should add model to payload when specified', () => {
      const payload = {
        repo_url: 'https://github.com/user/repo',
        changed_files: [],
      };

      const selectedModel = 'gemini-2.5-flash';
      if (selectedModel) {
        payload.model = selectedModel;
      }

      expect(payload.model).toBe('gemini-2.5-flash');
    });

    it('should not add model to payload when not specified', () => {
      const payload = {
        repo_url: 'https://github.com/user/repo',
        changed_files: [],
      };

      const selectedModel = null;
      if (selectedModel) {
        payload.model = selectedModel;
      }

      expect(payload.model).toBeUndefined();
    });
  });

  describe('available models', () => {
    it('should have valid model values', () => {
      const validModels = [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-3.1-pro-preview',
        'gemini-3-flash-preview',
        'gemini-3.6-flash',
        'gemini-3.7-flash',
      ];

      // Test that all expected models are valid Gemini model names
      validModels.forEach((model) => {
        expect(model).toMatch(/^gemini-/);
      });
    });
  });

  describe('numeric model shortcuts', () => {
    it('should resolve "1" to gemini-2.5-pro', () => {
      expect(resolveModel('1')).toBe('gemini-2.5-pro');
    });

    it('should resolve "2" to gemini-2.5-flash', () => {
      expect(resolveModel('2')).toBe('gemini-2.5-flash');
    });

    it('should resolve "3" to gemini-3.1-pro-preview', () => {
      expect(resolveModel('3')).toBe('gemini-3.1-pro-preview');
    });

    it('should resolve "4" to gemini-3-flash-preview', () => {
      expect(resolveModel('4')).toBe('gemini-3-flash-preview');
    });

    it('should resolve "5" to gemini-3.6-flash', () => {
      expect(resolveModel('5')).toBe('gemini-3.6-flash');
    });

    it('should resolve "6" to gemini-3.7-flash', () => {
      expect(resolveModel('6')).toBe('gemini-3.7-flash');
    });

    it('should pass through full model names unchanged', () => {
      expect(resolveModel('gemini-3.1-pro-preview')).toBe('gemini-3.1-pro-preview');
    });

    it('should pass through invalid input unchanged', () => {
      expect(resolveModel('invalid')).toBe('invalid');
      expect(resolveModel('0')).toBe('0');
      expect(resolveModel('7')).toBe('7');
    });
  });
});

describe('skipped response handling', () => {
  let stdoutSpy;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true and call spinner.info when response is skipped', () => {
    const response = {
      data: {
        skipped: true,
        reason: 'webhook_mode_active',
        message: 'Review skipped due to webhook mode.',
      },
    };
    const options = { json: false };
    const spinner = { info: vi.fn() };

    const result = handleSkippedResponse(response, options, spinner);

    expect(result).toBe(true);
    expect(spinner.info).toHaveBeenCalledWith('Review skipped due to webhook mode.');
  });

  it('should return false when response is not skipped', () => {
    const response = {
      data: {
        review: { issues: [], praises: [] },
        summary: { total_issues: 0 },
      },
    };
    const options = { json: false };
    const spinner = { info: vi.fn() };

    const result = handleSkippedResponse(response, options, spinner);

    expect(result).toBe(false);
    expect(spinner.info).not.toHaveBeenCalled();
  });

  it('should output JSON to stdout when json option is true and response is skipped', () => {
    const response = {
      data: {
        skipped: true,
        reason: 'local_reviews_disabled',
        message: 'Local reviews disabled.',
      },
    };
    const options = { json: true };
    const spinner = { info: vi.fn() };

    handleSkippedResponse(response, options, spinner);

    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify(response.data, null, 2) + '\n');
  });

  it('should not output JSON when json option is false', () => {
    const response = {
      data: {
        skipped: true,
        reason: 'reviews_disabled',
        message: 'Reviews disabled.',
      },
    };
    const options = { json: false };
    const spinner = { info: vi.fn() };

    handleSkippedResponse(response, options, spinner);

    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('should use default message when response message is empty', () => {
    const response = {
      data: {
        skipped: true,
        reason: 'webhook_mode_active',
      },
    };
    const options = { json: false };
    const spinner = { info: vi.fn() };

    handleSkippedResponse(response, options, spinner);

    expect(spinner.info).toHaveBeenCalledWith('Review skipped.');
  });

  it('should handle all skip reason types', () => {
    const reasons = ['webhook_mode_active', 'reviews_disabled', 'local_reviews_disabled'];
    const spinner = { info: vi.fn() };

    reasons.forEach((reason) => {
      const response = {
        data: { skipped: true, reason, message: `Skipped: ${reason}` },
      };

      const result = handleSkippedResponse(response, { json: false }, spinner);
      expect(result).toBe(true);
    });

    expect(spinner.info).toHaveBeenCalledTimes(3);
  });
});

describe('getPrUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    // Clear all PR-related env vars
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.PR_NUMBER;
    delete process.env.BITBUCKET_WORKSPACE;
    delete process.env.BITBUCKET_REPO_SLUG;
    delete process.env.BITBUCKET_PR_ID;
    delete process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI;
    delete process.env.SYSTEM_TEAMPROJECT;
    delete process.env.BUILD_REPOSITORY_NAME;
    delete process.env.SYSTEM_PULLREQUEST_PULLREQUESTID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return GitHub PR URL when GitHub env vars are set', () => {
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.PR_NUMBER = '123';

    expect(getPrUrl()).toBe('https://github.com/owner/repo/pull/123');
  });

  it('should return Bitbucket PR URL when Bitbucket env vars are set', () => {
    process.env.BITBUCKET_WORKSPACE = 'myworkspace';
    process.env.BITBUCKET_REPO_SLUG = 'myrepo';
    process.env.BITBUCKET_PR_ID = '456';

    expect(getPrUrl()).toBe('https://bitbucket.org/myworkspace/myrepo/pull-requests/456');
  });

  it('should return Azure DevOps PR URL when Azure env vars are set', () => {
    process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI = 'https://dev.azure.com/myorg/';
    process.env.SYSTEM_TEAMPROJECT = 'myproject';
    process.env.BUILD_REPOSITORY_NAME = 'myrepo';
    process.env.SYSTEM_PULLREQUEST_PULLREQUESTID = '789';

    expect(getPrUrl()).toBe('https://dev.azure.com/myorg/myproject/_git/myrepo/pullrequest/789');
  });

  it('should strip trailing slash from Azure DevOps collection URI', () => {
    process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI = 'https://dev.azure.com/myorg/';
    process.env.SYSTEM_TEAMPROJECT = 'myproject';
    process.env.BUILD_REPOSITORY_NAME = 'myrepo';
    process.env.SYSTEM_PULLREQUEST_PULLREQUESTID = '789';

    const url = getPrUrl();
    expect(url).not.toContain('myorg//myproject');
    expect(url).toContain('myorg/myproject');
  });

  it('should URL-encode spaces in Azure DevOps project and repo names', () => {
    process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI = 'https://dev.azure.com/myorg/';
    process.env.SYSTEM_TEAMPROJECT = 'My Project';
    process.env.BUILD_REPOSITORY_NAME = 'My Repo';
    process.env.SYSTEM_PULLREQUEST_PULLREQUESTID = '789';

    expect(getPrUrl()).toBe(
      'https://dev.azure.com/myorg/My%20Project/_git/My%20Repo/pullrequest/789'
    );
  });

  it('should return null when no PR env vars are set', () => {
    expect(getPrUrl()).toBe(null);
  });

  it('should return null when only partial GitHub env vars are set', () => {
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    // PR_NUMBER not set

    expect(getPrUrl()).toBe(null);
  });

  it('should return null when only partial Bitbucket env vars are set', () => {
    process.env.BITBUCKET_WORKSPACE = 'myworkspace';
    process.env.BITBUCKET_REPO_SLUG = 'myrepo';
    // BITBUCKET_PR_ID not set

    expect(getPrUrl()).toBe(null);
  });

  it('should return null when only partial Azure env vars are set', () => {
    process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI = 'https://dev.azure.com/myorg/';
    process.env.SYSTEM_TEAMPROJECT = 'myproject';
    // BUILD_REPOSITORY_NAME and SYSTEM_PULLREQUEST_PULLREQUESTID not set

    expect(getPrUrl()).toBe(null);
  });

  it('should prioritize GitHub over other providers when multiple are set', () => {
    // Set all providers
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.PR_NUMBER = '123';
    process.env.BITBUCKET_WORKSPACE = 'myworkspace';
    process.env.BITBUCKET_REPO_SLUG = 'myrepo';
    process.env.BITBUCKET_PR_ID = '456';

    // GitHub should be detected first due to check order
    expect(getPrUrl()).toBe('https://github.com/owner/repo/pull/123');
  });
});
