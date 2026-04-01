import { LLMClient } from './llmClient';
import { McpBridge, ToolDefinition } from './mcp';

export interface ToolApprovalRequest {
  toolName: string;
  toolArgs: Record<string, any>;
  toolCallId: string;
}

export class Orchestrator {
  private toolStatusCallback?: (status: string) => void;
  private toolApprovalCallback?: (request: ToolApprovalRequest) => Promise<boolean>;
  private pendingToolCalls: Map<string, any> = new Map();
  private autonomousMode: boolean = false;

  constructor(
    private llmClient: LLMClient,
    private mcpBridge: McpBridge,
    private modelId: string
  ) {}

  setAutonomousMode(enabled: boolean) {
    this.autonomousMode = enabled;
  }

  setToolStatusCallback(callback: (status: string) => void) {
    this.toolStatusCallback = callback;
  }

  setToolApprovalCallback(callback: (request: ToolApprovalRequest) => Promise<boolean>) {
    this.toolApprovalCallback = callback;
  }

  async executeApprovedTool(toolCallId: string): Promise<string> {
    const toolCall = this.pendingToolCalls.get(toolCallId);
    if (!toolCall) {
      throw new Error(`No pending tool call found for ID: ${toolCallId}`);
    }

    const { name, args } = toolCall;
    
    if (this.toolStatusCallback) {
      this.toolStatusCallback(`Executing ${name}...`);
    }

    try {
      const result = await this.mcpBridge.callTool(name, args);
      this.pendingToolCalls.delete(toolCallId);
      return JSON.stringify(result);
    } catch (error) {
      this.pendingToolCalls.delete(toolCallId);
      throw error;
    }
  }

  async processPrompt(prompt: string, mode: 'plan' | 'act' = 'plan'): Promise<string> {
    const systemPrompt = `You are a VS Code Automation Agent.
CRITICAL INSTRUCTION: You must use tools to accomplish tasks. 
If you cannot use native tool calls, output EXACTLY this JSON format and nothing else:
{"name": "tool_name", "arguments": {"param1": "value1"}}`;

    const availableTools = await this.mcpBridge.listTools();
    const tools = availableTools.map((tool: ToolDefinition) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.inputSchema
      }
    }));

    let messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmClient.complete({
      messages,
      model: this.modelId,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined
    });

    if (response.toolCalls && response.toolCalls.length > 0) {
      if (mode === 'act' && this.toolApprovalCallback) {
        for (const toolCall of response.toolCalls) {
          const args = JSON.parse(toolCall.function.arguments);
          this.pendingToolCalls.set(toolCall.id, { name: toolCall.function.name, args });
          const approved = await this.toolApprovalCallback({ toolName: toolCall.function.name, toolArgs: args, toolCallId: toolCall.id });
          if (!approved) return `Tool execution cancelled.`;
        }
        return '__APPROVAL_REQUESTED__';
      }
    }

    // BUG 2 FIX: Robust JSON Extraction
    if (response.content && this.toolApprovalCallback) {
      const firstBrace = response.content.indexOf('{');
      const lastBrace = response.content.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = response.content.substring(firstBrace, lastBrace + 1);
        
        if (mode === 'plan') {
          return `I have formulated a plan to use a tool. Please switch to ACT mode to execute it.\n\nProposed Tool Call:\n${jsonStr}`;
        }

        try {
          const toolCallJson = JSON.parse(jsonStr);
          if (toolCallJson.name && toolCallJson.arguments) {
            const toolCallId = `text-tool-${Date.now()}`;
            this.pendingToolCalls.set(toolCallId, { name: toolCallJson.name, args: toolCallJson.arguments });
            
            const approved = await this.toolApprovalCallback({
              toolName: toolCallJson.name,
              toolArgs: toolCallJson.arguments,
              toolCallId: toolCallId
            });
            
            if (!approved) return `Tool execution cancelled.`;
            return '__APPROVAL_REQUESTED__';
          }
        } catch (e) {
          console.warn(`Failed to parse JSON from text:`, e);
        }
      }
    }

    return response.content;
  }
}