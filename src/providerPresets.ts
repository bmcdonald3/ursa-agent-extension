export interface ProviderPreset {
  name: string;
  apiUrl: string;
  models: string[];
  requiresApiKey: boolean;
  headers?: Record<string, string>;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openrouter: {
    name: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1',
    models: [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4',
      'google/gemini-pro',
      'meta-llama/llama-3.1-70b-instruct'
    ],
    requiresApiKey: true,
    headers: {
      'HTTP-Referer': 'https://github.com/ursa-coder',
      'X-Title': 'URSA Coder VS Code Extension'
    }
  },
  ollama: {
    name: 'Ollama (Local)',
    apiUrl: 'http://localhost:11434/v1',
    models: [
      'llama3.2',
      'mistral',
      'codellama',
      'deepseek-coder',
      'qwen2.5-coder'
    ],
    requiresApiKey: false,
    headers: {}
  },
  groq: {
    name: 'Groq',
    apiUrl: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.3-70b-versatile',
      'mixtral-8x7b-32768',
      'gemma2-9b-it'
    ],
    requiresApiKey: true,
    headers: {}
  }
};

export function detectProvider(apiUrl: string): string {
  if (apiUrl.includes('openrouter.ai')) {return 'openrouter';}
  if (apiUrl.includes('localhost:11434')) {return 'ollama';}
  if (apiUrl.includes('groq.com')) {return 'groq';}
  return 'custom';
}