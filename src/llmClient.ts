import OpenAI from 'openai';

export class LLMClient {
  private client: OpenAI;
  private config: {
    baseURL: string;
    defaultHeaders: Record<string, string>;
  };

  constructor(apiKey: string, apiUrl: string, customHeaders?: Record<string, string>) {
    this.config = {
      baseURL: apiUrl,
      defaultHeaders: customHeaders || {}
    };

    this.client = new OpenAI({
      apiKey: apiKey || 'not-needed', // Some local providers don't require API key
      baseURL: this.config.baseURL,
      defaultHeaders: this.config.defaultHeaders
    });
  }

  getConfig() {
    return this.config;
  }

  async complete(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
  }): Promise<{ content: string; toolCalls: any[] }> {
    const response = await this.client.chat.completions.create({
      model: params.model || 'default-model',
      messages: params.messages as any[]
    });

    const message = response.choices[0]?.message;
    return {
      content: message?.content || '',
      toolCalls: (message as any)?.tool_calls || []
    };
  }

  /**
   * Test connection to the LLM API
   * Returns latency in milliseconds or throws error
   */
  async testConnection(): Promise<number> {
    const start = Date.now();
    await this.complete({
      messages: [{ role: 'user', content: 'Respond with OK' }],
      model: 'test'
    });
    return Date.now() - start;
  }
}