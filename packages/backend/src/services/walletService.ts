import { ethers, getBytes, hashMessage, SigningKey } from 'ethers';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { Secp256k1 } from '@cosmjs/crypto';
import { convertToBitBadgesAddress } from 'bitbadgesjs-sdk';
import axios from 'axios';

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
    base64PubKey: string;
}

export interface TransactionSimulateResponse {
    gasInfo: {
        gasWanted: string;
        gasUsed: string;
    };
    result: {
        data: string;
        log: string;
        events: any[];
    };
}

export interface TransactionBroadcastResponse {
    txhash: string;
    code: number;
    raw_log: string;
    gas_wanted: string;
    gas_used: string;
}

export interface TransactionConfirmation {
    txhash: string;
    height: string;
    code: number;
    confirmed: boolean;
    gasWanted: string;
    gasUsed: string;
    events: any[];
}

export class WalletService {
    private static instance: WalletService;
    private wallet: ethers.HDNodeWallet | null = null;
    private walletInfo: WalletInfo | null = null;
    private readonly walletPath: string;
    private readonly dataPath: string;

    constructor() {
        this.dataPath = path.join(process.cwd(), 'data');
        this.walletPath = path.join(this.dataPath, 'wallet.json');
        this.ensureDataDirectory();
    }

    static getInstance(): WalletService {
        if (!WalletService.instance) {
            WalletService.instance = new WalletService();
        }
        return WalletService.instance;
    }

    private async ensureDataDirectory(): Promise<void> {
        try {
            await fs.ensureDir(this.dataPath);
        } catch (error) {
            console.error('Failed to create data directory:', error);
        }
    }

    async initializeWallet(config: WalletConfig): Promise<WalletInfo> {
        try {
            let mnemonic: string;

            if (config.autoGenerate) {
                // Generate new random mnemonic
                mnemonic = ethers.Wallet.createRandom().mnemonic?.phrase || '';
                if (!mnemonic) {
                    throw new Error('Failed to generate mnemonic');
                }
            } else if (config.mnemonic) {
                // Validate provided mnemonic
                if (!ethers.Mnemonic.isValidMnemonic(config.mnemonic)) {
                    throw new Error('Invalid mnemonic phrase');
                }
                mnemonic = config.mnemonic;
            } else {
                throw new Error(
                    'Either autoGenerate must be true or mnemonic must be provided'
                );
            }

            // Create wallet from mnemonic
            this.wallet = ethers.Wallet.fromPhrase(mnemonic);

            // Create wallet info
            this.walletInfo = {
                address: this.wallet.address,
                mnemonic: mnemonic,
                encrypted: false,
                createdAt: new Date(),
                lastUsed: new Date(),
            };

            // Save to disk
            await this.saveWallet(config.password);

            console.log(
                `Wallet initialized with address: ${this.wallet.address}`
            );
            return this.walletInfo;
        } catch (error) {
            console.error('Failed to initialize wallet:', error);
            throw error;
        }
    }

    async loadWallet(password?: string): Promise<WalletInfo | null> {
        try {
            if (!(await fs.pathExists(this.walletPath))) {
                return null;
            }

            const walletData = await fs.readJson(this.walletPath);

            let mnemonic: string;
            if (walletData.encrypted) {
                if (!password) {
                    throw new Error('Password required for encrypted wallet');
                }
                mnemonic = this.decryptMnemonic(
                    walletData.encryptedMnemonic,
                    password
                );
            } else {
                mnemonic = walletData.mnemonic;
            }

            // Recreate wallet from mnemonic
            this.wallet = ethers.Wallet.fromPhrase(mnemonic);

            this.walletInfo = {
                address: walletData.address,
                mnemonic: mnemonic,
                encrypted: walletData.encrypted,
                createdAt: new Date(walletData.createdAt),
                lastUsed: new Date(),
            };

            // Update last used time
            await this.saveWallet(password);

            console.log(`Wallet loaded with address: ${this.wallet.address}`);
            return this.walletInfo;
        } catch (error) {
            console.error('Failed to load wallet:', error);
            throw error;
        }
    }

    private async saveWallet(password?: string): Promise<void> {
        if (!this.walletInfo) {
            throw new Error('No wallet to save');
        }

        let walletData: any = {
            address: this.walletInfo.address,
            encrypted: !!password,
            createdAt: this.walletInfo.createdAt.toISOString(),
            lastUsed: new Date().toISOString(),
        };

        if (password) {
            walletData.encryptedMnemonic = this.encryptMnemonic(
                this.walletInfo.mnemonic,
                password
            );
            walletData.encrypted = true;
        } else {
            walletData.mnemonic = this.walletInfo.mnemonic;
            walletData.encrypted = false;
        }

        await fs.writeJson(this.walletPath, walletData, { spaces: 2 });
    }

    private encryptMnemonic(mnemonic: string, password: string): string {
        const algorithm = 'aes-256-ctr';
        const salt = 'bitbadges-ai-salt';
        const key = crypto.scryptSync(password, salt, 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipher(algorithm, key);

        let encrypted = cipher.update(mnemonic, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return JSON.stringify({
            encrypted,
            iv: iv.toString('hex'),
        });
    }

    private decryptMnemonic(encryptedData: string, password: string): string {
        const algorithm = 'aes-256-ctr';
        const salt = 'bitbadges-ai-salt';
        const key = crypto.scryptSync(password, salt, 32);

        const { encrypted } = JSON.parse(encryptedData);

        const decipher = crypto.createDecipher(algorithm, key);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    getWallet(): ethers.HDNodeWallet | null {
        return this.wallet;
    }

    getWalletInfo(): WalletInfo | null {
        return this.walletInfo;
    }

    getAddress(): string | null {
        return this.wallet?.address || null;
    }

    async signMessage(message: string): Promise<string> {
        if (!this.wallet) {
            throw new Error('No wallet loaded');
        }
        return await this.wallet.signMessage(message);
    }

    async getBalance(provider: ethers.Provider): Promise<string> {
        if (!this.wallet) {
            throw new Error('No wallet loaded');
        }
        const balance = await provider.getBalance(this.wallet.address);
        return ethers.formatEther(balance);
    }

    connectToProvider(providerUrl: string): ethers.HDNodeWallet {
        if (!this.wallet) {
            throw new Error('No wallet loaded');
        }
        const provider = new ethers.JsonRpcProvider(providerUrl);
        return this.wallet.connect(provider);
    }

    async deleteWallet(): Promise<void> {
        try {
            if (await fs.pathExists(this.walletPath)) {
                await fs.remove(this.walletPath);
            }
            this.wallet = null;
            this.walletInfo = null;
            console.log('Wallet deleted successfully');
        } catch (error) {
            console.error('Failed to delete wallet:', error);
            throw error;
        }
    }

    hasWallet(): boolean {
        return this.wallet !== null;
    }

    async walletExists(): Promise<boolean> {
        return await fs.pathExists(this.walletPath);
    }

    async generateBase64PublicKey(): Promise<string> {
        if (!this.wallet) {
            throw new Error('No wallet loaded');
        }

        const message =
            "Hello! We noticed that you haven't used the BitBadges blockchain yet. To interact with the BitBadges blockchain, we need your public key for your address to allow us to generate transactions.\n\nPlease kindly sign this message to allow us to compute your public key.\n\nNote that this message is not a blockchain transaction and signing this message has no purpose other than to compute your public key.\n\nThanks for your understanding!";

        const sig = await this.wallet.signMessage(message);

        const msgHash = hashMessage(message);
        const msgHashBytes = getBytes(msgHash);
        const pubKey = SigningKey.recoverPublicKey(msgHashBytes, sig);

        const pubKeyHex = pubKey.substring(2);
        const compressedPublicKey = Secp256k1.compressPubkey(
            new Uint8Array(Buffer.from(pubKeyHex, 'hex'))
        );

        const base64PubKey =
            Buffer.from(compressedPublicKey).toString('base64');
        return base64PubKey;
    }

    async getCosmosAccountInfo(nodeUrl?: string): Promise<CosmosAccountInfo> {
        const defaultNodeUrl =
            process.env.BITBADGES_NODE_URL || 'http://localhost:1317';
        const finalNodeUrl = nodeUrl || defaultNodeUrl;
        if (!this.wallet) {
            throw new Error('No wallet loaded');
        }

        const ethereumAddress = this.wallet.address;

        try {
            // Convert Ethereum address to BitBadges address
            const bitbadgesAddress = convertToBitBadgesAddress(ethereumAddress);

            // Query the Cosmos node for account information
            const accountUrl = `${finalNodeUrl}/cosmos/auth/v1beta1/accounts/${bitbadgesAddress}`;

            const response = await axios.get(accountUrl, {
                timeout: 10000,
                headers: {
                    Accept: 'application/json',
                },
            });

            // Parse the account response
            const account = response.data.account;

            if (!account) {
                throw new Error('Account not found on blockchain');
            }

            const base64PubKey = await this.generateBase64PublicKey();

            return {
                accountNumber: account.account_number || '0',
                sequence: account.sequence || '0',
                bitbadgesAddress,
                ethereumAddress,
                base64PubKey,
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    // Account doesn't exist yet, return defaults
                    const bitbadgesAddress =
                        convertToBitBadgesAddress(ethereumAddress);
                    const base64PubKey = await this.generateBase64PublicKey();
                    return {
                        accountNumber: '0',
                        sequence: '0',
                        bitbadgesAddress,
                        ethereumAddress,
                        base64PubKey,
                    };
                }
                throw new Error(
                    `Failed to fetch account info: ${error.response?.status} ${error.response?.statusText}`
                );
            }
            throw new Error(
                `Failed to fetch account info: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }

    async broadcastTransaction(
        txBody: any,
        nodeUrl?: string,
        rpcUrl?: string,
        maxWaitBlocks: number = 10
    ): Promise<TransactionConfirmation> {
        if (!this.wallet) {
            throw new Error('No wallet loaded');
        }

        const defaultNodeUrl =
            process.env.BITBADGES_NODE_URL || 'http://localhost:1317';
        const defaultRpcUrl =
            process.env.BITBADGES_RPC_URL || 'http://localhost:26657';
        const finalNodeUrl = nodeUrl || defaultNodeUrl;
        const finalRpcUrl = rpcUrl || defaultRpcUrl;

        try {
            // Step 1: Simulate the transaction
            console.log('Step 1: Simulating transaction...');
            const simulateResponse = await this.simulateTransaction(
                txBody,
                finalNodeUrl
            );
            console.log(
                `Simulation successful. Gas needed: ${simulateResponse.gasInfo.gasUsed}`
            );

            // Step 2: Broadcast the transaction
            console.log('Step 2: Broadcasting transaction...');
            const broadcastResponse = await this.broadcastTransactionToNode(
                txBody,
                finalNodeUrl
            );

            if (broadcastResponse.code !== 0) {
                throw new Error(
                    `Transaction broadcast failed: ${broadcastResponse.raw_log}`
                );
            }

            console.log(
                `Transaction broadcasted successfully. TxHash: ${broadcastResponse.txhash}`
            );

            // Step 3: Wait for confirmation
            console.log('Step 3: Waiting for transaction confirmation...');
            const confirmation = await this.waitForTransactionConfirmation(
                broadcastResponse.txhash,
                finalRpcUrl,
                maxWaitBlocks
            );

            return confirmation;
        } catch (error) {
            throw new Error(
                `Transaction broadcast failed: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }

    private async simulateTransaction(
        txBody: any,
        nodeUrl: string
    ): Promise<TransactionSimulateResponse> {
        const simulateUrl = `${nodeUrl}/cosmos/tx/v1beta1/simulate`;

        try {
            const response = await axios.post(simulateUrl, txBody, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });

            if (!response.data.gas_info) {
                throw new Error(
                    'Invalid simulation response: missing gas_info'
                );
            }

            return {
                gasInfo: {
                    gasWanted: response.data.gas_info.gas_wanted || '0',
                    gasUsed: response.data.gas_info.gas_used || '0',
                },
                result: {
                    data: response.data.result?.data || '',
                    log: response.data.result?.log || '',
                    events: response.data.result?.events || [],
                },
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorMsg =
                    error.response?.data?.message ||
                    error.response?.data?.error ||
                    error.message;
                throw new Error(`Transaction simulation failed: ${errorMsg}`);
            }
            throw error;
        }
    }

    private async broadcastTransactionToNode(
        txBody: any,
        nodeUrl: string
    ): Promise<TransactionBroadcastResponse> {
        const broadcastUrl = `${nodeUrl}/cosmos/tx/v1beta1/txs`;

        try {
            const response = await axios.post(broadcastUrl, txBody, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });

            const txResponse = response.data.tx_response;
            if (!txResponse) {
                throw new Error(
                    'Invalid broadcast response: missing tx_response'
                );
            }

            return {
                txhash: txResponse.txhash,
                code: txResponse.code || 0,
                raw_log: txResponse.raw_log || '',
                gas_wanted: txResponse.gas_wanted || '0',
                gas_used: txResponse.gas_used || '0',
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorMsg =
                    error.response?.data?.message ||
                    error.response?.data?.error ||
                    error.message;
                throw new Error(`Transaction broadcast failed: ${errorMsg}`);
            }
            throw error;
        }
    }

    private async waitForTransactionConfirmation(
        txHash: string,
        rpcUrl: string,
        maxWaitBlocks: number
    ): Promise<TransactionConfirmation> {
        const maxAttempts = maxWaitBlocks * 2; // Check twice per block (assuming 3s blocks)
        const pollInterval = 1500; // 1.5 seconds

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                // Query transaction by hash using RPC
                const txUrl = `${rpcUrl}/tx?hash=0x${txHash}`;

                const response = await axios.get(txUrl, {
                    timeout: 5000,
                    headers: {
                        Accept: 'application/json',
                    },
                });

                if (response.data.result) {
                    const txResult = response.data.result;

                    return {
                        txhash: txHash,
                        height: txResult.height,
                        code: parseInt(txResult.tx_result?.code || '0'),
                        confirmed: true,
                        gasWanted: txResult.tx_result?.gas_wanted || '0',
                        gasUsed: txResult.tx_result?.gas_used || '0',
                        events: txResult.tx_result?.events || [],
                    };
                }
            } catch (error) {
                // Transaction not found yet, continue polling
                if (
                    axios.isAxiosError(error) &&
                    error.response?.status === 404
                ) {
                    // Transaction not found yet, continue waiting
                } else {
                    console.warn(
                        `Error checking transaction ${txHash}:`,
                        error instanceof Error ? error.message : error
                    );
                }
            }

            // Wait before next attempt
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }

        // Timeout reached
        throw new Error(
            `Transaction confirmation timeout: ${txHash} not confirmed within ${maxWaitBlocks} blocks`
        );
    }

    async getLatestBlockHeight(rpcUrl?: string): Promise<number> {
        const defaultRpcUrl =
            process.env.BITBADGES_RPC_URL || 'http://localhost:26657';
        const finalRpcUrl = rpcUrl || defaultRpcUrl;

        try {
            const response = await axios.get(`${finalRpcUrl}/status`, {
                timeout: 5000,
                headers: {
                    Accept: 'application/json',
                },
            });

            const height = response.data.result?.sync_info?.latest_block_height;
            return parseInt(height) || 0;
        } catch (error) {
            throw new Error(
                `Failed to get latest block height: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }

    async getBitBadgesBalance(nodeUrl?: string): Promise<{
        ubadge: string;
        badge: string;
        address: string;
    }> {
        const defaultNodeUrl =
            process.env.BITBADGES_NODE_URL || 'http://localhost:1317';
        const finalNodeUrl = nodeUrl || defaultNodeUrl;

        if (!this.wallet) {
            throw new Error('No wallet loaded');
        }

        const ethereumAddress = this.wallet.address;

        try {
            // Convert Ethereum address to BitBadges address
            const bitbadgesAddress = convertToBitBadgesAddress(ethereumAddress);

            // Query the Cosmos node for bank balances
            const balancesUrl = `${finalNodeUrl}/cosmos/bank/v1beta1/balances/${bitbadgesAddress}`;

            const response = await axios.get(balancesUrl, {
                timeout: 10000,
                headers: {
                    Accept: 'application/json',
                },
            });

            // Find ubadge balance in the response
            const balances = response.data.balances || [];
            const ubadgeBalance = balances.find(
                (balance: any) => balance.denom === 'ubadge'
            );

            if (!ubadgeBalance) {
                // No ubadge balance found, return 0
                return {
                    ubadge: '0',
                    badge: '0',
                    address: bitbadgesAddress,
                };
            }

            const ubadgeAmount = ubadgeBalance.amount || '0';
            // Convert ubadge to BADGE (1 BADGE = 1e9 ubadge)
            const badgeAmount = (parseInt(ubadgeAmount) / 1e9).toString();

            return {
                ubadge: ubadgeAmount,
                badge: badgeAmount,
                address: bitbadgesAddress,
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    // Account doesn't exist yet, return 0 balance
                    const bitbadgesAddress =
                        convertToBitBadgesAddress(ethereumAddress);
                    return {
                        ubadge: '0',
                        badge: '0',
                        address: bitbadgesAddress,
                    };
                }
                throw new Error(
                    `Failed to fetch BitBadges balance: ${error.response?.status} ${error.response?.statusText}`
                );
            }
            throw new Error(
                `Failed to fetch BitBadges balance: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }
}
