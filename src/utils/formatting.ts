/**
 * Formatting Utilities
 *
 * Common formatting functions for scores, severities, and status indicators
 */

// Score thresholds
export const SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 80,
  FAIR: 60,
  POOR: 40,
} as const;

// Severity levels
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Get emoji for a compliance score
 */
export function getScoreEmoji(score: number): string {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return '🟢';
  if (score >= SCORE_THRESHOLDS.GOOD) return '🟢';
  if (score >= SCORE_THRESHOLDS.FAIR) return '🟡';
  if (score >= SCORE_THRESHOLDS.POOR) return '🟠';
  return '🔴';
}

/**
 * Get icon for a severity level
 */
export function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return '🔴';
    case 'HIGH':
      return '🟠';
    case 'MEDIUM':
      return '🟡';
    case 'LOW':
      return '🟢';
    default:
      return '⚪';
  }
}

/**
 * Get badge color for a score (for shields.io)
 */
export function getBadgeColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.GOOD) return 'green';
  if (score >= SCORE_THRESHOLDS.FAIR) return 'yellow';
  if (score >= SCORE_THRESHOLDS.POOR) return 'orange';
  return 'red';
}

/**
 * Get status text based on analysis results
 */
export function getStatusText(
  score: number,
  criticalCount: number = 0
): string {
  if (criticalCount > 0) {
    return 'Critical issues found';
  }
  if (score >= SCORE_THRESHOLDS.GOOD) {
    return 'Ready to merge';
  }
  if (score >= SCORE_THRESHOLDS.FAIR) {
    return 'Improvements recommended';
  }
  return 'Requires attention';
}

/**
 * Get compliance level based on score
 */
export function getComplianceLevel(
  score: number
): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return 'excellent';
  if (score >= SCORE_THRESHOLDS.GOOD) return 'good';
  if (score >= SCORE_THRESHOLDS.FAIR) return 'fair';
  return 'poor';
}

/**
 * Format a score with appropriate styling
 */
export function formatScore(score: number): string {
  const emoji = getScoreEmoji(score);
  return `${emoji} ${score}%`;
}

/**
 * Format severity with icon
 */
export function formatSeverity(severity: Severity): string {
  const icon = getSeverityIcon(severity);
  return `${icon} ${severity}`;
}

/**
 * Determine if score passes the minimum threshold
 */
export function passesMinimumThreshold(
  score: number,
  threshold: number = SCORE_THRESHOLDS.GOOD
): boolean {
  return score >= threshold;
}

/**
 * Get severity weight for sorting/prioritization
 */
export function getSeverityWeight(severity: Severity): number {
  switch (severity) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'LOW':
      return 1;
    default:
      return 0;
  }
}

/**
 * Sort items by severity (highest first)
 */
export function sortBySeverity<T extends { severity: Severity }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => getSeverityWeight(b.severity) - getSeverityWeight(a.severity)
  );
}
