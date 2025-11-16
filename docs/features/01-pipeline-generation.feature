# language: es
Característica: Generación de Pipelines desde Wiki
  Como desarrollador
  Quiero generar pipelines que cumplan con los estándares corporativos
  Para asegurar compliance y mejores prácticas automáticamente

  Antecedentes:
    Dado que existe una wiki con estándares de pipelines en "./wiki/standards"
    Y el servidor MCP está activo y conectado

  Escenario: Generar pipeline básico para proyecto .NET
    Dado que estoy trabajando en un proyecto .NET
    Cuando solicito generar un pipeline con el comando "generate_pipeline"
    Y especifico el tipo de proyecto como "dotnet"
    Entonces se genera un pipeline YAML con:
      | elemento | valor |
      | stages | Validate, Build, Test, Security, Deploy |
      | pool | ubuntu-latest |
      | trigger | main, develop |
    Y el pipeline incluye análisis de seguridad SAST
    Y el pipeline incluye escaneo de dependencias

  Escenario: Generar pipeline con servicios específicos
    Dado que mi proyecto usa Azure SQL y Redis
    Cuando solicito generar un pipeline
    Y especifico los servicios ["azuresql", "redis"]
    Entonces el pipeline incluye steps de validación para Azure SQL
    Y el pipeline incluye health checks para Redis
    Y se configuran las connection strings como secretos

  Escenario: Aplicar políticas de seguridad obligatorias
    Dado que la wiki define políticas de seguridad obligatorias
    Cuando genero cualquier pipeline
    Entonces se incluyen automáticamente:
      | política | implementación |
      | secret-scanning | TruffleHog task |
      | dependency-check | Snyk o WhiteSource |
      | SAST | SonarQube analysis |
      | container-scan | Trivy para imágenes Docker |
    Y estas tareas fallan el build si encuentran vulnerabilidades críticas
