import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

// Export the type used by the Orchestrator
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: any;
}

export class McpBridge {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  public availableTools: ToolDefinition[] = [];

  async connect(url: string) {
    try {
      this.transport = new StreamableHTTPClientTransport(new URL(url));
      this.client = new Client(
        { name: "ursa-coder-extension", version: "0.0.1" },
        { capabilities: {} }
      );

      await this.client.connect(this.transport);
      await this.listTools();
      console.log(`[McpBridge] ✅ Connected. Found ${this.availableTools.length} tools`);
    } catch (error) {
      console.error("[McpBridge] Connection failed:", error);
      throw error;
    }
  }

  // Restore listTools method
  async listTools(): Promise<ToolDefinition[]> {
    if (!this.client) {
      return this.availableTools;
    }
    const response = (await this.client.listTools()) as { tools: ToolDefinition[] };
    this.availableTools = response.tools || [];
    return this.availableTools;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }

  async callTool(name: string, args: any, options?: { timeout?: number }) {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      // Return type matches CallToolResultSchema
      return await this.client.callTool(
        {
          name,
          arguments: args,
        },
        CallToolResultSchema,
        options
      );
    } catch (error) {
      console.error(`[McpBridge] Error calling tool ${name}:`, error);
      throw error;
    }
  }
}