import { BitBadgesAdminAPI, BigIntify } from 'bitbadgesjs-sdk';
import { getCurrentApiUrl, getEffectiveApiKey } from './settingsService';

export type DesiredNumberType = bigint;
export const ConvertFunction = BigIntify;

// Global BitBadges API instance with bigint support
export let BitBadgesApi: BitBadgesAdminAPI<bigint>;

/**
 * Initialize the global BitBadges API instance
 */
export function initializeBitBadgesApi(): void {
    const apiUrl = getCurrentApiUrl();
    const apiKey = getEffectiveApiKey();

    console.log('Initializing BitBadges API...');
    console.log('API URL:', apiUrl);
    console.log('API Key:', apiKey ? '***configured***' : 'not configured');

    BitBadgesApi = new BitBadgesAdminAPI({
        apiUrl: apiUrl,
        convertFunction: BigIntify,
        apiKey: apiKey ? apiKey : undefined,
    });

    console.log('BitBadges API initialized successfully');
}

/**
 * Get the global BitBadges API instance
 * Initializes if not already initialized
 */
export function getBitBadgesApi(): BitBadgesAdminAPI<bigint> {
    if (!BitBadgesApi) {
        initializeBitBadgesApi();
    }
    return BitBadgesApi;
}

/**
 * Check if the BitBadges API is configured with an API key
 */
export function hasBitBadgesApiKey(): boolean {
    return !!getEffectiveApiKey();
}

/**
 * Update BitBadges API settings with user-provided values
 */
export function updateBitBadgesApiSettings(userApiKey?: string, userChainId?: string): void {
    const apiUrl = getCurrentApiUrl();
    const apiKey = getEffectiveApiKey();

    console.log('Updating BitBadges API settings...');
    console.log('API URL:', apiUrl);
    console.log('API Key:', apiKey ? '***configured***' : 'not configured');
    console.log('Chain ID:', userChainId || 'bitbadges-1');

    BitBadgesApi = new BitBadgesAdminAPI({
        apiUrl: apiUrl,
        convertFunction: BigIntify,
        apiKey: apiKey ? apiKey : undefined,
    });

    console.log('BitBadges API updated successfully');
}

/**
 * Get API URL based on chain ID
 */
function getApiUrlForChain(chainId: string): string {
    switch (chainId) {
        case 'bitbadges-2':
            return process.env.BITBADGES_TESTNET_API_URL || 'http://localhost:3001';
        case 'bitbadges-1':
        default:
            return process.env.BITBADGES_API_URL || 'http://localhost:3001';
    }
}

/**
 * Get API configuration info
 */
export function getBitBadgesApiInfo(): {
    apiUrl: string;
    hasApiKey: boolean;
    isInitialized: boolean;
} {
    return {
        apiUrl: getCurrentApiUrl(),
        hasApiKey: hasBitBadgesApiKey(),
        isInitialized: !!BitBadgesApi,
    };
}
