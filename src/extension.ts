import * as vscode from 'vscode';
import { OpenRouterClient } from './openrouter';
import { McpBridge } from './mcp';
import { Orchestrator } from './orchestrator';
import { ChatViewProvider } from './chatViewProvider';

export function activate(context: vscode.ExtensionContext) {
  // Get API key from settings
  const config = vscode.workspace.getConfiguration('ursaCoder');
  const apiKey = config.get<string>('apiKey') || 'test_api_key';
  
  // Initialize components
  const openRouterClient = new OpenRouterClient(apiKey);
  const mcpBridge = new McpBridge();
  const orchestrator = new Orchestrator(openRouterClient, mcpBridge);
  
  // Create and register ChatViewProvider
  const chatProvider = new ChatViewProvider(context.extensionUri, orchestrator);
  
  // Store provider globally for testing
  (global as any).chatProvider = chatProvider;
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatProvider
    )
  );
  
  // Register command
  const disposable = vscode.commands.registerCommand('ursa-coder.start', () => {
    vscode.window.showInformationMessage('URSA Coder activated!');
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}