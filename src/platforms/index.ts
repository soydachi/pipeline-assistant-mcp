/**
 * Platform module exports and factory
 */

export * from './types.js';
export { AzureDevOpsPlatform } from './azure-devops.js';
export { GitHubActionsPlatform } from './github-actions.js';
export * from './variable-syntax.js';

import { PlatformAdapter, PlatformType, PlatformConfig } from './types.js';
import { AzureDevOpsPlatform } from './azure-devops.js';
import { GitHubActionsPlatform } from './github-actions.js';

/**
 * Factory for creating platform adapters
 */
export class PlatformFactory {
  private static adapters: Map<PlatformType, PlatformAdapter> = new Map();

  /**
   * Get a platform adapter by type
   */
  static getAdapter(platform: PlatformType): PlatformAdapter {
    if (!this.adapters.has(platform)) {
      this.adapters.set(platform, this.createAdapter(platform));
    }
    return this.adapters.get(platform)!;
  }

  /**
   * Create a new adapter instance
   */
  private static createAdapter(platform: PlatformType): PlatformAdapter {
    switch (platform) {
      case 'azure-devops':
        return new AzureDevOpsPlatform();
      case 'github-actions':
        return new GitHubActionsPlatform();
      case 'gitlab-ci':
        throw new Error('GitLab CI support coming soon');
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  /**
   * Get all supported platforms
   */
  static getSupportedPlatforms(): PlatformType[] {
    return ['azure-devops', 'github-actions'];
  }

  /**
   * Check if a platform is supported
   */
  static isSupported(platform: string): platform is PlatformType {
    return ['azure-devops', 'github-actions', 'gitlab-ci'].includes(platform);
  }

  /**
   * Get default configuration for a platform
   */
  static getDefaultConfig(platform: PlatformType): PlatformConfig {
    switch (platform) {
      case 'azure-devops':
        return {
          platform: 'azure-devops',
          defaultRunner: 'ubuntu-latest',
          serviceConnections: {
            docker: 'ACR-ServiceConnection',
            sonarqube: 'SonarQube-Connection',
            snyk: 'Snyk-Connection',
            azure: 'Azure-ServiceConnection',
          },
          variableGroups: ['common-variables'],
        };
      case 'github-actions':
        return {
          platform: 'github-actions',
          defaultRunner: 'ubuntu-latest',
          // GitHub Actions uses secrets instead of service connections
        };
      default:
        return {
          platform,
          defaultRunner: 'ubuntu-latest',
        };
    }
  }
}

/**
 * Detect platform from file content
 */
export function detectPlatform(content: string): PlatformType | null {
  // GitHub Actions indicators
  if (content.includes('runs-on:') || content.includes('uses:') || content.includes('actions/')) {
    return 'github-actions';
  }

  // Azure DevOps indicators
  if (content.includes('vmImage:') || content.includes('task:') || content.includes('pool:')) {
    return 'azure-devops';
  }

  // GitLab CI indicators
  if (content.includes('image:') && content.includes('script:') && !content.includes('steps:')) {
    return 'gitlab-ci';
  }

  return null;
}
