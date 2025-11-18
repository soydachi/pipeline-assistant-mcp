import { describe, it, expect } from 'vitest';
import {
  getScoreEmoji,
  getSeverityIcon,
  getBadgeColor,
  getStatusText,
  getComplianceLevel,
  formatScore,
  formatSeverity,
  passesMinimumThreshold,
  getSeverityWeight,
  sortBySeverity,
  SCORE_THRESHOLDS,
} from '../../src/utils/formatting';

describe('Score Functions', () => {
  describe('getScoreEmoji', () => {
    it('should return green for excellent scores (>=90)', () => {
      expect(getScoreEmoji(100)).toBe('🟢');
      expect(getScoreEmoji(95)).toBe('🟢');
      expect(getScoreEmoji(90)).toBe('🟢');
    });

    it('should return green for good scores (>=80)', () => {
      expect(getScoreEmoji(89)).toBe('🟢');
      expect(getScoreEmoji(85)).toBe('🟢');
      expect(getScoreEmoji(80)).toBe('🟢');
    });

    it('should return yellow for fair scores (>=60)', () => {
      expect(getScoreEmoji(79)).toBe('🟡');
      expect(getScoreEmoji(70)).toBe('🟡');
      expect(getScoreEmoji(60)).toBe('🟡');
    });

    it('should return orange for poor scores (>=40)', () => {
      expect(getScoreEmoji(59)).toBe('🟠');
      expect(getScoreEmoji(50)).toBe('🟠');
      expect(getScoreEmoji(40)).toBe('🟠');
    });

    it('should return red for critical scores (<40)', () => {
      expect(getScoreEmoji(39)).toBe('🔴');
      expect(getScoreEmoji(20)).toBe('🔴');
      expect(getScoreEmoji(0)).toBe('🔴');
    });
  });

  describe('getBadgeColor', () => {
    it('should return green for good scores', () => {
      expect(getBadgeColor(90)).toBe('green');
      expect(getBadgeColor(80)).toBe('green');
    });

    it('should return yellow for fair scores', () => {
      expect(getBadgeColor(79)).toBe('yellow');
      expect(getBadgeColor(60)).toBe('yellow');
    });

    it('should return orange for poor scores', () => {
      expect(getBadgeColor(59)).toBe('orange');
      expect(getBadgeColor(40)).toBe('orange');
    });

    it('should return red for critical scores', () => {
      expect(getBadgeColor(39)).toBe('red');
      expect(getBadgeColor(0)).toBe('red');
    });
  });

  describe('getComplianceLevel', () => {
    it('should return correct compliance levels', () => {
      expect(getComplianceLevel(95)).toBe('excellent');
      expect(getComplianceLevel(85)).toBe('good');
      expect(getComplianceLevel(70)).toBe('fair');
      expect(getComplianceLevel(30)).toBe('poor');
    });
  });

  describe('passesMinimumThreshold', () => {
    it('should check against default threshold (80)', () => {
      expect(passesMinimumThreshold(80)).toBe(true);
      expect(passesMinimumThreshold(79)).toBe(false);
    });

    it('should check against custom threshold', () => {
      expect(passesMinimumThreshold(70, 60)).toBe(true);
      expect(passesMinimumThreshold(50, 60)).toBe(false);
    });
  });
});

describe('Severity Functions', () => {
  describe('getSeverityIcon', () => {
    it('should return correct icons for severities', () => {
      expect(getSeverityIcon('CRITICAL')).toBe('🔴');
      expect(getSeverityIcon('HIGH')).toBe('🟠');
      expect(getSeverityIcon('MEDIUM')).toBe('🟡');
      expect(getSeverityIcon('LOW')).toBe('🟢');
    });

    it('should return white for unknown severities', () => {
      expect(getSeverityIcon('UNKNOWN')).toBe('⚪');
    });
  });

  describe('getSeverityWeight', () => {
    it('should return correct weights', () => {
      expect(getSeverityWeight('CRITICAL')).toBe(4);
      expect(getSeverityWeight('HIGH')).toBe(3);
      expect(getSeverityWeight('MEDIUM')).toBe(2);
      expect(getSeverityWeight('LOW')).toBe(1);
    });
  });

  describe('sortBySeverity', () => {
    it('should sort items by severity (highest first)', () => {
      const items = [
        { severity: 'LOW' as const },
        { severity: 'CRITICAL' as const },
        { severity: 'MEDIUM' as const },
        { severity: 'HIGH' as const },
      ];

      const sorted = sortBySeverity(items);
      expect(sorted[0].severity).toBe('CRITICAL');
      expect(sorted[1].severity).toBe('HIGH');
      expect(sorted[2].severity).toBe('MEDIUM');
      expect(sorted[3].severity).toBe('LOW');
    });

    it('should not mutate original array', () => {
      const items = [
        { severity: 'LOW' as const },
        { severity: 'CRITICAL' as const },
      ];

      sortBySeverity(items);
      expect(items[0].severity).toBe('LOW');
    });
  });
});

describe('Formatting Functions', () => {
  describe('formatScore', () => {
    it('should format score with emoji', () => {
      expect(formatScore(90)).toBe('🟢 90%');
      expect(formatScore(50)).toBe('🟠 50%');
    });
  });

  describe('formatSeverity', () => {
    it('should format severity with icon', () => {
      expect(formatSeverity('CRITICAL')).toBe('🔴 CRITICAL');
      expect(formatSeverity('LOW')).toBe('🟢 LOW');
    });
  });

  describe('getStatusText', () => {
    it('should return critical message when critical issues exist', () => {
      expect(getStatusText(90, 1)).toBe('Critical issues found');
    });

    it('should return ready to merge for good scores', () => {
      expect(getStatusText(85)).toBe('Ready to merge');
    });

    it('should return improvements recommended for fair scores', () => {
      expect(getStatusText(70)).toBe('Improvements recommended');
    });

    it('should return requires attention for poor scores', () => {
      expect(getStatusText(30)).toBe('Requires attention');
    });
  });
});

describe('SCORE_THRESHOLDS', () => {
  it('should have correct values', () => {
    expect(SCORE_THRESHOLDS.EXCELLENT).toBe(90);
    expect(SCORE_THRESHOLDS.GOOD).toBe(80);
    expect(SCORE_THRESHOLDS.FAIR).toBe(60);
    expect(SCORE_THRESHOLDS.POOR).toBe(40);
  });
});
