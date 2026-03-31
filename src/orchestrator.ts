import { LLMClient } from './llmClient';
import { McpBridge } from './mcp';

// Tool access control lists
const PLAN_MODE_ALLOWED_TOOLS = ['plan', 'arxiv_search', 'search', 'read', 'list'];
const BLOCKED_TOOLS_IN_PLAN = ['execute', 'write', 'delete', 'modify', 'run'];

export class Orchestrator {
  constructor(
    private llmClient: LLMClient,
    private mcpBridge: McpBridge,
    private modelId: string
  ) {}

  async processPrompt(prompt: string, mode: 'plan' | 'act' = 'plan'): Promise<string> {
    // Add mode-specific system prompt
    const modePrefix = mode === 'plan'
      ? "You are in PLAN MODE. You can only propose plans, search for information, and read data. Do NOT attempt to execute code or modify files. Use tools like 'plan' and 'arxiv_search' only."
      : "You are in ACT MODE. You have full access to execute code and modify files.";

    // Call the LLM with the mode-aware prompt
    const response = await this.llmClient.complete({
      messages: [
        { role: 'system', content: modePrefix },
        { role: 'user', content: prompt }
      ],
      model: this.modelId
    });

    // Check if the response contains tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        // Filter tools based on mode
        if (mode === 'plan' && BLOCKED_TOOLS_IN_PLAN.includes(toolCall.name)) {
          // Tool is blocked in Plan mode
          console.warn(`Tool '${toolCall.name}' blocked in Plan mode`);
          
          // Return system message to LLM (could be used for retry logic)
          const blockMessage = `This tool is blocked in Plan Mode. Please provide a theoretical plan or use research tools instead.`;
          
          // In a real implementation, we might want to send this back to the LLM
          // For now, we'll skip this tool call and continue
          continue;
        }

        // Only call allowed tools
        if (mode === 'act' || PLAN_MODE_ALLOWED_TOOLS.includes(toolCall.name)) {
          await this.mcpBridge.callTool(toolCall.name, toolCall.arguments);
        }
      }
    }

    // Return the final answer
    return response.content;
  }
}