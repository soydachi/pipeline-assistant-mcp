# language: es
Característica: Integración con VS Code
  Como desarrollador usando VS Code
  Quiero interactuar con el Pipeline Assistant desde mi IDE
  Para tener asistencia en tiempo real mientras trabajo

  Antecedentes:
    Dado que tengo la extensión Pipeline Assistant instalada
    Y el servidor MCP está ejecutándose

  Escenario: Generar pipeline desde comando
    Dado que tengo un proyecto abierto en VS Code
    Cuando ejecuto el comando "Pipeline Assistant: Generate"
    Entonces aparece un selector de tipo de proyecto
    Y tras seleccionar "python" se genera azure-pipelines.yml
    Y el archivo se abre automáticamente en el editor
    Y se muestra notificación de éxito

  Escenario: Análisis en tiempo real mientras edito
    Dado que estoy editando un archivo .yml de pipeline
    Cuando guardo el archivo
    Entonces se ejecuta análisis automático
    Y las violaciones aparecen como errores en Problems panel
    Y los warnings aparecen con squiggly lines amarillas
    Y hover sobre errores muestra la sugerencia de fix

  Escenario: Quick fixes para violaciones
    Dado que tengo una violación "MISSING_STAGE"
    Cuando hago click en el bombillo de Quick Fix
    Entonces veo la opción "Add Security Stage"
    Y al seleccionarla se inserta el código correcto
    Y la violación desaparece del panel de problemas

  Escenario: Consultar wiki desde VS Code
    Dado que veo un warning sobre políticas
    Cuando hago click en "Ver estándares en wiki"
    Entonces se abre un webview con la documentación relevante
    Y puedo ver ejemplos de implementación correcta
    Y tengo acceso a templates aprobados

  Escenario: Autocompletado inteligente
    Dado que estoy escribiendo un nuevo step en el pipeline
    Cuando escribo "- task:"
    Entonces aparecen sugerencias basadas en la wiki
    Y las tareas obligatorias aparecen primero
    Y cada sugerencia incluye snippet completo
