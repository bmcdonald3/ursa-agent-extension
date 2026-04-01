import { LLMClient } from './llmClient';
import { McpBridge, ToolDefinition } from './mcp';

const PLAN_MODE_ALLOWED_TOOLS = ['plan', 'arxiv_search', 'search', 'read', 'list', 'read_file', 'list_files'];
const BLOCKED_TOOLS_IN_PLAN = ['execute', 'write', 'delete', 'modify', 'run', 'write_to_file'];

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
    console.log(`[Orchestrator] Autonomous mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
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
      this.toolStatusCallback(`[URSA] Executing ${name}...`);
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
    const systemPrompt = mode === 'plan'
      ? "You are in PLAN MODE. You can only propose plans, search for information, and read data. Do NOT attempt to execute code or modify files."
      : "You are a VS Code Automation Agent. Use native tool calls for execution.";

    const availableTools = await this.mcpBridge.listTools();
    
    // Fixed mapping: Convert MCP tools to OpenAI format with 'type' and 'function'
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
      if (mode === 'act' && this.autonomousMode) {
        const toolResults: any[] = [];
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          try {
            const result = await this.mcpBridge.callTool(toolName, args);
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(result)
            });
          } catch (error) {
            toolResults.push({ role: 'tool', tool_call_id: toolCall.id, name: toolName, content: String(error) });
          }
        }
        messages.push({ role: 'assistant', content: response.content || '' });
        messages = messages.concat(toolResults);
        const finalResponse = await this.llmClient.complete({ messages, model: this.modelId });
        return finalResponse.content;
      }
      
      if (mode === 'act' && this.toolApprovalCallback) {
        for (const toolCall of response.toolCalls) {
          this.pendingToolCalls.set(toolCall.id, { name: toolCall.function.name, args: JSON.parse(toolCall.function.arguments) });
          const approved = await this.toolApprovalCallback({ toolName: toolCall.function.name, toolArgs: JSON.parse(toolCall.function.arguments), toolCallId: toolCall.id });
          if (!approved) return `Tool execution cancelled by user.`;
        }
        return '__APPROVAL_REQUESTED__';
      }
    }

    return response.content;
  }
}