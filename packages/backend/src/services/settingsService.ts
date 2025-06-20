export interface UserSettings {
    apiKey: string;
    chainId: string;
    creatorAddress: string;
}

let currentSettings: UserSettings = {
    apiKey: '',
    chainId: 'bitbadges-1',
    creatorAddress: ''
};

/**
 * Get current user settings
 */
export function getUserSettings(): UserSettings {
    return { ...currentSettings };
}

/**
 * Update user settings
 */
export function updateUserSettings(settings: Partial<UserSettings>): void {
    if (settings.apiKey !== undefined) {
        currentSettings.apiKey = settings.apiKey;
    }
    if (settings.chainId !== undefined) {
        currentSettings.chainId = settings.chainId;
    }
    if (settings.creatorAddress !== undefined) {
        currentSettings.creatorAddress = settings.creatorAddress;
    }
}

/**
 * Get API URL based on current chain ID setting
 */
export function getCurrentApiUrl(): string {
    switch (currentSettings.chainId) {
        case 'bitbadges-2':
            return process.env.BITBADGES_TESTNET_API_URL || 'http://localhost:3001';
        case 'bitbadges-1':
        default:
            return process.env.BITBADGES_API_URL || 'http://localhost:3001';
    }
}

/**
 * Get node URL based on current chain ID setting
 */
export function getCurrentNodeUrl(): string {
    switch (currentSettings.chainId) {
        case 'bitbadges-2':
            return process.env.BITBADGES_TESTNET_NODE_URL || 'http://localhost:1317';
        case 'bitbadges-1':
        default:
            return process.env.BITBADGES_NODE_URL || 'http://localhost:1317';
    }
}

/**
 * Get RPC URL based on current chain ID setting
 */
export function getCurrentRpcUrl(): string {
    switch (currentSettings.chainId) {
        case 'bitbadges-2':
            return process.env.BITBADGES_TESTNET_RPC_URL || 'http://localhost:26657';
        case 'bitbadges-1':
        default:
            return process.env.BITBADGES_RPC_URL || 'http://localhost:26657';
    }
}

/**
 * Get the effective API key (user setting or environment variable)
 */
export function getEffectiveApiKey(): string | undefined {
    // Only use user API key if it's not empty/whitespace
    const userApiKey = currentSettings.apiKey?.trim();
    return (userApiKey && userApiKey.length > 0) ? userApiKey : process.env.BITBADGES_API_KEY || undefined;
}

/**
 * Check if mainnet is currently selected
 */
export function isMainnet(): boolean {
    return currentSettings.chainId === 'bitbadges-1';
}

/**
 * Check if testnet is currently selected
 */
export function isTestnet(): boolean {
    return currentSettings.chainId === 'bitbadges-2';
}

/**
 * Get the effective creator address (user setting or AI agent wallet)
 */
export function getEffectiveCreatorAddress(agentWalletAddress?: string): string | undefined {
    if (currentSettings.creatorAddress.trim()) {
        return currentSettings.creatorAddress.trim();
    }
    return agentWalletAddress;
}