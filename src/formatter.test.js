import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatReviewOutput } from './formatter.js';

describe('formatReviewOutput', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('change_classification output', () => {
    it('should display change summary when change_classification.summary is present', () => {
      const data = {
        data: {
          review: { issues: [], praises: [] },
          summary: { total_issues: 0, total_praises: 0 },
          change_classification: {
            intent: 'fix',
            aspects: ['security', 'tests'],
            summary: 'Fix authentication bypass vulnerability',
          },
        },
      };

      formatReviewOutput(data);

      const allCalls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(allCalls.some((call) => call.includes('Change Summary'))).toBe(true);
      expect(
        allCalls.some((call) => call.includes('Fix authentication bypass vulnerability'))
      ).toBe(true);
      expect(allCalls.some((call) => call.includes('Intent: fix'))).toBe(true);
      expect(allCalls.some((call) => call.includes('Aspects: security, tests'))).toBe(true);
    });

    it('should not display change_classification section when summary is missing', () => {
      const data = {
        data: {
          review: { issues: [], praises: [] },
          summary: { total_issues: 0, total_praises: 0 },
          change_classification: null,
        },
      };

      formatReviewOutput(data);

      const allCalls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(allCalls.some((call) => call && call.includes('Change Summary'))).toBe(false);
    });

    it('should handle change_classification with only summary (no intent/aspects)', () => {
      const data = {
        data: {
          review: { issues: [], praises: [] },
          summary: { total_issues: 0, total_praises: 0 },
          change_classification: {
            summary: 'Add new feature',
          },
        },
      };

      formatReviewOutput(data);

      const allCalls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(allCalls.some((call) => call.includes('Change Summary'))).toBe(true);
      expect(allCalls.some((call) => call.includes('Add new feature'))).toBe(true);
      // Should not have metadata line when no intent/aspects
      expect(allCalls.some((call) => call && call.includes('Intent:'))).toBe(false);
    });

    it('should handle change_classification with empty aspects array', () => {
      const data = {
        data: {
          review: { issues: [], praises: [] },
          summary: { total_issues: 0, total_praises: 0 },
          change_classification: {
            intent: 'feature',
            aspects: [],
            summary: 'Add user dashboard',
          },
        },
      };

      formatReviewOutput(data);

      const allCalls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(allCalls.some((call) => call.includes('Add user dashboard'))).toBe(true);
      expect(allCalls.some((call) => call && call.includes('Intent: feature'))).toBe(true);
      expect(allCalls.some((call) => call && call.includes('Aspects:'))).toBe(false);
    });
  });
});
