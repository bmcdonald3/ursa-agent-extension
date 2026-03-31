import { OpenRouterClient } from './openrouter';
import { McpBridge } from './mcp';

export class Orchestrator {
  constructor(
    private openRouterClient: OpenRouterClient,
    private mcpBridge: McpBridge
  ) {}

  async processPrompt(prompt: string): Promise<string> {
    // Call the LLM with the user's prompt
    const response = await this.openRouterClient.complete({
      messages: [{ role: 'user', content: prompt }]
    });

    // Check if the response contains tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      // If there are tool calls, we would execute them via MCP
      // For now, this is a stub - the test expects us to NOT call tools
      // when there are no tool calls in the response
      for (const toolCall of response.toolCalls) {
        await this.mcpBridge.callTool(toolCall.name, toolCall.arguments);
      }
    }

    // Return the final answer
    return response.content;
  }
}