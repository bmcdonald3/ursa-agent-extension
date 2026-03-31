import * as vscode from 'vscode';
import { LLMClient } from './llmClient';
import { McpBridge } from './mcp';
import { Orchestrator } from './orchestrator';
import { ChatViewProvider } from './chatViewProvider';
import { PROVIDER_PRESETS, detectProvider } from './providerPresets';

export function activate(context: vscode.ExtensionContext) {
  // Get configuration
  const config = vscode.workspace.getConfiguration('ursaCoder');
  const provider = config.get<string>('provider') || 'openrouter';
  const apiKey = config.get<string>('apiKey') || '';
  const apiUrl = config.get<string>('apiUrl') || 'https://openrouter.ai/api/v1';
  const modelId = config.get<string>('modelId') || 'anthropic/claude-3.5-sonnet';
  const mcpServerUrl = config.get<string>('mcpServerUrl') || 'http://localhost:8000/mcp';
  
  // Detect provider and get preset headers
  const detectedProvider = detectProvider(apiUrl);
  const preset = PROVIDER_PRESETS[detectedProvider];
  const headers = preset?.headers;
  
  // Initialize components
  const llmClient = new LLMClient(apiKey, apiUrl, headers);
  const mcpBridge = new McpBridge();
  const orchestrator = new Orchestrator(llmClient, mcpBridge, modelId);
  
  // Create and register ChatViewProvider
  const chatProvider = new ChatViewProvider(
    context.extensionUri,
    orchestrator,
    modelId,
    detectedProvider
  );
  
  // Store provider globally for testing
  (global as any).chatProvider = chatProvider;
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatProvider
    )
  );
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('ursa-coder.start', () => {
      vscode.window.showInformationMessage('URSA Coder activated!');
    })
  );

  // Register test connection command
  context.subscriptions.push(
    vscode.commands.registerCommand('ursa-coder.testConnection', async () => {
      const testResults: any = {
        llm: { status: 'testing', latency: 0 },
        mcp: { status: 'testing', tools: [] }
      };

      // Test LLM
      try {
        const latency = await llmClient.testConnection();
        testResults.llm = { status: 'connected', latency };
        vscode.window.showInformationMessage(
          `✅ LLM Connected (${latency}ms) - ${detectedProvider} / ${modelId}`
        );
      } catch (error) {
        testResults.llm = { 
          status: 'failed', 
          error: error instanceof Error ? error.message : String(error) 
        };
        vscode.window.showErrorMessage(
          `❌ LLM Connection Failed: ${testResults.llm.error}`
        );
      }

      // Test MCP
      try {
        await mcpBridge.connect(mcpServerUrl);
        const tools = await mcpBridge.listTools();
        testResults.mcp = { status: 'connected', tools };
        vscode.window.showInformationMessage(
          `✅ MCP Connected - ${tools.length} tools available`
        );
      } catch (error) {
        testResults.mcp = { 
          status: 'failed', 
          error: error instanceof Error ? error.message : String(error) 
        };
        vscode.window.showWarningMessage(
          `⚠️ MCP Connection Failed: ${testResults.mcp.error}`
        );
      }

      // Send results to webview
      chatProvider.updateConnectionStatus(testResults);
    })
  );

  // Register switch provider command
  context.subscriptions.push(
    vscode.commands.registerCommand('ursa-coder.switchProvider', async () => {
      const items = [
        {
          label: '$(rocket) Switch to Ollama (Local)',
          description: 'Run models locally on your machine',
          preset: 'ollama'
        },
        {
          label: '$(cloud) Switch to Groq',
          description: 'Fast cloud inference',
          preset: 'groq'
        },
        {
          label: '$(globe) Switch to OpenRouter',
          description: 'Access multiple models via one API',
          preset: 'openrouter'
        },
        {
          label: '$(gear) Open Settings',
          description: 'Configure manually',
          preset: 'settings'
        },
        {
          label: '$(plug) Test Connection',
          description: 'Verify LLM and MCP connectivity',
          preset: 'test'
        }
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select an action'
      });

      if (!selected) {return;}

      if (selected.preset === 'settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'ursaCoder');
        return;
      }

      if (selected.preset === 'test') {
        vscode.commands.executeCommand('ursa-coder.testConnection');
        return;
      }

      const preset = PROVIDER_PRESETS[selected.preset];
      if (!preset) {return;}

      // Show model picker
      const modelItems = preset.models.map(model => ({
        label: model,
        description: `${preset.name} model`
      }));

      const selectedModel = await vscode.window.showQuickPick(modelItems, {
        placeHolder: `Select a model for ${preset.name}`
      });

      if (!selectedModel) {return;}

      // Update settings
      await config.update('provider', selected.preset, vscode.ConfigurationTarget.Global);
      await config.update('apiUrl', preset.apiUrl, vscode.ConfigurationTarget.Global);
      await config.update('modelId', selectedModel.label, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(
        `Switched to ${preset.name} / ${selectedModel.label}. Please reload the window.`
      );
    })
  );
}

export function deactivate() {}