import * as vscode from 'vscode';
import { LLMClient } from './llmClient';
import { McpBridge } from './mcp';
import { Orchestrator } from './orchestrator';
import { ChatViewProvider } from './chatViewProvider';
import { PROVIDER_PRESETS, detectProvider } from './providerPresets';

export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('ursaCoder');
  const provider = config.get<string>('provider') || 'openrouter';
  const apiKey = config.get<string>('apiKey') || '';
  const apiUrl = config.get<string>('apiUrl') || 'https://openrouter.ai/api/v1';
  const modelId = config.get<string>('modelId') || 'anthropic/claude-3.5-sonnet';
  const mcpServerUrl = config.get<string>('mcpServerUrl') || 'http://localhost:8000/mcp';
  
  const detectedProvider = detectProvider(apiUrl);
  const preset = PROVIDER_PRESETS[detectedProvider];
  const headers = preset?.headers;
  
  const llmClient = new LLMClient(apiKey, apiUrl, headers);
  const mcpBridge = new McpBridge();
  const orchestrator = new Orchestrator(llmClient, mcpBridge, modelId);

  mcpBridge.connect(mcpServerUrl).then(async () => {
    console.log('[Extension] Connected to MCP');
    
    // Auto-indexing logic
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const rootPath = workspaceFolders[0].uri.fsPath;
      try {
        console.log(`[Extension] Starting auto-index for: ${rootPath}`);
        // Calling the tool directly through the bridge
        await mcpBridge.callTool('index_project', { root_path: rootPath });
        vscode.window.showInformationMessage('URSA Coder: Codebase indexed successfully.');
      } catch (err) {
        console.error('[Extension] Auto-index failed:', err);
      }
    }
  }).catch(err => {
    console.error('[Extension] Auto-connect to MCP failed:', err);
  });
  
  const chatProvider = new ChatViewProvider(
    context.extensionUri,
    orchestrator,
    modelId,
    detectedProvider
  );
  
  (global as any).chatProvider = chatProvider;
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatProvider
    )
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('ursa-coder.start', () => {
      vscode.window.showInformationMessage('URSA Coder activated!');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ursa-coder.forceTest', async () => {
      vscode.window.showInformationMessage('🚀 Force testing direct MCP connection...');
      try {
        await mcpBridge.connect(mcpServerUrl);
        const result = await mcpBridge.callTool('write_to_file', {
          path: './ursa-test-direct.txt',
          content: 'Forced from VS Code command palette'
        });
        vscode.window.showInformationMessage(`✅ Force Test Successful! Result: ${JSON.stringify(result)}`);
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Force Test Failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ursa-coder.testConnection', async () => {
      const testResults: any = { llm: { status: 'testing', latency: 0 }, mcp: { status: 'testing', tools: [] } };

      try {
        const latency = await llmClient.testConnection(modelId);
        testResults.llm = { status: 'connected', latency };
        vscode.window.showInformationMessage(`✅ LLM Connected (${latency}ms)`);
      } catch (error) {
        testResults.llm = { status: 'failed', error: String(error) };
      }

      try {
        await mcpBridge.connect(mcpServerUrl);
        const tools = await mcpBridge.listTools();
        testResults.mcp = { status: 'connected', tools };
        vscode.window.showInformationMessage(`✅ MCP Connected - ${tools.length} tools available`);
      } catch (error) {
        testResults.mcp = { status: 'failed', error: String(error) };
      }

      chatProvider.updateConnectionStatus(testResults);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ursa-coder.switchProvider', async () => {
      const items = [
        { label: '$(rocket) Switch to Ollama (Local)', preset: 'ollama' },
        { label: '$(cloud) Switch to Groq', preset: 'groq' },
        { label: '$(globe) Switch to OpenRouter', preset: 'openrouter' },
        { label: '$(gear) Open Settings', preset: 'settings' },
        { label: '$(plug) Test Connection', preset: 'test' }
      ];

      const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select an action' });
      if (!selected) return;

      if (selected.preset === 'settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'ursaCoder');
        return;
      }
      if (selected.preset === 'test') {
        vscode.commands.executeCommand('ursa-coder.testConnection');
        return;
      }

      const preset = PROVIDER_PRESETS[selected.preset];
      if (!preset) return;

      const modelItems = preset.models.map(model => ({ label: model }));
      const selectedModel = await vscode.window.showQuickPick(modelItems, { placeHolder: `Select a model` });
      if (!selectedModel) return;

      await config.update('provider', selected.preset, vscode.ConfigurationTarget.Global);
      await config.update('apiUrl', preset.apiUrl, vscode.ConfigurationTarget.Global);
      await config.update('modelId', selectedModel.label, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(`Switched to ${preset.name} / ${selectedModel.label}. Please reload the window.`);
    })
  );
}

export function deactivate() {}