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
    
    const toolsUrl = `${url}/tools`;
    console.log(`[McpBridge] Fetching tools from: ${toolsUrl}`);
    
    try {
      // Fetch available tools from URSA server
      const response = await fetch(toolsUrl);
      if (!response.ok) {
        console.error(`[McpBridge] ❌ Failed to fetch tools from ${toolsUrl}`);
        console.error(`[McpBridge] Status: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch tools from ${toolsUrl}: ${response.status} ${response.statusText}`);
      }
      
      const data = (await response.json()) as { tools?: ToolDefinition[] };
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
    
    const callUrl = `${this.ursaUrl}/call`;
    
    console.log(`[McpBridge] 🚀 SENDING REQUEST TO URSA SERVER`);
    console.log(`[McpBridge] URL: ${callUrl}`);
    console.log(`[McpBridge] Method: POST`);
    console.log(`[McpBridge] Payload:`, JSON.stringify(payload, null, 2));
    
    try {
      const response = await fetch(callUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`[McpBridge] ❌ Tool execution failed`);
        console.error(`[McpBridge] URL: ${callUrl}`);
        console.error(`[McpBridge] Status: ${response.status} ${response.statusText}`);
        throw new Error(`Tool execution failed at ${callUrl}: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as { result: string };
      console.log(`[McpBridge] Tool result:`, result);
      
      return result;
    } catch (error) {
      console.error(`[McpBridge] Tool execution error:`, error);
      throw error;
    }
  }
}
