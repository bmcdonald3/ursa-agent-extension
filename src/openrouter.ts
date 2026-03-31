import OpenAI from 'openai';

export class OpenRouterClient {
  private client: OpenAI;
  private config: {
    baseURL: string;
    defaultHeaders: Record<string, string>;
  };

  constructor(apiKey: string) {
    this.config = {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/ursa-coder',
        'X-Title': 'URSA Coder VS Code Extension'
      }
    };

    this.client = new OpenAI({
      apiKey,
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
      model: params.model || 'openai/gpt-4',
      messages: params.messages as any[]
    });

    const message = response.choices[0]?.message;
    return {
      content: message?.content || '',
      toolCalls: (message as any)?.tool_calls || []
    };
  }
}