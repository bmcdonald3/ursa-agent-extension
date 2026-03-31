import * as vscode from 'vscode';
import { Orchestrator } from './orchestrator';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ursa-coder.chatView';
  private _view?: vscode.WebviewView;
  private _currentMode: 'plan' | 'act' = 'plan'; // Default to safe Plan mode

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _orchestrator: Orchestrator,
    private readonly _modelId: string,
    private readonly _provider: string
  ) {
    // Set up tool status callback
    this._orchestrator.setToolStatusCallback((status: string) => {
      this._view?.webview.postMessage({
        type: 'toolStatus',
        message: status
      });
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      await this._onDidReceiveMessage(data);
    });
  }

  public updateConnectionStatus(results: any) {
    this._view?.webview.postMessage({
      type: 'connectionStatus',
      results
    });
  }

  private async _onDidReceiveMessage(message: any) {
    switch (message.command) {
      case 'switchMode':
        this._currentMode = message.mode;
        this._view?.webview.postMessage({
          type: 'modeChanged',
          mode: this._currentMode
        });
        break;

      case 'clickModel':
        // Trigger the switch provider command
        vscode.commands.executeCommand('ursa-coder.switchProvider');
        break;

      case 'testConnection':
        // Trigger test connection command
        vscode.commands.executeCommand('ursa-coder.testConnection');
        break;

      case 'sendPrompt':
        try {
          // Show thinking indicator
          this._view?.webview.postMessage({
            type: 'thinking',
            message: 'URSA is thinking...'
          });

          // Call orchestrator with current mode
          const response = await this._orchestrator.processPrompt(
            message.text,
            this._currentMode
          );

          // Send response back to webview
          this._view?.webview.postMessage({
            type: 'aiResponse',
            content: response
          });
        } catch (error) {
          this._view?.webview.postMessage({
            type: 'error',
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
          });
        }
        break;
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const modelName = this._modelId;
    const providerName = this._provider.charAt(0).toUpperCase() + this._provider.slice(1);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URSA Coder</title>
  <style>
    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }

    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background-color: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-widget-border);
      font-size: 11px;
    }

    .model-info {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .model-info:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .connection-status {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .status-icon {
      font-size: 8px;
      color: var(--vscode-descriptionForeground);
    }

    .status-icon.connected {
      color: var(--vscode-terminal-ansiGreen);
    }

    .status-icon.failed {
      color: var(--vscode-terminal-ansiRed);
    }

    .status-icon.testing {
      color: var(--vscode-terminal-ansiYellow);
    }

    .test-btn {
      margin: 4px 8px;
      padding: 4px 8px;
      font-size: 11px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border);
      border-radius: 4px;
      cursor: pointer;
    }

    .test-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .mode-switcher {
      display: flex;
      padding: 8px;
      gap: 4px;
      background-color: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .mode-btn {
      flex: 1;
      padding: 6px 12px;
      border: 1px solid var(--vscode-button-border);
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      border-radius: 4px;
      font-size: 12px;
      transition: background-color 0.2s;
    }

    .mode-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .mode-btn.active {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-weight: bold;
    }

    .mode-btn.active.act-mode {
      background-color: var(--vscode-statusBarItem-warningBackground);
      color: var(--vscode-statusBarItem-warningForeground);
    }

    .chat-container {
      height: calc(100vh - 180px);
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      padding: 10px 12px;
      border-radius: 8px;
      max-width: 85%;
      word-wrap: break-word;
    }

    .message.user {
      align-self: flex-end;
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
    }

    .message.ai {
      align-self: flex-start;
      background-color: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-widget-border);
    }

    .message.thinking {
      align-self: flex-start;
      background-color: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-widget-border);
      font-style: italic;
      opacity: 0.8;
    }

    .message.error {
      align-self: flex-start;
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-errorForeground);
    }

    .input-area {
      padding: 8px;
      background-color: var(--vscode-editor-background);
      border-top: 1px solid var(--vscode-widget-border);
      display: flex;
      gap: 8px;
    }

    #promptInput {
      flex: 1;
      padding: 8px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }

    #promptInput:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    #sendBtn {
      padding: 8px 16px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    #sendBtn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    #sendBtn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <div class="status-bar">
    <div class="model-info" id="modelIndicator" title="Click to switch provider/model">
      🤖 <span id="modelName">${modelName}</span> (<span id="providerName">${providerName}</span>)
    </div>
    <div class="connection-status">
      <span class="status-icon" id="llmStatus" title="LLM API">●</span>
      <span class="status-icon" id="mcpStatus" title="URSA MCP">●</span>
    </div>
  </div>
  <button id="testConnectionBtn" class="test-btn">🔌 Test Connection</button>
  
  <div class="mode-switcher">
    <button class="mode-btn active" data-mode="plan" id="planBtn">📋 Plan</button>
    <button class="mode-btn" data-mode="act" id="actBtn">⚡ Act</button>
  </div>
  
  <div class="chat-container" id="chatContainer"></div>
  
  <div class="input-area">
    <input type="text" id="promptInput" placeholder="Ask URSA anything..." />
    <button id="sendBtn">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentMode = 'plan';

    // Model indicator click handler
    document.getElementById('modelIndicator').addEventListener('click', () => {
      vscode.postMessage({ command: 'clickModel' });
    });

    // Test connection button
    document.getElementById('testConnectionBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'testConnection' });
    });

    // Mode switcher
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        currentMode = mode;
        
        // Update UI
        document.querySelectorAll('.mode-btn').forEach(b => {
          b.classList.remove('active', 'act-mode');
        });
        btn.classList.add('active');
        if (mode === 'act') {
          btn.classList.add('act-mode');
        }
        
        // Notify extension
        vscode.postMessage({
          command: 'switchMode',
          mode: mode
        });
      });
    });

    // Send button
    const sendBtn = document.getElementById('sendBtn');
    const promptInput = document.getElementById('promptInput');
    const chatContainer = document.getElementById('chatContainer');

    function addMessage(content, type) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message ' + type;
      messageDiv.textContent = content;
      chatContainer.appendChild(messageDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;
      return messageDiv;
    }

    function sendPrompt() {
      const text = promptInput.value.trim();
      if (!text) return;

      // Add user message
      addMessage(text, 'user');
      
      // Clear input
      promptInput.value = '';
      
      // Send to extension
      vscode.postMessage({
        command: 'sendPrompt',
        text: text
      });
      
      // Disable send button while processing
      sendBtn.disabled = true;
    }

    sendBtn.addEventListener('click', sendPrompt);
    promptInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendPrompt();
      }
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'modeChanged':
          console.log('Mode changed to:', message.mode);
          break;
          
        case 'thinking':
          addMessage(message.message, 'thinking');
          break;
          
        case 'aiResponse':
          // Remove thinking message
          const thinkingMsg = chatContainer.querySelector('.message.thinking');
          if (thinkingMsg) {
            thinkingMsg.remove();
          }
          
          addMessage(message.content, 'ai');
          sendBtn.disabled = false;
          break;
          
        case 'error':
          addMessage(message.message, 'error');
          sendBtn.disabled = false;
          break;

        case 'toolStatus':
          // Show tool execution status
          addMessage(message.message, 'thinking');
          break;

        case 'connectionStatus':
          // Update connection status indicators
          const llmStatus = document.getElementById('llmStatus');
          const mcpStatus = document.getElementById('mcpStatus');
          
          if (message.results.llm.status === 'connected') {
            llmStatus.classList.add('connected');
            llmStatus.classList.remove('failed', 'testing');
          } else if (message.results.llm.status === 'failed') {
            llmStatus.classList.add('failed');
            llmStatus.classList.remove('connected', 'testing');
          } else {
            llmStatus.classList.add('testing');
            llmStatus.classList.remove('connected', 'failed');
          }

          if (message.results.mcp.status === 'connected') {
            mcpStatus.classList.add('connected');
            mcpStatus.classList.remove('failed', 'testing');
          } else if (message.results.mcp.status === 'failed') {
            mcpStatus.classList.add('failed');
            mcpStatus.classList.remove('connected', 'testing');
          } else {
            mcpStatus.classList.add('testing');
            mcpStatus.classList.remove('connected', 'failed');
          }
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}