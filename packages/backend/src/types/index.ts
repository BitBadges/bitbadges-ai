export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  logs?: string[];
}

export interface Plugin {
  name: string;
  description: string;
  execute: (args: any[]) => Promise<CommandResult>;
}

export interface HttpRequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
}

export interface BitBadgesContext {
  chainId?: string;
  address?: string;
  apiKey?: string;
}

export interface AgentConfig {
  maxTokens?: number;
  temperature?: number;
  plugins: string[];
  bitbadgesContext?: BitBadgesContext;
}

export interface WalletInfo {
  address: string;
  mnemonic: string;
  encrypted: boolean;
  createdAt: Date;
  lastUsed: Date;
}

export interface WalletConfig {
  autoGenerate?: boolean;
  mnemonic?: string;
  password?: string;
}

export interface CosmosAccountInfo {
  accountNumber: string;
  sequence: string;
  bitbadgesAddress: string;
  ethereumAddress: string;
}