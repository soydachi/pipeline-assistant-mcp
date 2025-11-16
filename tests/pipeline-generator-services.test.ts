import { PipelineGenerator } from '../src/pipeline-generator';
import { WikiParser } from '../src/wiki-parser';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Pipeline Generator - Service Integration', () => {
  let generator: PipelineGenerator;
  let wikiParser: WikiParser;

  beforeEach(() => {
    wikiParser = new WikiParser('./wiki/standards');
    generator = new PipelineGenerator(wikiParser);
  });

  describe('Escenario: Generar pipeline con servicios específicos', () => {
    it('debe incluir configuración para Azure SQL y Redis', async () => {
      // Given: Mi proyecto usa Azure SQL y Redis
      const services = ['azuresql', 'redis'];
      
      // When: Solicito generar un pipeline
      await wikiParser.loadStandards();
      const standards = await wikiParser.getStandardsForProject('dotnet');
      
      const pipeline = await generator.generatePipeline({
        projectType: 'dotnet',
        services: services,
        environment: 'prod',
        standards: standards
      });

      // Then: El pipeline incluye steps de validación para Azure SQL
      expect(pipeline).toContain('Validate service availability');
      expect(pipeline).toContain('az sql server show');
      expect(pipeline).toContain('Azure SQL Server $(sqlServerName) not accessible');

      // And: El pipeline incluye health checks para Redis
      expect(pipeline).toContain('Service health checks');
      expect(pipeline).toContain('Testing Redis cache');
      expect(pipeline).toContain('redis.cache.windows.net');

      // And: Se configuran las connection strings como secretos
      expect(pipeline).toContain('Get secrets from Key Vault');
      expect(pipeline).toContain('SQL-ADMIN-USERNAME');
      expect(pipeline).toContain('SQL-ADMIN-PASSWORD');
      expect(pipeline).toContain('REDIS-CONNECTION-STRING');
      expect(pipeline).toContain('$(keyVaultName)');
    });

    it('debe agregar stage de Key Vault cuando hay servicios', async () => {
      // Given: Proyecto con múltiples servicios
      const services = ['azuresql', 'redis', 'cosmosdb', 'servicebus'];
      
      // When: Genero pipeline
      await wikiParser.loadStandards();
      const standards = await wikiParser.getStandardsForProject('node');
      
      const pipeline = await generator.generatePipeline({
        projectType: 'node',
        services: services,
        environment: 'staging',
        standards: standards
      });

      // Then: Debe existir un stage de Key Vault
      expect(pipeline).toContain('- stage: KeyVault');
      expect(pipeline).toContain('Configure Secrets');
      
      // And: Debe validar todos los secretos requeridos
      expect(pipeline).toContain('COSMOS-PRIMARY-KEY');
      expect(pipeline).toContain('SERVICE-BUS-CONNECTION-STRING');
      
      // And: Debe incluir tests de integración para cada servicio
      expect(pipeline).toContain('Test service integrations');
      expect(pipeline).toContain('SQL integration test completed');
      expect(pipeline).toContain('Redis integration test completed');
      expect(pipeline).toContain('CosmosDB integration test completed');
      expect(pipeline).toContain('Service Bus integration test completed');
    });

    it('debe configurar variables específicas para cada servicio', async () => {
      // Given: Proyecto con almacenamiento y Key Vault
      const services = ['storage', 'keyvault'];
      
      // When: Genero pipeline
      await wikiParser.loadStandards();
      const standards = await wikiParser.getStandardsForProject('python');
      
      const pipeline = await generator.generatePipeline({
        projectType: 'python',
        services: services,
        environment: 'dev',
        standards: standards
      });

      // Then: Debe incluir variables de Storage
      expect(pipeline).toContain('storageAccountName');
      expect(pipeline).toContain('STORAGE_ACCOUNT_KEY');
      expect(pipeline).toContain('DefaultEndpointsProtocol=https');
      
      // And: Debe incluir variables de Key Vault
      expect(pipeline).toContain('keyVaultUrl');
      expect(pipeline).toContain('vault.azure.net');
    });

    it('debe incluir validación pre-deployment para servicios', async () => {
      // Given: Pipeline con servicios críticos
      const services = ['azuresql', 'cosmosdb'];
      
      // When: Genero pipeline para producción
      await wikiParser.loadStandards();
      const standards = await wikiParser.getStandardsForProject('dotnet');
      
      const pipeline = await generator.generatePipeline({
        projectType: 'dotnet',
        services: services,
        environment: 'prod',
        standards: standards
      });

      // Then: Debe validar disponibilidad antes del deploy
      expect(pipeline).toContain('Pre-deployment service validation');
      expect(pipeline).toContain('az cosmosdb show');
      expect(pipeline).toContain('CosmosDB $(cosmosDbName) not accessible');
      
      // And: Debe incluir post-deployment health checks
      expect(pipeline).toContain('Post-deployment health checks');
      expect(pipeline).toContain('Testing Azure SQL connection');
      expect(pipeline).toContain('Testing CosmosDB endpoint');
    });
  });

  describe('Edge cases', () => {
    it('debe manejar pipelines sin servicios', async () => {
      // Given: Proyecto sin servicios externos
      const services: string[] = [];
      
      // When: Genero pipeline
      await wikiParser.loadStandards();
      const standards = await wikiParser.getStandardsForProject('node');
      
      const pipeline = await generator.generatePipeline({
        projectType: 'node',
        services: services,
        environment: 'dev',
        standards: standards
      });

      // Then: No debe incluir stage de Key Vault
      expect(pipeline).not.toContain('- stage: KeyVault');
      
      // And: No debe incluir validaciones de servicios
      expect(pipeline).not.toContain('Pre-deployment service validation');
      expect(pipeline).not.toContain('Service health checks');
    });

    it('debe auto-agregar Key Vault cuando hay servicios pero no está especificado', async () => {
      // Given: Servicios que requieren secretos pero sin Key Vault explícito
      const services = ['azuresql', 'redis'];
      
      // When: Genero pipeline
      await wikiParser.loadStandards();
      const standards = await wikiParser.getStandardsForProject('python');
      
      const pipeline = await generator.generatePipeline({
        projectType: 'python',
        services: services,
        environment: 'staging',
        standards: standards
      });

      // Then: Debe agregar configuración de Key Vault automáticamente
      expect(pipeline).toContain('Key Vault for secrets (auto-added for services)');
      expect(pipeline).toContain('keyVaultName');
    });
  });
});
