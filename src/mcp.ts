import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

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
    
    const timeoutMs = 10000; // 10 second timeout
    
    try {
      // Create StreamableHTTP transport for FastMCP server
      const transport = new StreamableHTTPClientTransport(new URL(url));
      
      // Create MCP client
      this.client = new Client({
        name: 'ursa-coder-extension',
        version: '1.0.0'
      }, {
        capabilities: {}
      });
      
      // Connect with timeout
      const connectPromise = this.client.connect(transport);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10s')), timeoutMs)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      console.log(`[McpBridge] ✅ Connected to MCP server`);
      
      // Wait a moment for server to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // List available tools with timeout
      const listToolsPromise = this.client.listTools();
      const listTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('listTools timeout after 10s')), timeoutMs)
      );
      
      const toolsResponse = await Promise.race([listToolsPromise, listTimeoutPromise]);
      
      this.availableTools = toolsResponse.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema as any
      }));
      
      console.log(`[McpBridge] Found ${this.availableTools.length} tools:`, this.availableTools.map(t => t.name));
      
      if (this.availableTools.length === 0) {
        console.warn(`[McpBridge] ⚠️ No tools found from URSA server`);
      }
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