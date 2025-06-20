export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Plugin {
  name: string;
  description: string;
}

export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  logs?: string[];
}

export interface AgentConfig {
  maxTokens?: number;
  temperature?: number;
  plugins: string[];
  bitbadgesContext?: {
    chainId?: string;
    address?: string;
    apiKey?: string;
  };
}

export interface WalletInfo {
  address: string;
  encrypted: boolean;
  createdAt: Date;
  lastUsed: Date;
}

export interface WalletConfig {
  autoGenerate?: boolean;
  mnemonic?: string;
  password?: string;
}

export interface WalletStatus {
  hasWallet: boolean;
  walletExists: boolean;
  address: string | null;
  encrypted: boolean;
  createdAt: Date | null;
  lastUsed: Date | null;
}