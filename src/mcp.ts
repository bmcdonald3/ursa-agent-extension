import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export class McpBridge {
  private client: Client | null = null;
  private ursaUrl: string | null = null;
  private availableTools: ToolDefinition[] = [];

  async connect(url: string): Promise<void> {
    console.log(`[McpBridge] Connecting to URSA MCP server at: ${url}`);
    this.ursaUrl = url;
    
    try {
      // Create SSE transport for URSA server
      const transport = new SSEClientTransport(new URL(url));
      
      // Create and connect MCP client
      this.client = new Client({
        name: 'ursa-coder-extension',
        version: '1.0.0'
      }, {
        capabilities: {}
      });
      
      await this.client.connect(transport);
      console.log(`[McpBridge] ✅ Connected to MCP server via SSE`);
      
      // List available tools
      const toolsResponse = await this.client.listTools();
      this.availableTools = toolsResponse.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema as any
      }));
      
      console.log(`[McpBridge] Found ${this.availableTools.length} tools:`, this.availableTools.map(t => t.name));
    } catch (error) {
      console.error(`[McpBridge] ❌ Connection failed:`, error);
      throw error;
    }
  }

  async listTools(): Promise<ToolDefinition[]> {
    console.log(`[McpBridge] Listing ${this.availableTools.length} available tools`);
    return this.availableTools;
  }

  async callTool(name: string, args: Record<string, any>): Promise<{ result: string }> {
    if (!this.client) {
      throw new Error('McpBridge not connected to URSA server');
    }

    console.log(`[McpBridge] Calling tool: ${name}`);
    console.log(`[McpBridge] Tool arguments:`, JSON.stringify(args, null, 2));
    
    console.log(`[McpBridge] 🚀 Executing tool via MCP SDK`);
    
    try {
      const result = await this.client.callTool({
        name,
        arguments: args
      });
      
      console.log(`[McpBridge] ✅ Tool result:`, result);
      
      // Extract content from MCP response
      const content = (result as any).content?.[0];
      const resultText = content?.type === 'text' ? content.text : JSON.stringify(result);
      
      return { result: resultText };
    } catch (error) {
      console.error(`[McpBridge] ❌ Tool execution error:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      console.log(`[McpBridge] Disconnected from URSA server`);
    }
  }
}