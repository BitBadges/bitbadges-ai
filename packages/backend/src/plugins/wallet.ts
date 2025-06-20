import { Plugin, CommandResult } from '../types';
import { WalletService } from '../services/walletService';
import { getCurrentNodeUrl, getCurrentRpcUrl } from '../services/settingsService';

export const walletPlugin = {
    name: 'wallet',
    description:
        'Manage AI agent wallet operations including signing, balances, and transactions',

    async execute(args: any[]): Promise<CommandResult> {
        if (args.length === 0) {
            return {
                success: false,
                error: 'Wallet command requires action. Available actions: address, balance, sign, status, publickey, account, broadcast, blockheight',
            };
        }

        const action = args[0];
        const params = args[1] || {};

        const walletService = WalletService.getInstance();

        try {
            switch (action) {
                case 'address':
                    return await this.getAddress(walletService);

                case 'balance':
                    return await this.getBitBadgesBalance(
                        walletService,
                        params
                    );

                case 'sign':
                    return await this.signMessage(walletService, params);

                case 'status':
                    return await this.getStatus(walletService);

                case 'publickey':
                case 'pubkey':
                    return await this.getPublicKey(walletService);

                case 'account':
                case 'accountinfo':
                    return await this.getAccountInfo(walletService, params);

                case 'broadcast':
                case 'tx':
                    return await this.broadcastTransaction(
                        walletService,
                        params
                    );

                case 'blockheight':
                case 'height':
                    return await this.getBlockHeight(walletService, params);

                default:
                    return {
                        success: false,
                        error: `Unknown wallet action: ${action}. Available actions: address, balance, sign, status, publickey, account, broadcast, blockheight`,
                    };
            }
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Wallet operation failed',
            };
        }
    },

    async getAddress(walletService: WalletService): Promise<CommandResult> {
        if (!walletService.hasWallet()) {
            return {
                success: false,
                error: 'No wallet loaded. Please set up a wallet first.',
            };
        }

        const address = walletService.getAddress();

        return {
            success: true,
            data: {
                address,
                message: 'AI agent wallet address',
            },
            logs: [`Retrieved wallet address: ${address}`],
        };
    },

    async signMessage(
        walletService: WalletService,
        params: any
    ): Promise<CommandResult> {
        if (!walletService.hasWallet()) {
            return {
                success: false,
                error: 'No wallet loaded. Please set up a wallet first.',
            };
        }

        const { message } = params;

        if (!message) {
            return {
                success: false,
                error: 'Message to sign is required',
            };
        }

        try {
            const signature = await walletService.signMessage(message);
            const address = walletService.getAddress();

            return {
                success: true,
                data: {
                    message,
                    signature,
                    address,
                    signedBy: 'AI Agent Wallet',
                },
                logs: [`Signed message with wallet: ${address}`],
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to sign message: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
            };
        }
    },

    async getStatus(walletService: WalletService): Promise<CommandResult> {
        const hasWallet = walletService.hasWallet();
        const walletExists = await walletService.walletExists();
        const walletInfo = walletService.getWalletInfo();

        return {
            success: true,
            data: {
                hasWallet,
                walletExists,
                address: walletInfo?.address || null,
                encrypted: walletInfo?.encrypted || false,
                createdAt: walletInfo?.createdAt || null,
                lastUsed: walletInfo?.lastUsed || null,
                status: hasWallet
                    ? 'Active'
                    : walletExists
                    ? 'Exists (Locked)'
                    : 'Not Created',
            },
            logs: [
                `Wallet status: ${
                    hasWallet
                        ? 'Active'
                        : walletExists
                        ? 'Exists but locked'
                        : 'Not created'
                }`,
            ],
        };
    },

    async getPublicKey(walletService: WalletService): Promise<CommandResult> {
        if (!walletService.hasWallet()) {
            return {
                success: false,
                error: 'No wallet loaded. Please set up a wallet first.',
            };
        }

        try {
            const base64PublicKey =
                await walletService.generateBase64PublicKey();
            const address = walletService.getAddress();

            return {
                success: true,
                data: {
                    publicKey: base64PublicKey,
                    address,
                    format: 'base64',
                },
                logs: [
                    `Generated base64 public key for wallet: ${address}. Public key: ${base64PublicKey}`,
                ],
            };
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to generate public key',
            };
        }
    },

    async getAccountInfo(
        walletService: WalletService,
        params: any
    ): Promise<CommandResult> {
        if (!walletService.hasWallet()) {
            return {
                success: false,
                error: 'No wallet loaded. Please set up a wallet first.',
            };
        }

        try {
            const nodeUrl = params.nodeUrl || getCurrentNodeUrl();
            const accountInfo = await walletService.getCosmosAccountInfo(
                nodeUrl
            );

            return {
                success: true,
                data: {
                    ...accountInfo,
                    nodeUrl,
                },
                logs: [
                    `Retrieved account info for BitBadges address: ${accountInfo.bitbadgesAddress}`,
                ],
            };
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to get account info',
            };
        }
    },

    async broadcastTransaction(
        walletService: WalletService,
        params: any
    ): Promise<CommandResult> {
        if (!walletService.hasWallet()) {
            return {
                success: false,
                error: 'No wallet loaded. Please set up a wallet first.',
            };
        }

        const { txBody, nodeUrl, rpcUrl, maxWaitBlocks } = params;

        if (!txBody) {
            return {
                success: false,
                error: 'Transaction body is required',
            };
        }

        try {
            const confirmation = await walletService.broadcastTransaction(
                txBody,
                nodeUrl,
                rpcUrl,
                maxWaitBlocks || 10
            );

            return {
                success: true,
                data: {
                    ...confirmation,
                    message: confirmation.confirmed
                        ? 'Transaction confirmed successfully'
                        : 'Transaction broadcasted but not confirmed',
                },
                logs: [
                    `Transaction broadcasted: ${confirmation.txhash}`,
                    `Block height: ${confirmation.height}`,
                    `Gas used: ${confirmation.gasUsed}/${confirmation.gasWanted}`,
                    `Status: ${
                        confirmation.confirmed ? 'Confirmed' : 'Pending'
                    }`,
                ],
            };
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to broadcast transaction',
            };
        }
    },

    async getBlockHeight(
        walletService: WalletService,
        params: any
    ): Promise<CommandResult> {
        try {
            const rpcUrl =
                params.rpcUrl ||
                process.env.BITBADGES_RPC_URL ||
                'http://localhost:26657';
            const height = await walletService.getLatestBlockHeight(rpcUrl);

            return {
                success: true,
                data: {
                    height,
                    rpcUrl,
                    timestamp: new Date().toISOString(),
                },
                logs: [`Latest block height: ${height}`],
            };
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to get block height',
            };
        }
    },

    async getBitBadgesBalance(
        walletService: WalletService,
        params: any
    ): Promise<CommandResult> {
        if (!walletService.hasWallet()) {
            return {
                success: false,
                error: 'No wallet loaded. Please set up a wallet first.',
            };
        }

        try {
            const nodeUrl = params.nodeUrl || getCurrentNodeUrl();
            const balance = await walletService.getBitBadgesBalance(nodeUrl);

            return {
                success: true,
                data: {
                    ...balance,
                    nodeUrl,
                    displayBalance: `${balance.badge} $BADGE`,
                    rawBalance: `${balance.ubadge} ubadge`,
                },
                logs: [
                    `Balance: ${balance.badge} $BADGE (${balance.ubadge} ubadge)`,
                    `Address: ${balance.address}`,
                ],
            };
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to get BitBadges balance',
            };
        }
    },
};
