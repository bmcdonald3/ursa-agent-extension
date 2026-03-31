import { LLMClient } from './llmClient';
import { McpBridge, ToolDefinition } from './mcp';

// Tool access control lists
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

  constructor(
    private llmClient: LLMClient,
    private mcpBridge: McpBridge,
    private modelId: string
  ) {}

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
    
    // Send status update
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
    // Add mode-specific system prompt
    const systemPrompt = mode === 'plan'
      ? "You are in PLAN MODE. You can only propose plans, search for information, and read data. Do NOT attempt to execute code or modify files. Use tools like 'plan' and 'arxiv_search' only."
      : `You are a VS Code Automation Agent with access to tools for executing commands and modifying files.

CRITICAL TOOL USAGE RULES:
1. When using a tool, output ONLY the JSON object - nothing else.
2. Do NOT wrap the JSON in markdown code blocks.
3. Do NOT add conversational text before or after the JSON.
4. The JSON must have this exact format: {"name": "tool_name", "arguments": {...}}

Example correct tool call:
{"name": "execute", "arguments": {"command": "ls -la"}}

Example WRONG (do not do this):
Sure, I'll run that command:
\`\`\`json
{"name": "execute", "arguments": {"command": "ls -la"}}
\`\`\`

After the tool executes, you will receive the result and can then respond conversationally.`;

    // Get available tools from MCP bridge
    const availableTools = await this.mcpBridge.listTools();
    
    // Convert MCP tools to OpenAI format with complete parameter schemas
    const tools = availableTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));

    // Debug logging to verify tools are correctly formatted
    if (tools.length > 0) {
      console.log(`[Orchestrator] Sending ${tools.length} tools to LLM:`, JSON.stringify(tools, null, 2));
    }

    // Initial LLM call with tools
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

    // Check if the response contains tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      // In Act mode, request approval for tool execution
      if (mode === 'act' && this.toolApprovalCallback) {
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          
          // Store pending tool call
          this.pendingToolCalls.set(toolCall.id, { name: toolName, args });
          
          // Request approval from UI
          const approved = await this.toolApprovalCallback({
            toolName,
            toolArgs: args,
            toolCallId: toolCall.id
          });
          
          if (!approved) {
            this.pendingToolCalls.delete(toolCall.id);
            return `Tool execution cancelled by user.`;
          }
        }
        
        // Return a special marker that approval is needed
        return '__APPROVAL_REQUESTED__';
      }
      
      // Auto-execute in Plan mode (for safe tools only)
      const toolResults: Array<{ role: string; content: string; tool_call_id?: string; name?: string }> = [];

      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.function.name;
        
        // Filter tools based on mode
        if (mode === 'plan' && BLOCKED_TOOLS_IN_PLAN.includes(toolName)) {
          console.warn(`Tool '${toolName}' blocked in Plan mode`);
          
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: 'ERROR: This tool is blocked in Plan Mode. Please provide a theoretical plan or use research tools instead.'
          });
          continue;
        }

        // Only call allowed tools
        if (mode === 'plan' && PLAN_MODE_ALLOWED_TOOLS.includes(toolName)) {
          // Send status update to UI
          if (this.toolStatusCallback) {
            this.toolStatusCallback(`[URSA] Executing ${toolName}...`);
          }

          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await this.mcpBridge.callTool(toolName, args);
            
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(result)
            });
          } catch (error) {
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: `ERROR: ${error instanceof Error ? error.message : String(error)}`
            });
          }
        }
      }

      // If we executed any tools, send results back to LLM for final summary
      if (toolResults.length > 0) {
        messages.push({
          role: 'assistant',
          content: response.content || ''
        });
        
        // Add tool results
        messages = messages.concat(toolResults as any);

        // Get final summary from LLM
        const finalResponse = await this.llmClient.complete({
          messages,
          model: this.modelId
        });

        return finalResponse.content;
      }
    }

    // Text-to-Tool Parsing: Check if response contains JSON tool call in plain text
    if (mode === 'act' && response.content && this.toolApprovalCallback) {
      // Try to extract JSON that looks like a tool call
      const jsonMatch = response.content.match(/\{[\s\S]*?"name"[\s\S]*?"arguments"[\s\S]*?\}/);
      
      if (jsonMatch) {
        try {
          const toolCallJson = JSON.parse(jsonMatch[0]);
          
          if (toolCallJson.name && toolCallJson.arguments) {
            console.log(`[Orchestrator] Detected JSON tool call in text response:`, toolCallJson);
            
            // Generate a unique ID for this tool call
            const toolCallId = `text-tool-${Date.now()}`;
            
            // Store pending tool call
            this.pendingToolCalls.set(toolCallId, { 
              name: toolCallJson.name, 
              args: toolCallJson.arguments 
            });
            
            // Request approval from UI
            const approved = await this.toolApprovalCallback({
              toolName: toolCallJson.name,
              toolArgs: toolCallJson.arguments,
              toolCallId: toolCallId
            });
            
            if (!approved) {
              this.pendingToolCalls.delete(toolCallId);
              return `Tool execution cancelled by user.`;
            }
            
            // Return approval marker
            return '__APPROVAL_REQUESTED__';
          }
        } catch (e) {
          console.warn(`[Orchestrator] Failed to parse JSON from text response:`, e);
        }
      }
      
      // Fallback: Detect markdown code blocks
      const codeBlockMatch = response.content.match(/```(?:bash|sh|shell)?\n([\s\S]+?)\n```/);
      if (codeBlockMatch) {
        const command = codeBlockMatch[1].trim();
        console.warn(`[Orchestrator] Model provided code block instead of tool call: ${command}`);
        return `⚠️ I noticed you provided a command in a code block:\n\`\`\`\n${command}\n\`\`\`\n\nShould I execute this via URSA? (This is a fallback for models that don't use tool calls properly)`;
      }
    }

    // Return the final answer
    return response.content;
  }
}
