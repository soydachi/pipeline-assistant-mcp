# 📦 VS Code Extension - Installation Guide

## ✅ Extension Package Ready

The Pipeline Assistant VS Code extension has been successfully compiled and packaged as a VSIX file.

**File:** `vscode-extension/pipeline-assistant-vscode-1.0.0.vsix`
**Size:** 74 KB
**Status:** ✅ Ready for installation

---

## 🚀 Installation Methods

### Method 1: Command Line (Recommended)

```bash
# From project root
code --install-extension vscode-extension/pipeline-assistant-vscode-1.0.0.vsix

# Or from vscode-extension directory
cd vscode-extension
code --install-extension pipeline-assistant-vscode-1.0.0.vsix
```

### Method 2: VS Code UI

1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Extensions: Install from VSIX"
4. Select the file: `pipeline-assistant-vscode-1.0.0.vsix`
5. Restart VS Code when prompted

### Method 3: Drag & Drop

1. Open VS Code
2. Open Extensions view (`Cmd+Shift+X` or `Ctrl+Shift+X`)
3. Drag `pipeline-assistant-vscode-1.0.0.vsix` into the Extensions view
4. Click "Install" when prompted

---

## ✅ Verify Installation

After installation:

```bash
# 1. Open VS Code
code .

# 2. Check if extension is installed
# View → Extensions → Search "Pipeline Assistant"
# You should see it listed

# 3. Open Command Palette (Cmd+Shift+P)
# Type "Pipeline Assistant"
# You should see commands:
#   - Pipeline Assistant: Generate Pipeline
#   - Pipeline Assistant: Analyze Current Pipeline
#   - Pipeline Assistant: Suggest Improvements
#   - Pipeline Assistant: Open Standards Wiki
```

---

## 🎯 Quick Test

### Test 1: Create a Pipeline File

1. Create a new file: `test-pipeline.yml`
2. Paste this content:

```yaml
trigger: true
variables:
  PASSWORD: "admin123"
steps:
  - script: echo "test"
```

3. The extension should show warnings (red underlines)
4. Hover over the issues to see details

### Test 2: Use Commands

1. Press `Cmd+Shift+P` (or `Ctrl+Shift+P`)
2. Type "Pipeline Assistant: Generate"
3. Follow the prompts:
   - Select project type: `node`
   - Select services: (optional)
   - Select environment: `dev`
4. A new pipeline file should be created

### Test 3: Context Menu

1. Right-click on a `.yml` file
2. You should see:
   - "Analyze Current Pipeline"
   - "Suggest Improvements"

---

## ⚙️ Configuration

After installation, configure the extension:

1. Open Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "Pipeline Assistant"
3. Configure:

```json
{
  "pipelineAssistant.mcpServerPath": "",  // Leave empty to use default
  "pipelineAssistant.wikiPath": "./wiki/standards",
  "pipelineAssistant.enableAutoAnalysis": true,
  "pipelineAssistant.strictMode": false,
  "pipelineAssistant.showInlineHints": true
}
```

---

## 🔧 Troubleshooting

### Extension not appearing

```bash
# List installed extensions
code --list-extensions | grep pipeline

# If not found, reinstall
code --uninstall-extension pipeline-assistant.pipeline-assistant-vscode
code --install-extension vscode-extension/pipeline-assistant-vscode-1.0.0.vsix
```

### Commands not working

1. Open Developer Console: `Help → Toggle Developer Tools`
2. Look for errors in Console tab
3. Check if MCP server path is correct in settings

### MCP Connection Issues

The extension tries to connect to the MCP server at:
- Default: `../dist/src/server.js` (relative to extension)
- Custom: Set in `pipelineAssistant.mcpServerPath`

Make sure the main project is compiled:
```bash
npm run build
```

---

## 🎨 Features

### ✅ Implemented

- **Command Palette Integration**
  - Generate Pipeline
  - Analyze Current Pipeline
  - Suggest Improvements
  - Open Standards Wiki

- **Context Menu**
  - Right-click on YAML files
  - Quick access to analyze and suggest

- **Diagnostics**
  - Real-time analysis of pipeline files
  - Inline warnings and errors
  - Severity levels (CRITICAL, HIGH, MEDIUM, LOW)

- **Auto-Analysis**
  - Analyzes on file save (configurable)
  - Immediate feedback

- **Status Bar**
  - Shows extension status
  - Connection to MCP server

### 🚧 In Development

- Code completion for pipeline tasks
- Quick fixes for common issues
- Hover tooltips with documentation
- Snippet support for common patterns

---

## 📝 For Development

### Rebuild Extension

```bash
cd vscode-extension
npm run compile
```

### Repackage

```bash
cd vscode-extension
npx vsce package --no-dependencies
```

### Debug in VS Code

1. Open `vscode-extension` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Test extension in the new window

---

## 🎯 For Your Friday Presentation

### Show Extension Installation (Optional, 2 min)

```bash
# In terminal during demo
code --install-extension vscode-extension/pipeline-assistant-vscode-1.0.0.vsix

# Then open VS Code and show:
# 1. Extension is listed in Extensions view
# 2. Commands work in Command Palette
# 3. Right-click context menu on YAML file
# 4. Live analysis of a bad pipeline file
```

### Demo Script

```
"Y finalmente, tenemos una extensión de VS Code que integra
todo esto directamente en tu editor.

[Show Command Palette]
Genera pipelines desde el Command Palette...

[Show YAML file with errors]
Detecta problemas en tiempo real mientras escribes...

[Show context menu]
Y tiene integración con menú contextual para análisis rápido.

Todo sin salir de VS Code."
```

---

## 📦 Distribution

### For Internal Use

Share the VSIX file:
```bash
# Copy to shared location
cp vscode-extension/pipeline-assistant-vscode-1.0.0.vsix /path/to/shared/folder/
```

Team members install with:
```bash
code --install-extension pipeline-assistant-vscode-1.0.0.vsix
```

### For VS Code Marketplace (Future)

1. Create publisher account: https://marketplace.visualstudio.com/manage
2. Generate Personal Access Token
3. Publish:
```bash
npx vsce publish
```

---

## ✅ Status

- ✅ Extension compiled
- ✅ Extension packaged (74 KB)
- ✅ Ready for installation
- ✅ Ready for demo
- ✅ Ready for distribution

**The VS Code extension is production-ready! 🚀**
