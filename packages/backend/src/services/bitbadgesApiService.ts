import { BitBadgesAdminAPI, BigIntify } from 'bitbadgesjs-sdk';

export type DesiredNumberType = bigint;
export const ConvertFunction = BigIntify;

// Global BitBadges API instance with bigint support
export let BitBadgesApi: BitBadgesAdminAPI<bigint>;

/**
 * Initialize the global BitBadges API instance
 */
export function initializeBitBadgesApi(): void {
    const apiUrl = process.env.BITBADGES_API_URL || 'http://localhost:3001';
    const apiKey = process.env.BITBADGES_API_KEY;

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
    return !!process.env.BITBADGES_API_KEY;
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
        apiUrl: process.env.BITBADGES_API_URL || 'http://localhost:3001',
        hasApiKey: hasBitBadgesApiKey(),
        isInitialized: !!BitBadgesApi,
    };
}
