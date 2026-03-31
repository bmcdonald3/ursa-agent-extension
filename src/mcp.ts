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
  private ursaUrl: string | null = null;
  private availableTools: ToolDefinition[] = [];

  async connect(url: string): Promise<void> {
    console.log(`[McpBridge] Connecting to URSA MCP server at: ${url}`);
    this.ursaUrl = url;
    
    try {
      // Fetch available tools from URSA server
      const response = await fetch(`${url}/tools`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.availableTools = data.tools || [];
      console.log(`[McpBridge] Connected successfully. Found ${this.availableTools.length} tools:`, this.availableTools.map(t => t.name));
    } catch (error) {
      console.error(`[McpBridge] Connection failed:`, error);
      throw error;
    }
  }

  async listTools(): Promise<ToolDefinition[]> {
    console.log(`[McpBridge] Listing ${this.availableTools.length} available tools`);
    return this.availableTools;
  }

  async callTool(name: string, args: Record<string, any>): Promise<{ result: string }> {
    if (!this.ursaUrl) {
      throw new Error('McpBridge not connected to URSA server');
    }

    console.log(`[McpBridge] Calling tool: ${name}`);
    console.log(`[McpBridge] Tool arguments:`, JSON.stringify(args, null, 2));
    
    const payload = {
      tool: name,
      arguments: args
    };
    
    console.log(`[McpBridge] 🚀 SENDING REQUEST TO URSA SERVER`);
    console.log(`[McpBridge] URL: ${this.ursaUrl}/call`);
    console.log(`[McpBridge] Method: POST`);
    console.log(`[McpBridge] Payload:`, JSON.stringify(payload, null, 2));
    
    try {
      const response = await fetch(`${this.ursaUrl}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Tool execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[McpBridge] Tool result:`, result);
      
      return result;
    } catch (error) {
      console.error(`[McpBridge] Tool execution error:`, error);
      throw error;
    }
  }
}
