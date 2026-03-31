import { LLMClient } from './llmClient';
import { McpBridge } from './mcp';

// Tool access control lists
const PLAN_MODE_ALLOWED_TOOLS = ['plan', 'arxiv_search', 'search', 'read', 'list'];
const BLOCKED_TOOLS_IN_PLAN = ['execute', 'write', 'delete', 'modify', 'run'];

export class Orchestrator {
  private toolStatusCallback?: (status: string) => void;

  constructor(
    private llmClient: LLMClient,
    private mcpBridge: McpBridge,
    private modelId: string
  ) {}

  setToolStatusCallback(callback: (status: string) => void) {
    this.toolStatusCallback = callback;
  }

  async processPrompt(prompt: string, mode: 'plan' | 'act' = 'plan'): Promise<string> {
    // Add mode-specific system prompt
    const systemPrompt = mode === 'plan'
      ? "You are in PLAN MODE. You can only propose plans, search for information, and read data. Do NOT attempt to execute code or modify files. Use tools like 'plan' and 'arxiv_search' only."
      : `You are an autonomous agent with direct access to the user's computer via tools.
CRITICAL: If a user asks you to create a file, run a command, or search for information, you MUST use the provided tools (like 'write_to_file' or 'execute') immediately.
DO NOT give the user instructions on how to do it themselves. DO NOT just provide code blocks in chat.
Your goal is to perform the action, not describe it.`;

    // Get available tools from MCP bridge
    const availableTools = await this.mcpBridge.listTools();
    
    // Convert MCP tools to OpenAI format
    const tools = availableTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));

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
        if (mode === 'act' || PLAN_MODE_ALLOWED_TOOLS.includes(toolName)) {
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

    // Return the final answer
    return response.content;
  }
}
