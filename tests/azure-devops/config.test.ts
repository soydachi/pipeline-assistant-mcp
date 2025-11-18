/**
 * Tests para Azure DevOps Configuration Manager
 *
 * Cubre escenarios 6.2.1 - 6.2.6 de Fase 1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  AzureDevOpsConfigManager,
  ConfigValidationError,
  createConfig,
  REQUIRED_PAT_SCOPES,
} from '../../src/azure-devops/config.js';
import type { AzureDevOpsConfig } from '../../src/azure-devops/types.js';

describe('AzureDevOpsConfigManager - Fase 1', () => {
  let configManager: AzureDevOpsConfigManager;
  let tempDir: string;
  let tempConfigFile: string;

  beforeEach(() => {
    configManager = new AzureDevOpsConfigManager();
    tempDir = path.join(process.cwd(), 'temp-test-config');
    tempConfigFile = path.join(tempDir, 'azdo-config.json');

    // Crear directorio temporal
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Limpiar variables de entorno
    delete process.env.AZDO_ORG_URL;
    delete process.env.AZDO_PAT;
    delete process.env.AZDO_PROJECT;
  });

  afterEach(() => {
    // Limpiar archivos temporales
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Limpiar variables de entorno
    delete process.env.AZDO_ORG_URL;
    delete process.env.AZDO_PAT;
    delete process.env.AZDO_PROJECT;
  });

  describe('Escenario 6.2.1: Cargar configuración desde variables de entorno', () => {
    it('debe cargar configuración válida desde variables de entorno', () => {
      // Given: Variables de entorno configuradas
      process.env.AZDO_ORG_URL = 'https://dev.azure.com/myorg';
      process.env.AZDO_PAT = 'test-pat-token-123';
      process.env.AZDO_PROJECT = 'MyProject';
      process.env.AZDO_REPOSITORY = 'my-repo';

      // When: Cargar configuración desde env
      const config = configManager.loadFromEnv();

      // Then: Debe tener los valores correctos
      expect(config.organizationUrl).toBe('https://dev.azure.com/myorg');
      expect(config.personalAccessToken).toBe('test-pat-token-123');
      expect(config.project).toBe('MyProject');
      expect(config.repository).toBe('my-repo');
    });

    it('debe aplicar valores por defecto cuando no están en variables de entorno', () => {
      // Given: Solo valores mínimos requeridos
      process.env.AZDO_ORG_URL = 'https://dev.azure.com/myorg';
      process.env.AZDO_PAT = 'test-pat';
      process.env.AZDO_PROJECT = 'MyProject';

      // When: Cargar configuración
      const config = configManager.loadFromEnv();

      // Then: Debe tener valores por defecto
      expect(config.enforcementMode).toBe('learning');
      expect(config.strictMode).toBe(false);
      expect(config.enableCache).toBe(true);
      expect(config.retryPolicy).toBeDefined();
      expect(config.retryPolicy!.maxRetries).toBe(3);
    });

    it('debe fallar si faltan variables requeridas', () => {
      // Given: Variables de entorno incompletas
      process.env.AZDO_ORG_URL = 'https://dev.azure.com/myorg';
      // Falta PAT y PROJECT

      // When/Then: Debe lanzar error de validación
      expect(() => configManager.loadFromEnv()).toThrow(ConfigValidationError);
    });
  });

  describe('Escenario 6.2.2: Cargar configuración desde archivo JSON', () => {
    it('debe cargar configuración válida desde archivo JSON', () => {
      // Given: Archivo de configuración JSON
      const configData: Partial<AzureDevOpsConfig> = {
        organizationUrl: 'https://dev.azure.com/testorg',
        personalAccessToken: 'file-pat-token',
        project: 'TestProject',
        repository: 'test-repo',
        enforcementMode: 'enforcement',
        strictMode: true,
      };

      fs.writeFileSync(tempConfigFile, JSON.stringify(configData, null, 2));

      // When: Cargar desde archivo
      const config = configManager.loadFromFile(tempConfigFile);

      // Then: Debe tener los valores del archivo
      expect(config.organizationUrl).toBe('https://dev.azure.com/testorg');
      expect(config.personalAccessToken).toBe('file-pat-token');
      expect(config.project).toBe('TestProject');
      expect(config.enforcementMode).toBe('enforcement');
      expect(config.strictMode).toBe(true);
    });

    it('debe fallar si el archivo no existe', () => {
      // Given: Ruta de archivo inexistente
      const nonExistentFile = path.join(tempDir, 'no-existe.json');

      // When/Then: Debe lanzar error
      expect(() => configManager.loadFromFile(nonExistentFile)).toThrow();
    });

    it('debe fallar si el JSON es inválido', () => {
      // Given: Archivo con JSON mal formado
      fs.writeFileSync(tempConfigFile, '{ invalid json }');

      // When/Then: Debe lanzar error
      expect(() => configManager.loadFromFile(tempConfigFile)).toThrow();
    });
  });

  describe('Escenario 6.2.3: Validación de configuración incompleta', () => {
    it('debe rechazar configuración sin URL de organización', () => {
      // Given: Configuración sin URL usando helper
      const manager = new AzureDevOpsConfigManager();

      // When/Then: Debe lanzar error de validación
      expect(() => manager.loadFromObject({
        personalAccessToken: 'test-pat',
        project: 'TestProject',
      } as any)).toThrow(ConfigValidationError);
    });

    it('debe rechazar configuración sin PAT', () => {
      // Given: Configuración sin PAT
      const manager = new AzureDevOpsConfigManager();

      // When/Then: Debe lanzar error
      expect(() => manager.loadFromObject({
        organizationUrl: 'https://dev.azure.com/myorg',
        project: 'TestProject',
      } as any)).toThrow(ConfigValidationError);
    });

    it('debe rechazar configuración sin proyecto', () => {
      // Given: Configuración sin proyecto
      const manager = new AzureDevOpsConfigManager();

      // When/Then: Debe lanzar error
      expect(() => manager.loadFromObject({
        organizationUrl: 'https://dev.azure.com/myorg',
        personalAccessToken: 'test-pat',
      } as any)).toThrow(ConfigValidationError);
    });

    it('debe rechazar URL de organización inválida', () => {
      // Given: URL inválida
      const manager = new AzureDevOpsConfigManager();

      // When/Then: Debe lanzar error
      expect(() => manager.loadFromObject({
        organizationUrl: 'not-a-valid-url',
        personalAccessToken: 'test-pat',
        project: 'TestProject',
      } as any)).toThrow(ConfigValidationError);
    });
  });

  describe('Escenario 6.2.4: Configuración de enforcement mode', () => {
    it('debe aceptar modo learning', () => {
      // Given: Configuración con modo learning
      const config = createConfig(
        'https://dev.azure.com/myorg',
        'test-pat',
        'TestProject',
        { enforcementMode: 'learning' }
      );

      // Then: Debe tener modo learning
      expect(config.enforcementMode).toBe('learning');
    });

    it('debe aceptar modo enforcement', () => {
      // Given: Configuración con modo enforcement
      const config = createConfig(
        'https://dev.azure.com/myorg',
        'test-pat',
        'TestProject',
        { enforcementMode: 'enforcement' }
      );

      // Then: Debe tener modo enforcement
      expect(config.enforcementMode).toBe('enforcement');
    });

    it('debe usar learning como valor por defecto', () => {
      // Given: Configuración sin especificar modo
      const config = createConfig(
        'https://dev.azure.com/myorg',
        'test-pat',
        'TestProject'
      );

      // Then: Debe usar learning por defecto
      expect(config.enforcementMode).toBe('learning');
    });
  });

  describe('Escenario 6.2.5: Configuración de strict mode', () => {
    it('debe habilitar strict mode cuando se especifica', () => {
      // Given: Configuración con strict mode
      const config = createConfig(
        'https://dev.azure.com/myorg',
        'test-pat',
        'TestProject',
        { strictMode: true }
      );

      // Then: Debe tener strict mode habilitado
      expect(config.strictMode).toBe(true);
    });

    it('debe deshabilitar strict mode por defecto', () => {
      // Given: Configuración sin especificar strict mode
      const config = createConfig(
        'https://dev.azure.com/myorg',
        'test-pat',
        'TestProject'
      );

      // Then: Debe estar deshabilitado por defecto
      expect(config.strictMode).toBe(false);
    });
  });

  describe('Escenario 6.2.6: Override de configuración por repositorio', () => {
    it('debe combinar configuración base con override de repositorio', () => {
      // Given: Configuración base
      const baseConfig = createConfig(
        'https://dev.azure.com/myorg',
        'base-pat',
        'BaseProject',
        {
          enforcementMode: 'learning',
          strictMode: false,
        }
      );

      // Y un archivo de override en el repositorio
      const repoOverridePath = path.join(tempDir, '.pipeline-assistant.json');
      const overrideConfig = {
        enforcementMode: 'enforcement',
        strictMode: true,
        retryPolicy: {
          maxRetries: 5,
        },
      };

      fs.writeFileSync(repoOverridePath, JSON.stringify(overrideConfig, null, 2));

      // When: Cargar con override
      const mergedConfig = configManager.loadWithRepositoryOverride(tempDir, baseConfig);

      // Then: Debe combinar ambas configuraciones
      expect(mergedConfig.organizationUrl).toBe('https://dev.azure.com/myorg'); // De base
      expect(mergedConfig.personalAccessToken).toBe('base-pat'); // De base
      expect(mergedConfig.project).toBe('BaseProject'); // De base
      expect(mergedConfig.enforcementMode).toBe('enforcement'); // Override
      expect(mergedConfig.strictMode).toBe(true); // Override
      expect(mergedConfig.retryPolicy!.maxRetries).toBe(5); // Override
    });

    it('debe usar configuración base si no hay archivo de override', () => {
      // Given: Configuración base sin archivo de override
      const baseConfig = createConfig(
        'https://dev.azure.com/myorg',
        'base-pat',
        'BaseProject',
        { enforcementMode: 'learning' }
      );

      // When: Cargar con override (sin archivo)
      const mergedConfig = configManager.loadWithRepositoryOverride(tempDir, baseConfig);

      // Then: Debe mantener configuración base
      expect(mergedConfig).toEqual(baseConfig);
    });
  });

  describe('Redacción de información sensible', () => {
    it('debe redactar PAT al exportar configuración', () => {
      // Given: Configuración con PAT
      const config = createConfig(
        'https://dev.azure.com/myorg',
        'super-secret-pat-token-123',
        'TestProject'
      );

      // When: Redactar información sensible
      const redacted = AzureDevOpsConfigManager.redactSensitiveInfo(config);

      // Then: PAT debe estar redactado
      expect(redacted.personalAccessToken).toBe('***REDACTED***');
      expect(redacted.organizationUrl).toBe('https://dev.azure.com/myorg');
      expect(redacted.project).toBe('TestProject');
    });
  });

  describe('Scopes requeridos del PAT', () => {
    it('debe exportar los scopes requeridos', () => {
      // Then: Debe incluir todos los scopes necesarios
      expect(REQUIRED_PAT_SCOPES).toContain('vso.code');
      expect(REQUIRED_PAT_SCOPES).toContain('vso.work_write');
      expect(REQUIRED_PAT_SCOPES).toContain('vso.build');
      expect(REQUIRED_PAT_SCOPES.length).toBe(3);
    });
  });
});
