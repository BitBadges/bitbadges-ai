import axios from 'axios';
import { Plugin, CommandResult, WalletStatus, WalletConfig } from '../types';

const API_BASE_URL =
    (import.meta as any).env?.VITE_API_URL || 'http://localhost:3005/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
});

export const apiService = {
    async getPlugins(): Promise<Plugin[]> {
        const response = await api.get('/plugins');
        return response.data.plugins;
    },

    async executeCommand(
        command: string,
        args: any[] = []
    ): Promise<CommandResult> {
        const response = await api.post('/execute', { command, args });
        return response.data;
    },

    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        const response = await api.get('/health');
        return response.data;
    },

    // Wallet Management
    async getWalletStatus(): Promise<WalletStatus> {
        const response = await api.get('/wallet/status');
        return response.data;
    },

    async createWallet(config: WalletConfig): Promise<{
        success: boolean;
        address: string;
        mnemonic?: string;
        encrypted: boolean;
        createdAt: Date;
    }> {
        const response = await api.post('/wallet/create', config);
        return response.data;
    },

    async loadWallet(password?: string): Promise<{
        success: boolean;
        address: string;
        encrypted: boolean;
        createdAt: Date;
        lastUsed: Date;
    }> {
        const response = await api.post('/wallet/load', { password });
        return response.data;
    },

    async deleteWallet(): Promise<{ success: boolean; message: string }> {
        const response = await api.delete('/wallet');
        return response.data;
    },

    async signMessage(
        message: string
    ): Promise<{ success: boolean; signature: string; address: string }> {
        const response = await api.post('/wallet/sign', { message });
        return response.data;
    },

    async getWalletBalance(network?: string): Promise<{
        success: boolean;
        balance: string;
        network: string;
        address: string;
    }> {
        const response = await api.get(
            `/wallet/balance/${network || 'mainnet'}`
        );
        return response.data;
    },

    // Settings Management
    async getSettings(): Promise<{
        success: boolean;
        apiKey: string;
        chainId: string;
        creatorAddress: string;
    }> {
        const response = await api.get('/settings');
        return response.data;
    },

    async saveSettings(settings: {
        apiKey: string;
        chainId: string;
        creatorAddress: string;
    }): Promise<{
        success: boolean;
        message: string;
        settings: {
            apiKey: string;
            chainId: string;
            creatorAddress: string;
        };
    }> {
        const response = await api.post('/settings', settings);
        return response.data;
    },
};
