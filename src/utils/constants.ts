/**
 * Application Constants
 *
 * Centralized constants for configuration, limits, and default values
 */

// Application metadata
export const APP = {
  NAME: 'pipeline-assistant',
  VERSION: '1.0.0',
} as const;

// API and timeout defaults
export const API_DEFAULTS = {
  TIMEOUT_MS: 30000,
  MIN_TIMEOUT_MS: 1000,
  MAX_TIMEOUT_MS: 300000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// GitHub/Azure DevOps limits
export const PLATFORM_LIMITS = {
  MAX_INLINE_COMMENTS: 50,
  MAX_FILES_PER_PAGE: 100,
} as const;

// Cache and history limits
export const STORAGE_LIMITS = {
  MAX_POLICY_HISTORY: 50,
  MAX_METRICS_ENTRIES: 1000,
  MAX_TOP_VIOLATIONS: 10,
  MAX_METRICS_PERIODS: 12,
} as const;

// Auto-update intervals
export const UPDATE_INTERVALS = {
  DEFAULT_MS: 300000, // 5 minutes
  DEBOUNCE_MS: 1000,
} as const;

// File patterns
export const FILE_PATTERNS = {
  PIPELINE: /\.(yml|yaml)$/,
  PIPELINE_DIRS: ['.github/workflows/', 'azure-pipelines', 'pipeline'],
} as const;

// Wiki paths (relative to project root)
export const WIKI_PATHS = {
  STANDARDS: './wiki/standards',
  STANDARDS_FILE: 'pipeline-standards.md',
  POLICIES_FILE: 'security-policies.yaml',
  TEMPLATES_DIR: 'templates',
  HISTORY_FILE: '.policy-history.json',
  METRICS_FILE: '.adoption-metrics.json',
} as const;

// Severity descriptions (for reports)
export const SEVERITY_LABELS = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
} as const;

// Status check contexts
export const STATUS_CONTEXTS = {
  PIPELINE_COMPLIANCE: 'pipeline-assistant/compliance',
} as const;

// Environment types
export const ENVIRONMENTS = {
  DEV: 'dev',
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PROD: 'prod',
  PRODUCTION: 'production',
} as const;

// Project types
export const PROJECT_TYPES = {
  DOTNET: 'dotnet',
  NODE: 'node',
  PYTHON: 'python',
} as const;

// Analysis focus areas
export const ANALYSIS_FOCUS = {
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  COMPLIANCE: 'compliance',
  QUALITY: 'quality',
} as const;

// Enforcement modes
export const ENFORCEMENT_MODES = {
  LEARNING: 'learning',
  ENFORCEMENT: 'enforcement',
} as const;
