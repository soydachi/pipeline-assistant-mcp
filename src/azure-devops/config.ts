/**
 * Gestión de configuración para Azure DevOps
 *
 * Este módulo maneja la carga, validación y gestión de configuración
 * para la integración con Azure DevOps, soportando múltiples fuentes:
 * - Variables de entorno
 * - Archivos JSON
 * - Configuración programática
 * - Override por repositorio
 *
 * @module azure-devops/config
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  AzureDevOpsConfig,
  RetryPolicyConfig,
} from './types.js';

/**
 * Errores de validación de configuración
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public missingFields?: string[],
    public invalidFields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ConfigValidationError';
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
}

/**
 * Scopes requeridos del Personal Access Token
 */
export const REQUIRED_PAT_SCOPES = [
  'vso.code',        // Para leer/escribir código y PRs
  'vso.work_write',  // Para crear/actualizar work items
  'vso.build',       // Para acceder a build policies
] as const;

/**
 * Configuración por defecto
 */
const DEFAULT_CONFIG: Partial<AzureDevOpsConfig> = {
  enforcementMode: 'learning',
  strictMode: false,
  enableCache: true,
  timeout: 30000,
  verbose: false,
  retryPolicy: {
    maxRetries: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
    retryableStatusCodes: [429, 500, 502, 503, 504],
  },
};

/**
 * Gestor de configuración de Azure DevOps
 */
export class AzureDevOpsConfigManager {
  private config: AzureDevOpsConfig | null = null;
  private configSource: 'env' | 'file' | 'programmatic' | 'merged' | null = null;

  /**
   * Carga configuración desde variables de entorno
   *
   * Variables soportadas:
   * - AZDO_ORG_URL: URL de la organización
   * - AZDO_PAT: Personal Access Token
   * - AZDO_PROJECT: Nombre del proyecto
   * - AZDO_REPOSITORY: Nombre del repositorio (opcional)
   * - AZDO_REPOSITORY_ID: ID del repositorio (opcional)
   * - AZDO_ENFORCEMENT_MODE: Modo de enforcement (learning|enforcement)
   * - AZDO_STRICT_MODE: Modo estricto (true|false)
   * - AZDO_VERBOSE: Logging verboso (true|false)
   *
   * @returns Configuración cargada
   * @throws ConfigValidationError si faltan campos requeridos
   */
  loadFromEnv(): AzureDevOpsConfig {
    console.log('Loading Azure DevOps config from environment variables...');

    const config: Partial<AzureDevOpsConfig> = {
      organizationUrl: process.env.AZDO_ORG_URL,
      personalAccessToken: process.env.AZDO_PAT,
      project: process.env.AZDO_PROJECT,
      repository: process.env.AZDO_REPOSITORY,
      repositoryId: process.env.AZDO_REPOSITORY_ID,
      enforcementMode: (process.env.AZDO_ENFORCEMENT_MODE as any) || DEFAULT_CONFIG.enforcementMode,
      strictMode: process.env.AZDO_STRICT_MODE === 'true' || DEFAULT_CONFIG.strictMode,
      verbose: process.env.AZDO_VERBOSE === 'true' || DEFAULT_CONFIG.verbose,
      ...DEFAULT_CONFIG,
    };

    this.config = this.validateAndMerge(config);
    this.configSource = 'env';

    return this.config;
  }

  /**
   * Carga configuración desde archivo JSON
   *
   * @param filePath Ruta al archivo de configuración
   * @returns Configuración cargada
   * @throws Error si el archivo no existe o es inválido
   * @throws ConfigValidationError si la configuración es inválida
   */
  loadFromFile(filePath: string): AzureDevOpsConfig {
    console.log(`Loading Azure DevOps config from file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }

    let fileContent: string;
    try {
      fileContent = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    let configFromFile: Partial<AzureDevOpsConfig>;
    try {
      configFromFile = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Invalid JSON in configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const config: Partial<AzureDevOpsConfig> = {
      ...DEFAULT_CONFIG,
      ...configFromFile,
    };

    this.config = this.validateAndMerge(config);
    this.configSource = 'file';

    return this.config;
  }

  /**
   * Carga configuración programáticamente
   *
   * @param config Configuración a cargar
   * @returns Configuración validada y con defaults aplicados
   * @throws ConfigValidationError si la configuración es inválida
   */
  loadFromObject(config: Partial<AzureDevOpsConfig>): AzureDevOpsConfig {
    console.log('Loading Azure DevOps config from object...');

    const mergedConfig: Partial<AzureDevOpsConfig> = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.config = this.validateAndMerge(mergedConfig);
    this.configSource = 'programmatic';

    return this.config;
  }

  /**
   * Carga configuración con override desde repositorio
   *
   * Busca un archivo .pipeline-assistant.json en el repositorio
   * y combina con la configuración global
   *
   * @param repositoryPath Ruta al repositorio
   * @param baseConfig Configuración base a combinar
   * @returns Configuración combinada
   */
  loadWithRepositoryOverride(
    repositoryPath: string,
    baseConfig: AzureDevOpsConfig
  ): AzureDevOpsConfig {
    console.log(`Checking for repository config override in: ${repositoryPath}`);

    const repoConfigPath = path.join(repositoryPath, '.pipeline-assistant.json');

    if (!fs.existsSync(repoConfigPath)) {
      console.log('No repository override found, using base config');
      return baseConfig;
    }

    console.log('Found repository override, merging configurations...');

    let repoConfigContent: string;
    try {
      repoConfigContent = fs.readFileSync(repoConfigPath, 'utf-8');
    } catch (error) {
      console.warn(`Failed to read repository config: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return baseConfig;
    }

    let repoConfig: Partial<AzureDevOpsConfig>;
    try {
      repoConfig = JSON.parse(repoConfigContent);
    } catch (error) {
      console.warn(`Invalid JSON in repository config: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return baseConfig;
    }

    // Combinar configuraciones: repo override tiene precedencia
    const mergedConfig: Partial<AzureDevOpsConfig> = {
      ...baseConfig,
      ...repoConfig,
      // Combinar retry policy si ambos la definen
      retryPolicy: {
        ...(baseConfig.retryPolicy || {}),
        ...(repoConfig.retryPolicy || {}),
      } as RetryPolicyConfig,
    };

    this.config = this.validateAndMerge(mergedConfig);
    this.configSource = 'merged';

    console.log('Configuration merged successfully');
    return this.config;
  }

  /**
   * Valida configuración y aplica defaults
   *
   * @param config Configuración parcial
   * @returns Configuración completa y validada
   * @throws ConfigValidationError si faltan campos requeridos o son inválidos
   */
  private validateAndMerge(config: Partial<AzureDevOpsConfig>): AzureDevOpsConfig {
    const missingFields: string[] = [];
    const invalidFields: Record<string, string> = {};

    // Validar campos requeridos
    if (!config.organizationUrl) {
      missingFields.push('organizationUrl');
    } else if (!this.isValidOrganizationUrl(config.organizationUrl)) {
      invalidFields.organizationUrl = 'Must be a valid Azure DevOps organization URL (e.g., https://dev.azure.com/myorg)';
    }

    if (!config.personalAccessToken) {
      missingFields.push('personalAccessToken');
    }

    if (!config.project) {
      missingFields.push('project');
    }

    if (missingFields.length > 0 || Object.keys(invalidFields).length > 0) {
      const errorMessage = this.buildValidationErrorMessage(missingFields, invalidFields);
      throw new ConfigValidationError(errorMessage, missingFields, invalidFields);
    }

    // Validar campos opcionales
    if (config.enforcementMode && !['learning', 'enforcement'].includes(config.enforcementMode)) {
      invalidFields.enforcementMode = 'Must be either "learning" or "enforcement"';
    }

    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
      invalidFields.timeout = 'Must be between 1000 and 300000 ms';
    }

    if (Object.keys(invalidFields).length > 0) {
      const errorMessage = this.buildValidationErrorMessage([], invalidFields);
      throw new ConfigValidationError(errorMessage, [], invalidFields);
    }

    // Retornar configuración validada
    return {
      organizationUrl: config.organizationUrl!,
      personalAccessToken: config.personalAccessToken!,
      project: config.project!,
      repositoryId: config.repositoryId,
      repository: config.repository,
      enforcementMode: config.enforcementMode || DEFAULT_CONFIG.enforcementMode!,
      strictMode: config.strictMode ?? DEFAULT_CONFIG.strictMode!,
      enableCache: config.enableCache ?? DEFAULT_CONFIG.enableCache!,
      timeout: config.timeout || DEFAULT_CONFIG.timeout!,
      verbose: config.verbose ?? DEFAULT_CONFIG.verbose!,
      retryPolicy: {
        ...DEFAULT_CONFIG.retryPolicy!,
        ...config.retryPolicy,
      },
    };
  }

  /**
   * Valida que una URL de organización de Azure DevOps sea válida
   */
  private isValidOrganizationUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        (parsedUrl.hostname === 'dev.azure.com' || parsedUrl.hostname.endsWith('.visualstudio.com')) &&
        parsedUrl.pathname.length > 1
      );
    } catch {
      return false;
    }
  }

  /**
   * Construye mensaje de error de validación
   */
  private buildValidationErrorMessage(
    missingFields: string[],
    invalidFields: Record<string, string>
  ): string {
    let message = 'Azure DevOps configuration validation failed:\n';

    if (missingFields.length > 0) {
      message += `\nMissing required fields:\n`;
      missingFields.forEach(field => {
        message += `  - ${field}\n`;
      });
      message += '\nExample values:\n';
      message += '  - organizationUrl: https://dev.azure.com/myorg\n';
      message += '  - personalAccessToken: <your-pat-token>\n';
      message += '  - project: MyProject\n';
    }

    if (Object.keys(invalidFields).length > 0) {
      message += `\nInvalid fields:\n`;
      Object.entries(invalidFields).forEach(([field, reason]) => {
        message += `  - ${field}: ${reason}\n`;
      });
    }

    return message;
  }

  /**
   * Obtiene la configuración actual
   *
   * @returns Configuración actual o null si no se ha cargado
   */
  getConfig(): AzureDevOpsConfig | null {
    return this.config;
  }

  /**
   * Obtiene el origen de la configuración actual
   */
  getConfigSource(): 'env' | 'file' | 'programmatic' | 'merged' | null {
    return this.configSource;
  }

  /**
   * Redacta información sensible de la configuración para logging
   *
   * @param config Configuración a redactar
   * @returns Configuración con información sensible redactada
   */
  static redactSensitiveInfo(config: AzureDevOpsConfig): Record<string, any> {
    return {
      organizationUrl: config.organizationUrl,
      project: config.project,
      repository: config.repository,
      repositoryId: config.repositoryId,
      enforcementMode: config.enforcementMode,
      strictMode: config.strictMode,
      enableCache: config.enableCache,
      timeout: config.timeout,
      verbose: config.verbose,
      retryPolicy: config.retryPolicy,
      personalAccessToken: '***REDACTED***',
    };
  }

  /**
   * Exporta configuración a archivo JSON
   *
   * NOTA: El PAT será redactado por seguridad
   *
   * @param filePath Ruta donde guardar la configuración
   * @param includeDefaults Si incluir valores por defecto
   */
  exportToFile(filePath: string, includeDefaults: boolean = false): void {
    if (!this.config) {
      throw new Error('No configuration loaded to export');
    }

    const configToExport = includeDefaults
      ? this.config
      : this.removeDefaultValues(this.config);

    // Redactar PAT
    const redacted = AzureDevOpsConfigManager.redactSensitiveInfo(configToExport as AzureDevOpsConfig);

    const json = JSON.stringify(redacted, null, 2);
    fs.writeFileSync(filePath, json, 'utf-8');

    console.log(`Configuration exported to: ${filePath}`);
    console.log('NOTE: Personal Access Token was redacted for security');
  }

  /**
   * Remueve valores que coinciden con defaults
   */
  private removeDefaultValues(config: AzureDevOpsConfig): Partial<AzureDevOpsConfig> {
    const result: Partial<AzureDevOpsConfig> = {
      organizationUrl: config.organizationUrl,
      personalAccessToken: config.personalAccessToken,
      project: config.project,
    };

    if (config.repository) result.repository = config.repository;
    if (config.repositoryId) result.repositoryId = config.repositoryId;
    if (config.enforcementMode !== DEFAULT_CONFIG.enforcementMode) {
      result.enforcementMode = config.enforcementMode;
    }
    if (config.strictMode !== DEFAULT_CONFIG.strictMode) {
      result.strictMode = config.strictMode;
    }
    if (config.enableCache !== DEFAULT_CONFIG.enableCache) {
      result.enableCache = config.enableCache;
    }
    if (config.timeout !== DEFAULT_CONFIG.timeout) {
      result.timeout = config.timeout;
    }
    if (config.verbose !== DEFAULT_CONFIG.verbose) {
      result.verbose = config.verbose;
    }

    // Solo incluir retryPolicy si difiere de default
    const hasCustomRetryPolicy =
      config.retryPolicy?.maxRetries !== DEFAULT_CONFIG.retryPolicy?.maxRetries ||
      config.retryPolicy?.retryDelayMs !== DEFAULT_CONFIG.retryPolicy?.retryDelayMs ||
      config.retryPolicy?.backoffMultiplier !== DEFAULT_CONFIG.retryPolicy?.backoffMultiplier;

    if (hasCustomRetryPolicy) {
      result.retryPolicy = config.retryPolicy;
    }

    return result;
  }

  /**
   * Valida que el PAT tenga los permisos mínimos requeridos
   *
   * NOTA: Esto requiere hacer una llamada real a Azure DevOps API
   * para verificar los scopes del token. Por ahora solo documenta
   * los scopes requeridos.
   *
   * @returns Lista de scopes requeridos
   */
  static getRequiredScopes(): readonly string[] {
    return REQUIRED_PAT_SCOPES;
  }

  /**
   * Genera URL para crear un nuevo PAT con los scopes correctos
   *
   * @param organizationUrl URL de la organización
   * @returns URL para generar PAT
   */
  static generatePATCreationUrl(organizationUrl: string): string {
    try {
      const url = new URL(organizationUrl);
      const orgName = url.pathname.split('/')[1];
      return `https://dev.azure.com/${orgName}/_usersSettings/tokens`;
    } catch {
      return 'https://dev.azure.com/_usersSettings/tokens';
    }
  }

  /**
   * Imprime guía de configuración para ayudar al usuario
   */
  static printConfigurationGuide(): void {
    console.log('\n=== Azure DevOps Configuration Guide ===\n');
    console.log('Required configuration fields:');
    console.log('  - organizationUrl: Your Azure DevOps organization URL');
    console.log('    Example: https://dev.azure.com/myorg\n');
    console.log('  - personalAccessToken: PAT with required permissions');
    console.log('    Required scopes:');
    REQUIRED_PAT_SCOPES.forEach(scope => console.log(`      - ${scope}`));
    console.log('    Create PAT at: https://dev.azure.com/_usersSettings/tokens\n');
    console.log('  - project: Name of your Azure DevOps project\n');
    console.log('Optional configuration fields:');
    console.log('  - repository: Repository name (can be inferred)');
    console.log('  - repositoryId: Repository ID (can be inferred)');
    console.log('  - enforcementMode: "learning" (default) or "enforcement"');
    console.log('  - strictMode: true or false (default: false)');
    console.log('  - enableCache: true (default) or false');
    console.log('  - timeout: API timeout in ms (default: 30000)');
    console.log('  - verbose: Enable verbose logging (default: false)\n');
    console.log('Configuration methods:');
    console.log('  1. Environment variables (AZDO_ORG_URL, AZDO_PAT, etc.)');
    console.log('  2. JSON file (use loadFromFile)');
    console.log('  3. Programmatically (use loadFromObject)');
    console.log('  4. Repository override (.pipeline-assistant.json in repo root)\n');
    console.log('========================================\n');
  }
}

/**
 * Helper para crear configuración rápidamente
 *
 * @param organizationUrl URL de organización
 * @param personalAccessToken PAT
 * @param project Nombre del proyecto
 * @param options Opciones adicionales
 * @returns Configuración validada
 */
export function createConfig(
  organizationUrl: string,
  personalAccessToken: string,
  project: string,
  options?: Partial<Omit<AzureDevOpsConfig, 'organizationUrl' | 'personalAccessToken' | 'project'>>
): AzureDevOpsConfig {
  const manager = new AzureDevOpsConfigManager();
  return manager.loadFromObject({
    organizationUrl,
    personalAccessToken,
    project,
    ...options,
  });
}
