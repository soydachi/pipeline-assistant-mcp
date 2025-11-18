/**
 * Template Validator
 * Validates pipeline templates for common issues and invalid configurations
 */

import * as yaml from 'js-yaml';
import { PlatformType, detectPlatform } from '../platforms/index.js';

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  line?: number;
  details?: string;
}

export interface ValidationResult {
  valid: boolean;
  platform?: PlatformType;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export class TemplateValidator {
  // Invalid Azure DevOps tasks that don't exist
  private static INVALID_AZURE_TASKS = [
    { pattern: 'TruffleHog@', message: 'TruffleHog task does not exist. Use docker script with trufflesecurity/trufflehog image' },
    { pattern: 'Trivy@', message: 'Trivy task does not exist. Use docker script with aquasec/trivy image' },
    { pattern: 'Snyk@1', message: 'Use SnykSecurityScan@1 instead of Snyk@1' },
    { pattern: 'WhiteSource@', message: 'WhiteSource Bolt is deprecated. Use Mend or other SCA tool' },
    { pattern: 'SonarQubePrepare@5', message: 'SonarQubePrepare@5 is outdated. Use @6' },
    { pattern: 'SonarQubeAnalyze@5', message: 'SonarQubeAnalyze@5 is outdated. Use @6' },
    { pattern: 'SonarQubePublish@5', message: 'SonarQubePublish@5 is outdated. Use @6' },
  ];

  // Invalid GitHub Actions
  private static INVALID_GITHUB_ACTIONS = [
    { pattern: 'actions/checkout@v3', message: 'actions/checkout@v3 is outdated. Use @v4' },
    { pattern: 'actions/setup-node@v3', message: 'actions/setup-node@v3 is outdated. Use @v4' },
    { pattern: 'actions/setup-python@v4', message: 'actions/setup-python@v4 is outdated. Use @v5' },
    { pattern: 'actions/upload-artifact@v3', message: 'actions/upload-artifact@v3 is outdated. Use @v4' },
    { pattern: 'codecov/codecov-action@v3', message: 'codecov/codecov-action@v3 is outdated. Use @v4' },
  ];

  // Security best practices
  private static SECURITY_PATTERNS = [
    { pattern: /password\s*[:=]\s*['"][^'"]+['"]/i, message: 'Hardcoded password detected' },
    { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i, message: 'Hardcoded API key detected' },
    { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/i, message: 'Hardcoded secret detected' },
    { pattern: /token\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/i, message: 'Hardcoded token detected' },
  ];

  /**
   * Validate a pipeline template
   */
  static validate(content: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Detect platform
    const platform = detectPlatform(content);

    // Platform-specific validation
    if (platform === 'azure-devops') {
      this.validateAzureTemplate(content, errors, warnings);
    } else if (platform === 'github-actions') {
      this.validateGitHubTemplate(content, errors, warnings);
    }

    // Common validations
    this.validateYamlSyntax(content, errors);
    this.validateSecurityPatterns(content, errors);
    this.validateVariableSyntax(content, platform, errors, warnings);

    return {
      valid: errors.length === 0,
      platform: platform || undefined,
      errors,
      warnings,
    };
  }

  /**
   * Validate Azure DevOps template
   */
  private static validateAzureTemplate(
    content: string,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Check for invalid tasks
    for (const invalid of this.INVALID_AZURE_TASKS) {
      if (content.includes(invalid.pattern)) {
        errors.push({
          type: 'error',
          message: `Invalid Azure task: ${invalid.pattern}`,
          details: invalid.message,
        });
      }
    }

    // Check for GitHub Actions syntax in Azure template
    if (content.includes('${{ ')) {
      errors.push({
        type: 'error',
        message: 'GitHub Actions syntax detected in Azure DevOps template',
        details: 'Use $(variable) instead of ${{ variable }}',
      });
    }

    if (content.includes('uses:')) {
      errors.push({
        type: 'error',
        message: 'GitHub Actions "uses:" detected in Azure DevOps template',
        details: 'Use "task:" for Azure DevOps',
      });
    }

    // Check for mixed variable syntax in variables section
    const variablesMatch = content.match(/variables:\s*\n([\s\S]*?)(?=\nstages:|$)/);
    if (variablesMatch) {
      const variablesSection = variablesMatch[1];
      const lines = variablesSection.split('\n');

      let hasScalar = false;
      let hasList = false;

      for (const line of lines) {
        if (line.match(/^\s+-\s+name:/)) hasList = true;
        if (line.match(/^\s+-\s+group:/)) hasList = true;
        // Scalar format: exactly 2 spaces + word + colon (not preceded by a dash)
        // This excludes lines like "    value: 'Release'" which are part of list items
        if (line.match(/^  [a-zA-Z]\w*:\s+/)) hasScalar = true;
      }

      if (hasScalar && hasList) {
        errors.push({
          type: 'error',
          message: 'Mixed variable syntax in variables section',
          details: 'Cannot mix scalar (key: value) with list (- name:) format',
        });
      }
    }

    // Check for missing pool
    if (!content.includes('pool:')) {
      warnings.push({
        type: 'warning',
        message: 'No pool specified',
        details: 'Consider adding pool configuration for consistent build environment',
      });
    }

    // Check for security stage
    if (!content.includes('Security') && !content.includes('security')) {
      warnings.push({
        type: 'warning',
        message: 'No security stage detected',
        details: 'Consider adding security scanning to your pipeline',
      });
    }
  }

  /**
   * Validate GitHub Actions template
   */
  private static validateGitHubTemplate(
    content: string,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Check for invalid/outdated actions
    for (const invalid of this.INVALID_GITHUB_ACTIONS) {
      if (content.includes(invalid.pattern)) {
        warnings.push({
          type: 'warning',
          message: `Outdated action: ${invalid.pattern}`,
          details: invalid.message,
        });
      }
    }

    // Check for Azure DevOps syntax in GitHub template
    if (content.includes('$(') && !content.includes('${{')) {
      errors.push({
        type: 'error',
        message: 'Azure DevOps variable syntax detected in GitHub Actions template',
        details: 'Use ${{ env.variable }} instead of $(variable)',
      });
    }

    if (content.includes('task:')) {
      errors.push({
        type: 'error',
        message: 'Azure DevOps "task:" detected in GitHub Actions template',
        details: 'Use "uses:" for GitHub Actions',
      });
    }

    // Check for "on:" trigger
    if (!content.includes('on:')) {
      errors.push({
        type: 'error',
        message: 'No trigger defined',
        details: 'GitHub Actions requires an "on:" section to define triggers',
      });
    }

    // Check for security job
    if (!content.includes('security') && !content.includes('Security')) {
      warnings.push({
        type: 'warning',
        message: 'No security job detected',
        details: 'Consider adding security scanning to your workflow',
      });
    }
  }

  /**
   * Validate YAML syntax
   */
  private static validateYamlSyntax(content: string, errors: ValidationError[]): void {
    try {
      yaml.load(content);
    } catch (e) {
      const error = e as yaml.YAMLException;
      errors.push({
        type: 'error',
        message: 'Invalid YAML syntax',
        line: error.mark?.line,
        details: error.message,
      });
    }
  }

  /**
   * Validate security patterns
   */
  private static validateSecurityPatterns(content: string, errors: ValidationError[]): void {
    for (const pattern of this.SECURITY_PATTERNS) {
      if (pattern.pattern.test(content)) {
        errors.push({
          type: 'error',
          message: pattern.message,
          details: 'Remove hardcoded secrets and use secure variable groups or secrets',
        });
      }
    }
  }

  /**
   * Validate variable syntax consistency
   */
  private static validateVariableSyntax(
    content: string,
    platform: PlatformType | null,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (!platform) return;

    const azurePattern = /\$\([\w.]+\)/g;
    const githubPattern = /\$\{\{\s*[\w.]+\s*\}\}/g;

    const azureVars = content.match(azurePattern) || [];
    const githubVars = content.match(githubPattern) || [];

    if (platform === 'azure-devops' && githubVars.length > 0) {
      warnings.push({
        type: 'warning',
        message: 'Mixed variable syntax detected',
        details: `Found ${githubVars.length} GitHub-style variables in Azure template`,
      });
    }

    if (platform === 'github-actions' && azureVars.length > 0) {
      // Filter out false positives (shell commands like $(pwd))
      const actualAzureVars = azureVars.filter(v =>
        !v.includes('$(pwd)') &&
        !v.includes('$(date)') &&
        !v.includes('$(echo')
      );

      if (actualAzureVars.length > 0) {
        warnings.push({
          type: 'warning',
          message: 'Mixed variable syntax detected',
          details: `Found ${actualAzureVars.length} Azure-style variables in GitHub template`,
        });
      }
    }
  }

  /**
   * Quick validation for specific platform
   */
  static validateForPlatform(content: string, platform: PlatformType): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (platform === 'azure-devops') {
      this.validateAzureTemplate(content, errors, warnings);
    } else if (platform === 'github-actions') {
      this.validateGitHubTemplate(content, errors, warnings);
    }

    this.validateYamlSyntax(content, errors);
    this.validateSecurityPatterns(content, errors);

    return {
      valid: errors.length === 0,
      platform,
      errors,
      warnings,
    };
  }
}
