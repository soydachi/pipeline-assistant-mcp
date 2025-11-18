/**
 * Platform-specific variable syntax mappings
 * Handles the different syntax for variables, secrets, and built-in values across platforms
 */

import { PlatformType } from './types.js';

export interface PlatformSyntax {
  platform: PlatformType;
  outputFile: string;

  // Variable syntax
  variableSyntax: (name: string) => string;
  secretSyntax: (name: string) => string;
  envSyntax: (name: string) => string;

  // Built-in variables
  buildNumber: string;
  buildId: string;
  branch: string;
  branchName: string;
  repository: string;
  repositoryName: string;
  commitSha: string;
  commitShort: string;
  workspace: string;
  sourcesDirectory: string;
  artifactDirectory: string;

  // Conditions
  conditions: {
    isMain: string;
    isDevelop: string;
    isPullRequest: string;
    success: string;
    failure: string;
    always: string;
  };
}

export const PLATFORM_SYNTAX: Record<PlatformType, PlatformSyntax> = {
  'azure-devops': {
    platform: 'azure-devops',
    outputFile: 'azure-pipelines.yml',

    variableSyntax: (name: string) => `$(${name})`,
    secretSyntax: (name: string) => `$(${name})`,
    envSyntax: (name: string) => `$(${name})`,

    buildNumber: '$(Build.BuildNumber)',
    buildId: '$(Build.BuildId)',
    branch: '$(Build.SourceBranch)',
    branchName: '$(Build.SourceBranchName)',
    repository: '$(Build.Repository.Name)',
    repositoryName: '$(Build.Repository.Name)',
    commitSha: '$(Build.SourceVersion)',
    commitShort: '$(Build.SourceVersion)',
    workspace: '$(Pipeline.Workspace)',
    sourcesDirectory: '$(Build.SourcesDirectory)',
    artifactDirectory: '$(Build.ArtifactStagingDirectory)',

    conditions: {
      isMain: "eq(variables['Build.SourceBranch'], 'refs/heads/main')",
      isDevelop: "eq(variables['Build.SourceBranch'], 'refs/heads/develop')",
      isPullRequest: "eq(variables['Build.Reason'], 'PullRequest')",
      success: 'succeeded()',
      failure: 'failed()',
      always: 'always()',
    },
  },

  'github-actions': {
    platform: 'github-actions',
    outputFile: '.github/workflows/ci-cd.yml',

    variableSyntax: (name: string) => `\${{ env.${name} }}`,
    secretSyntax: (name: string) => `\${{ secrets.${name} }}`,
    envSyntax: (name: string) => `\${{ env.${name} }}`,

    buildNumber: '${{ github.run_number }}',
    buildId: '${{ github.run_id }}',
    branch: '${{ github.ref }}',
    branchName: '${{ github.ref_name }}',
    repository: '${{ github.repository }}',
    repositoryName: '${{ github.event.repository.name }}',
    commitSha: '${{ github.sha }}',
    commitShort: '${{ github.sha }}',
    workspace: '${{ github.workspace }}',
    sourcesDirectory: '${{ github.workspace }}',
    artifactDirectory: '${{ github.workspace }}/artifacts',

    conditions: {
      isMain: "github.ref == 'refs/heads/main'",
      isDevelop: "github.ref == 'refs/heads/develop'",
      isPullRequest: "github.event_name == 'pull_request'",
      success: 'success()',
      failure: 'failure()',
      always: 'always()',
    },
  },

  'gitlab-ci': {
    platform: 'gitlab-ci',
    outputFile: '.gitlab-ci.yml',

    variableSyntax: (name: string) => `$${name}`,
    secretSyntax: (name: string) => `$${name}`,
    envSyntax: (name: string) => `$${name}`,

    buildNumber: '$CI_PIPELINE_IID',
    buildId: '$CI_PIPELINE_ID',
    branch: '$CI_COMMIT_REF_NAME',
    branchName: '$CI_COMMIT_REF_NAME',
    repository: '$CI_PROJECT_NAME',
    repositoryName: '$CI_PROJECT_NAME',
    commitSha: '$CI_COMMIT_SHA',
    commitShort: '$CI_COMMIT_SHORT_SHA',
    workspace: '$CI_PROJECT_DIR',
    sourcesDirectory: '$CI_PROJECT_DIR',
    artifactDirectory: '$CI_PROJECT_DIR/artifacts',

    conditions: {
      isMain: '$CI_COMMIT_BRANCH == "main"',
      isDevelop: '$CI_COMMIT_BRANCH == "develop"',
      isPullRequest: '$CI_PIPELINE_SOURCE == "merge_request_event"',
      success: 'on_success',
      failure: 'on_failure',
      always: 'always',
    },
  },
};

/**
 * Get platform syntax configuration
 */
export function getPlatformSyntax(platform: PlatformType): PlatformSyntax {
  const syntax = PLATFORM_SYNTAX[platform];
  if (!syntax) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return syntax;
}

/**
 * Convert a variable reference between platforms
 */
export function convertVariable(
  variable: string,
  fromPlatform: PlatformType,
  toPlatform: PlatformType
): string {
  const fromSyntax = getPlatformSyntax(fromPlatform);
  const toSyntax = getPlatformSyntax(toPlatform);

  // Map common variables
  const variableMap: Record<string, keyof PlatformSyntax> = {
    'Build.BuildId': 'buildId',
    'Build.BuildNumber': 'buildNumber',
    'Build.SourceBranch': 'branch',
    'Build.SourceBranchName': 'branchName',
    'Build.Repository.Name': 'repository',
    'Build.SourceVersion': 'commitSha',
    'Build.SourcesDirectory': 'sourcesDirectory',
    'Build.ArtifactStagingDirectory': 'artifactDirectory',
    'Pipeline.Workspace': 'workspace',
    'github.run_id': 'buildId',
    'github.run_number': 'buildNumber',
    'github.ref': 'branch',
    'github.ref_name': 'branchName',
    'github.repository': 'repository',
    'github.sha': 'commitSha',
    'github.workspace': 'workspace',
  };

  // Extract variable name from platform-specific syntax
  let varName = variable;

  // Azure DevOps: $(varName)
  const azureMatch = variable.match(/\$\(([^)]+)\)/);
  if (azureMatch) {
    varName = azureMatch[1];
  }

  // GitHub Actions: ${{ env.varName }} or ${{ github.varName }}
  const githubMatch = variable.match(/\$\{\{\s*(?:env\.|github\.)?([^}\s]+)\s*\}\}/);
  if (githubMatch) {
    varName = githubMatch[1];
  }

  // GitLab CI: $varName
  const gitlabMatch = variable.match(/\$([A-Z_]+)/);
  if (gitlabMatch) {
    varName = gitlabMatch[1];
  }

  // Check if it's a mapped variable
  if (variableMap[varName]) {
    const key = variableMap[varName];
    return toSyntax[key] as string;
  }

  // Default: just convert the syntax
  return toSyntax.variableSyntax(varName);
}

/**
 * Get default output filename for a platform
 */
export function getDefaultOutputFile(platform: PlatformType): string {
  return PLATFORM_SYNTAX[platform].outputFile;
}

/**
 * Generate environment variable block for a platform
 */
export function generateEnvBlock(
  platform: PlatformType,
  variables: Record<string, string>
): string {
  const syntax = getPlatformSyntax(platform);

  switch (platform) {
    case 'azure-devops':
      return Object.entries(variables)
        .map(([key, value]) => `  - name: ${key}\n    value: '${value}'`)
        .join('\n');

    case 'github-actions':
      return Object.entries(variables)
        .map(([key, value]) => `  ${key}: '${value}'`)
        .join('\n');

    case 'gitlab-ci':
      return Object.entries(variables)
        .map(([key, value]) => `  ${key}: "${value}"`)
        .join('\n');

    default:
      return '';
  }
}
