import axios from 'axios';
import {
    convertToBitBadgesAddress,
    iCollectionApproval,
} from 'bitbadgesjs-sdk';
import * as fs from 'fs-extra';
import OpenAI from 'openai';
import * as path from 'path';
import { getBitBadgesApi } from './bitbadgesApiService';
import { OpenAPIService } from './openApiService';

export interface ProtoField {
    name: string;
    type: string;
    number: number;
    repeated?: boolean;
    optional?: boolean;
    description?: string;
}

export interface ProtoMessage {
    name: string;
    fields: ProtoField[];
    imports: string[];
    description?: string;
}

export interface ProtoSchema {
    messages: Map<string, ProtoMessage>;
    imports: Map<string, string[]>;
}

export interface TransactionContext {
    resolvedAddresses: Map<string, string>; // username/address -> BitBadges address
    addressMappings: Map<string, string>; // original -> resolved
    userProfiles: Map<string, any>; // BitBadges address -> user profile
    collectionInfo: Map<string, any>; // collection ID -> collection info
    agentWallet: {
        ethereumAddress: string;
        bitbadgesAddress: string;
        accountNumber: string;
        sequence: string;
        publicKey: string;
        hasWallet: boolean;
    } | null;
    specialAddresses: {
        mint: string;
    };
    metadata: {
        timestamp: Date;
        originalPrompt: string;
        processedPrompt: string;
    };
    collectionApprovals: iCollectionApproval<bigint>[];
}

export class ProtoService {
    private static instance: ProtoService;
    private schema: ProtoSchema | null = null;
    private readonly protoPath: string;
    private readonly githubBaseUrl =
        'https://api.github.com/repos/BitBadges/bitbadgesjs/contents/packages/bitbadgesjs-sdk/proto/badges';
    private openai: OpenAI | null = null;

    constructor() {
        this.protoPath = path.join(process.cwd(), 'data', 'proto');

        // Initialize OpenAI client if API key is available
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
            console.log('OpenAI client initialized for prompt parsing');
        } else {
            console.log('OpenAI API key not found, using fallback parsing');
        }
    }

    static getInstance(): ProtoService {
        if (!ProtoService.instance) {
            ProtoService.instance = new ProtoService();
        }
        return ProtoService.instance;
    }

    async initialize(): Promise<void> {
        try {
            console.log('Initializing ProtoService - fetching proto files...');
            await this.ensureProtoDirectory();
            await this.fetchProtoFiles();
            await this.parseProtoFiles();
            console.log('ProtoService initialized successfully');
        } catch (error) {
            console.error('Failed to initialize ProtoService:', error);
            throw error;
        }
    }

    private async ensureProtoDirectory(): Promise<void> {
        await fs.ensureDir(this.protoPath);
    }

    private async fetchProtoFiles(): Promise<void> {
        try {
            // Fetch the directory contents
            const response = await axios.get(this.githubBaseUrl, {
                headers: {
                    Accept: 'application/vnd.github.v3+json',
                    'User-Agent': 'BitBadges-AI-Agent',
                },
            });

            const files = response.data.filter(
                (item: any) =>
                    item.type === 'file' && item.name.endsWith('.proto')
            );

            console.log(`Found ${files.length} proto files to download`);

            // Download each proto file
            for (const file of files) {
                await this.downloadProtoFile(file.name, file.download_url);
            }
        } catch (error) {
            console.error('Failed to fetch proto files:', error);
            throw error;
        }
    }

    private async downloadProtoFile(
        filename: string,
        downloadUrl: string
    ): Promise<void> {
        try {
            const response = await axios.get(downloadUrl, {
                headers: {
                    'User-Agent': 'BitBadges-AI-Agent',
                },
            });

            const filePath = path.join(this.protoPath, filename);
            await fs.writeFile(filePath, response.data, 'utf8');
            console.log(`Downloaded: ${filename}`);
        } catch (error) {
            console.error(`Failed to download ${filename}:`, error);
            throw error;
        }
    }

    private async parseProtoFiles(): Promise<void> {
        this.schema = {
            messages: new Map(),
            imports: new Map(),
        };

        const protoFiles = await fs.readdir(this.protoPath);
        const protoFilePaths = protoFiles
            .filter((file) => file.endsWith('.proto'))
            .map((file) => path.join(this.protoPath, file));

        // Parse each proto file
        for (const filePath of protoFilePaths) {
            await this.parseProtoFile(filePath);
        }

        console.log(
            `Parsed ${this.schema.messages.size} messages from ${protoFiles.length} proto files`
        );
    }

    private async parseProtoFile(filePath: string): Promise<void> {
        const content = await fs.readFile(filePath, 'utf8');
        const filename = path.basename(filePath);

        // Parse imports
        const imports = this.parseImports(content);
        this.schema!.imports.set(filename, imports);

        // Parse messages
        const messages = this.parseMessages(content, filename);
        messages.forEach((message) => {
            this.schema!.messages.set(message.name, message);
        });
    }

    private parseImports(content: string): string[] {
        const imports: string[] = [];
        const importRegex = /import\s+"([^"]+)";/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        return imports;
    }

    private parseMessages(content: string, filename: string): ProtoMessage[] {
        const messages: ProtoMessage[] = [];

        // Remove comments
        const cleanContent = content
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');

        // Find all message definitions
        const messageRegex = /message\s+(\w+)\s*\{([^}]*)\}/g;
        let match;

        while ((match = messageRegex.exec(cleanContent)) !== null) {
            const messageName = match[1];
            const messageBody = match[2];

            const fields = this.parseMessageFields(messageBody);
            const imports = this.schema!.imports.get(filename) || [];

            messages.push({
                name: messageName,
                fields,
                imports,
                description: `Message from ${filename}`,
            });
        }

        return messages;
    }

    private parseMessageFields(messageBody: string): ProtoField[] {
        const fields: ProtoField[] = [];

        // Parse field definitions
        const fieldRegex =
            /(?:repeated\s+)?(?:optional\s+)?(\w+)\s+(\w+)\s*=\s*(\d+);/g;
        let match;

        while ((match = fieldRegex.exec(messageBody)) !== null) {
            const fullMatch = match[0];
            const type = match[1];
            const name = match[2];
            const number = parseInt(match[3]);

            const repeated = fullMatch.includes('repeated');
            const optional = fullMatch.includes('optional');

            fields.push({
                name,
                type,
                number,
                repeated,
                optional,
            });
        }

        return fields;
    }

    getMsgTransferBadgesSchema(): ProtoMessage | null {
        if (!this.schema) {
            return null;
        }
        return this.schema.messages.get('MsgTransferBadges') || null;
    }

    getAllMessages(): Map<string, ProtoMessage> {
        return this.schema?.messages || new Map();
    }

    isInitialized(): boolean {
        return this.schema !== null;
    }

    async generateMsgTransferBadgesFromPrompt(
        prompt: string,
        walletService?: any
    ): Promise<any> {
        const schema = this.getMsgTransferBadgesSchema();
        if (!schema) {
            throw new Error('MsgTransferBadges schema not loaded');
        }

        // Step 1: Create and populate transaction context
        const context = await this.createTransactionContext(
            prompt,
            walletService
        );

        // Step 2: Parse the prompt with resolved context
        const transferMsg = await this.parseTransferPrompt(
            context.metadata.processedPrompt,
            schema,
            context
        );

        // Return both the message and the context for upstream processing
        return {
            transferMsg,
            context,
            // For backward compatibility, also include the message directly
            ...transferMsg,
        };
    }

    async createTransactionContext(
        originalPrompt: string,
        walletService?: any
    ): Promise<TransactionContext> {
        console.log('Creating transaction context for prompt:', originalPrompt);

        const context: TransactionContext = {
            resolvedAddresses: new Map(),
            addressMappings: new Map(),
            userProfiles: new Map(),
            collectionInfo: new Map(),
            agentWallet: null,
            specialAddresses: {
                mint: 'Mint',
            },
            metadata: {
                timestamp: new Date(),
                originalPrompt,
                processedPrompt: originalPrompt,
            },
            collectionApprovals: [],
        };

        // Step 0.1: Set up special address mappings
        this.setupSpecialAddresses(context);

        // Step 0: Populate agent wallet information if available
        if (walletService) {
            try {
                await this.populateAgentWalletInfo(context, walletService);
            } catch (error) {
                console.warn('Failed to populate agent wallet info:', error);
            }
        }

        // Step 1: Extract potential usernames and addresses from the prompt
        const entities = this.extractEntitiesFromPrompt(originalPrompt);
        console.log('Extracted entities:', entities);

        // Step 2: Handle special addresses (like Mint)
        for (const entity of entities.specialAddresses) {
            const specialAddress = this.resolveSpecialAddress(entity);
            if (specialAddress) {
                context.addressMappings.set(entity, specialAddress);

                // Update the prompt with special address
                context.metadata.processedPrompt =
                    context.metadata.processedPrompt.replace(
                        new RegExp(`\\b${entity}\\b`, 'gi'),
                        specialAddress
                    );
            }
        }

        const api = getBitBadgesApi();
        for (const entity of entities.collectionIds) {
            const collectionRes = await api.getCollection(entity);
            context.collectionApprovals.push(
                ...collectionRes.collection.collectionApprovals
            );
        }

        // Step 3: Resolve usernames to addresses
        for (const entity of entities.usernames) {
            try {
                const resolved = await this.resolveUsername(entity);
                if (resolved) {
                    context.resolvedAddresses.set(entity, resolved.address);
                    context.userProfiles.set(
                        resolved.address,
                        resolved.profile
                    );
                    context.addressMappings.set(entity, resolved.address);

                    // Update the prompt with resolved address
                    context.metadata.processedPrompt =
                        context.metadata.processedPrompt.replace(
                            new RegExp(`\\b${entity}\\b`, 'gi'),
                            resolved.address
                        );
                }
            } catch (error) {
                console.warn(`Failed to resolve username ${entity}:`, error);
                // Continue with original name if resolution fails
            }
        }

        // Step 4: Convert non-BitBadges addresses to BitBadges format
        for (const entity of entities.addresses) {
            try {
                const bitbadgesAddress =
                    this.convertToBitBadgesIfNeeded(entity);
                if (bitbadgesAddress !== entity) {
                    context.resolvedAddresses.set(entity, bitbadgesAddress);
                    context.addressMappings.set(entity, bitbadgesAddress);

                    // Update the prompt with BitBadges address
                    context.metadata.processedPrompt =
                        context.metadata.processedPrompt.replace(
                            new RegExp(`\\b${entity}\\b`, 'gi'),
                            bitbadgesAddress
                        );
                } else {
                    // Already a BitBadges address
                    context.resolvedAddresses.set(entity, entity);
                }
            } catch (error) {
                console.warn(`Failed to convert address ${entity}:`, error);
                // Continue with original address if conversion fails
            }
        }

        // Step 5: Process collection IDs (fetch collection info if needed)
        for (const collectionId of entities.collectionIds) {
            try {
                // For now, just store the collection ID
                // In the future, you could fetch collection metadata from BitBadges API
                context.collectionInfo.set(collectionId, {
                    collectionId: collectionId,
                    // Additional metadata could be fetched here
                });
                console.log(`Processed collection ID: ${collectionId}`);
            } catch (error) {
                console.warn(
                    `Failed to process collection ID ${collectionId}:`,
                    error
                );
            }
        }

        console.log('Transaction context created:', {
            originalPrompt: context.metadata.originalPrompt,
            processedPrompt: context.metadata.processedPrompt,
            resolvedAddresses: Object.fromEntries(context.resolvedAddresses),
            addressMappings: Object.fromEntries(context.addressMappings),
            collectionIds: Array.from(context.collectionInfo.keys()),
            collectionApprovals: context.collectionApprovals,
        });

        return context;
    }

    private extractEntitiesFromPrompt(prompt: string): {
        usernames: string[];
        addresses: string[];
        specialAddresses: string[];
        collectionIds: string[];
    } {
        const usernames: string[] = [];
        const addresses: string[] = [];
        const specialAddresses: string[] = [];
        const collectionIds: string[] = [];

        // Look for collection IDs
        const collectionPatterns = [
            /\bcollection\s+(\d+)\b/gi, // "collection 123"
            /\bcollection\s+id\s+(\d+)\b/gi, // "collection id 123"
            /\bin\s+collection\s+(\d+)\b/gi, // "in collection 123"
            /\bfrom\s+collection\s+(\d+)\b/gi, // "from collection 123"
            /\bcol\s+(\d+)\b/gi, // "col 123" (shorthand)
            /\bcollectionId[:\s]+(\d+)\b/gi, // "collectionId: 123" or "collectionId 123"
        ];

        collectionPatterns.forEach((pattern) => {
            const matches = Array.from(prompt.matchAll(pattern));
            matches.forEach((match) => {
                if (match[1]) {
                    collectionIds.push(match[1]);
                }
            });
        });

        // Look for special addresses first
        const specialAddressPatterns = [
            /\b(?:mint|Mint|MINT|treasury|Treasury|protocol|Protocol)\b/g,
        ];

        specialAddressPatterns.forEach((pattern) => {
            const matches = prompt.match(pattern);
            if (matches) {
                specialAddresses.push(...matches);
            }
        });

        // Look for usernames (simple alphanumeric strings that might be usernames)
        const usernameMatches = prompt.match(
            /(?:from|to|user|sender|recipient)\s+([a-zA-Z][a-zA-Z0-9_-]{2,15})(?!\w)/gi
        );
        if (usernameMatches) {
            usernameMatches.forEach((match) => {
                const username = match.split(/\s+/).pop();
                if (
                    username &&
                    !this.looksLikeAddress(username) &&
                    !this.isSpecialAddress(username)
                ) {
                    usernames.push(username);
                }
            });
        }

        // Look for addresses (hex strings, bech32 addresses, etc.)
        const addressPatterns = [
            /0x[a-fA-F0-9]{40}/g, // Ethereum addresses
            /cosmos1[a-z0-9]{38}/g, // Cosmos addresses
            /bb1[a-z0-9]{38}/g, // BitBadges addresses
        ];

        addressPatterns.forEach((pattern) => {
            const matches = prompt.match(pattern);
            if (matches) {
                addresses.push(...matches);
            }
        });

        return {
            usernames: [...new Set(usernames)],
            addresses: [...new Set(addresses)],
            specialAddresses: [...new Set(specialAddresses)],
            collectionIds: [...new Set(collectionIds)],
        };
    }

    private isSpecialAddress(str: string): boolean {
        const specialAddressNames = [
            'mint',
            'Mint',
            'MINT',
            'treasury',
            'Treasury',
            'protocol',
            'Protocol',
        ];
        return specialAddressNames.includes(str);
    }

    private resolveSpecialAddress(entity: string): string | null {
        // Normalize the entity to lowercase for comparison
        const normalized = entity.toLowerCase();

        switch (normalized) {
            case 'mint':
            case 'treasury':
            case 'protocol':
                return 'Mint'; // The reserved Mint address
            default:
                return null;
        }
    }

    private looksLikeAddress(str: string): boolean {
        return /^(0x[a-fA-F0-9]{40}|cosmos1[a-z0-9]{38}|bb1[a-z0-9]{38})$/.test(
            str
        );
    }

    private async resolveUsername(
        username: string
    ): Promise<{ address: string; profile: any } | null> {
        try {
            // Try to use global BitBadges API first
            const bitbadgesApi = getBitBadgesApi();

            try {
                const user = await bitbadgesApi.getAccount({
                    username: username,
                });

                if (user && user.account) {
                    return {
                        address: user.account.bitbadgesAddress,
                        profile: user,
                    };
                }
            } catch (apiError) {
                console.warn(
                    `BitBadges API username search failed for ${username}:`,
                    apiError
                );
            }

            // Fallback to OpenAPI service approach
            const openApiService = OpenAPIService.getInstance();
            if (!openApiService.isInitialized()) {
                console.warn(
                    'OpenAPI service not initialized, cannot resolve username'
                );
                return null;
            }

            // Try to find user by username using BitBadges API
            // This is a simplified approach - you might need to adjust based on actual API structure
            const searchEndpoint =
                openApiService.findEndpoint('searchUsers') ||
                openApiService.findEndpoint('getUserByUsername') ||
                openApiService.findEndpoint('getUsers');

            if (!searchEndpoint) {
                console.warn('No user search endpoint found in BitBadges API');
                return null;
            }

            const searchUrl = openApiService.buildUrl(searchEndpoint, {});
            const response = await axios.get(searchUrl, {
                params: { username: username },
                timeout: 5000,
                headers: { Accept: 'application/json' },
            });

            if (
                response.data &&
                response.data.users &&
                response.data.users.length > 0
            ) {
                const user = response.data.users[0];
                return {
                    address: user.cosmosAddress || user.address,
                    profile: user,
                };
            }

            return null;
        } catch (error) {
            console.warn(`Error resolving username ${username}:`, error);
            return null;
        }
    }

    private convertToBitBadgesIfNeeded(address: string): string {
        // If it's already a BitBadges address, return as-is
        if (address.startsWith('bb1')) {
            return address;
        }

        // If it's an Ethereum address, convert it
        if (address.startsWith('0x') && address.length === 42) {
            return convertToBitBadgesAddress(address);
        }

        // If it's a Cosmos address, we might need special handling
        if (address.startsWith('cosmos1')) {
            // For now, return as-is, but you might want to add conversion logic
            return address;
        }

        // Default: return as-is
        return address;
    }

    private setupSpecialAddresses(context: TransactionContext): void {
        console.log('Setting up special addresses...');

        // Add the Mint address with various aliases
        const mintAddress = context.specialAddresses.mint;
        context.resolvedAddresses.set('mint', mintAddress);
        context.resolvedAddresses.set('Mint', mintAddress);
        context.resolvedAddresses.set('MINT', mintAddress);
        context.resolvedAddresses.set('treasury', mintAddress);
        context.resolvedAddresses.set('Treasury', mintAddress);
        context.resolvedAddresses.set('protocol', mintAddress);
        context.resolvedAddresses.set('Protocol', mintAddress);

        console.log(`Mint address set up: ${mintAddress}`);
    }

    private async populateAgentWalletInfo(
        context: TransactionContext,
        walletService: any
    ): Promise<void> {
        console.log('Populating agent wallet information...');

        const hasWallet = walletService.hasWallet();

        if (!hasWallet) {
            context.agentWallet = {
                ethereumAddress: '',
                bitbadgesAddress: '',
                accountNumber: '',
                sequence: '',
                publicKey: '',
                hasWallet: false,
            };
            return;
        }

        try {
            // Get account info which includes BitBadges address, account number, sequence, etc.
            const accountInfo = await walletService.getCosmosAccountInfo();

            context.agentWallet = {
                ethereumAddress: accountInfo.ethereumAddress,
                bitbadgesAddress: accountInfo.bitbadgesAddress,
                accountNumber: accountInfo.accountNumber,
                sequence: accountInfo.sequence,
                publicKey: accountInfo.base64PubKey,
                hasWallet: true,
            };

            // Also add the agent's address to resolved addresses for easy reference
            context.resolvedAddresses.set(
                'agent',
                accountInfo.bitbadgesAddress
            );
            context.resolvedAddresses.set('me', accountInfo.bitbadgesAddress);
            context.resolvedAddresses.set('self', accountInfo.bitbadgesAddress);

            console.log('Agent wallet info populated:', {
                ethereumAddress: context.agentWallet.ethereumAddress,
                bitbadgesAddress: context.agentWallet.bitbadgesAddress,
                accountNumber: context.agentWallet.accountNumber,
                sequence: context.agentWallet.sequence,
            });
        } catch (error) {
            console.warn('Error getting agent wallet account info:', error);

            // Fallback: get basic wallet info
            const address = walletService.getAddress();
            const bitbadgesAddress = address
                ? this.convertToBitBadgesIfNeeded(address)
                : '';

            context.agentWallet = {
                ethereumAddress: address || '',
                bitbadgesAddress: bitbadgesAddress,
                accountNumber: '0',
                sequence: '0',
                publicKey: '',
                hasWallet: true,
            };
        }
    }

    private async parseTransferPrompt(
        prompt: string,
        schema: ProtoMessage,
        context?: TransactionContext
    ): Promise<any> {
        // Use AI to intelligently parse the prompt based on the schema
        const aiParsedData = await this.aiParsePrompt(prompt, schema, context);

        // Build prioritized approvals from collection approvals
        const prioritizedApprovals =
            context?.collectionApprovals?.map((approval: any) => ({
                approvalId: approval.approvalId || '',
                approvalLevel: 'collection',
                approverAddress: approval.approverAddress || '',
                version: approval.version || '1',
            })) || [];

        // Build the complete message structure using AI-parsed data and schema
        const msg = {
            collectionId: aiParsedData.collectionId || '1',
            transfers: [
                {
                    from: aiParsedData.from || '',
                    toAddresses: aiParsedData.toAddresses || [''],
                    balances: [
                        {
                            amount: aiParsedData.amount || '1',
                            badgeIds: aiParsedData.badgeIds || [
                                { start: '1', end: '1' },
                            ],
                            ownershipTimes: aiParsedData.ownershipTimes || [
                                {
                                    start: '1',
                                    end: '18446744073709551615', // Max uint64 - represents "forever"
                                },
                            ],
                        },
                    ],
                    precalculateBalancesFromApproval:
                        aiParsedData.precalculateBalancesFromApproval || '',
                    merkleProofs: aiParsedData.merkleProofs || [],
                    memo: aiParsedData.memo || '',
                    prioritizedApprovals: prioritizedApprovals,
                    affiliateAddress: context?.agentWallet?.bitbadgesAddress,
                },
            ],
        };

        return {
            typeUrl: '/badges.MsgTransferBadges',
            value: msg,
        };
    }

    private async aiParsePrompt(
        prompt: string,
        schema: ProtoMessage,
        context?: TransactionContext
    ): Promise<any> {
        // Create a detailed prompt for AI to parse the user's intent
        const systemPrompt = `You are an expert at parsing natural language commands for BitBadges blockchain transactions. 

Given the following schema for MsgTransferBadges:
${JSON.stringify(schema.fields, null, 2)}

And the following context information:
- Available addresses: ${
            context
                ? Array.from(context.resolvedAddresses.keys()).join(', ')
                : 'None'
        }
- Collection IDs: ${
            context
                ? Array.from(context.collectionInfo.keys()).join(', ')
                : 'None'
        }
- Special addresses: ${
            context ? JSON.stringify(context.specialAddresses) : 'None'
        }

Parse this user prompt and extract the transaction details: "${prompt}"

Return a JSON object with these fields:
{
  "collectionId": "string - the collection ID mentioned",
  "from": "string - the sender address", 
  "toAddresses": "array of strings - recipient addresses",
  "amount": "string - number of badges to transfer",
  "badgeIds": "array of objects with start/end properties - badge ID ranges",
  "ownershipTimes": "array of objects with start/end properties - time ranges (use start: '1', end: '18446744073709551615' for forever)",
  "memo": "string - any memo/message mentioned",
  "precalculateBalancesFromApproval": "string - usually empty",
  "merkleProofs": "array - usually empty"
}

Important rules:
1. If no collection ID is specified, use "1"
2. If no amount is specified, use "1" 
3. If no badge IDs are specified, use [{"start": "1", "end": "1"}]
4. Use the resolved addresses from context when available
5. Convert "Mint" to the special mint address
6. For badge ranges like "badges 5-10", use [{"start": "5", "end": "10"}]
7. For single badges like "badge 5", use [{"start": "5", "end": "5"}]
8. Always return valid JSON`;

        try {
            // If OpenAI is available, use it for intelligent parsing
            if (this.openai) {
                console.log('Using OpenAI to parse prompt:', prompt);

                const completion = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        {
                            role: 'user',
                            content: `Parse this transaction prompt: "${prompt}"`,
                        },
                    ],
                    temperature: 0.1,
                    max_tokens: 1000,
                    response_format: { type: 'json_object' },
                });

                const aiResponse = completion.choices[0].message.content;
                if (aiResponse) {
                    const parsedData = JSON.parse(aiResponse);
                    console.log('OpenAI parsed data:', parsedData);

                    // Apply context resolution to the AI-parsed data
                    return this.applyContextToAiParsedData(parsedData, context);
                }
            }

            console.log('OpenAI not available, using smart parsing fallback');
            return this.smartParsePrompt(prompt, context);
        } catch (error) {
            console.warn(
                'AI parsing failed, falling back to smart parsing:',
                error
            );
            return this.smartParsePrompt(prompt, context);
        }
    }

    private applyContextToAiParsedData(
        aiData: any,
        context?: TransactionContext
    ): any {
        // Apply context resolution to AI-parsed addresses
        if (context) {
            // Resolve 'from' address
            if (aiData.from) {
                const resolved =
                    context.resolvedAddresses.get(aiData.from) ||
                    context.addressMappings.get(aiData.from);
                if (resolved) {
                    aiData.from = resolved;
                }
            }

            // Resolve 'toAddresses'
            if (aiData.toAddresses && Array.isArray(aiData.toAddresses)) {
                aiData.toAddresses = aiData.toAddresses.map((addr: string) => {
                    const resolved =
                        context.resolvedAddresses.get(addr) ||
                        context.addressMappings.get(addr);
                    return resolved || addr;
                });
            }
        }

        return aiData;
    }

    private smartParsePrompt(
        prompt: string,
        context?: TransactionContext
    ): any {
        const lowercasePrompt = prompt.toLowerCase();

        // Extract collection ID
        const collectionMatches = [
            prompt.match(/collection\s+(?:id\s+)?(\d+)/i),
            prompt.match(/\bcol\s+(\d+)/i),
            prompt.match(/collectionId[:\s]+(\d+)/i),
        ].find((match) => match);

        // Extract addresses - prioritize resolved addresses from context
        let fromAddress = '';
        let toAddresses = [''];

        // Look for "from X to Y" pattern
        const fromToMatch = prompt.match(
            /from\s+([a-zA-Z0-9_\-.]+)\s+to\s+([a-zA-Z0-9_\-.]+)/i
        );
        if (fromToMatch) {
            const fromEntity = fromToMatch[1];
            const toEntity = fromToMatch[2];

            // Resolve using context if available
            fromAddress =
                context?.resolvedAddresses.get(fromEntity) ||
                context?.addressMappings.get(fromEntity) ||
                fromEntity;

            const resolvedTo =
                context?.resolvedAddresses.get(toEntity) ||
                context?.addressMappings.get(toEntity) ||
                toEntity;
            toAddresses = [resolvedTo];
        } else {
            // Look for individual patterns
            const fromMatch = prompt.match(/from\s+([a-zA-Z0-9_\-.]+)/i);
            const toMatch = prompt.match(/to\s+([a-zA-Z0-9_\-.]+)/i);

            if (fromMatch) {
                const fromEntity = fromMatch[1];
                fromAddress =
                    context?.resolvedAddresses.get(fromEntity) ||
                    context?.addressMappings.get(fromEntity) ||
                    fromEntity;
            }

            if (toMatch) {
                const toEntity = toMatch[1];
                const resolvedTo =
                    context?.resolvedAddresses.get(toEntity) ||
                    context?.addressMappings.get(toEntity) ||
                    toEntity;
                toAddresses = [resolvedTo];
            }
        }

        // Extract amount
        const amountMatches = [
            prompt.match(/(\d+)\s+badges?/i),
            prompt.match(/transfer\s+(\d+)/i),
            prompt.match(/send\s+(\d+)/i),
            prompt.match(/amount[:\s]+(\d+)/i),
        ].find((match) => match);

        // Extract badge IDs and ranges
        const badgeRangeMatch = prompt.match(
            /badges?\s+(\d+)(?:\s*[-–]\s*(\d+))?/i
        );
        const singleBadgeMatch = prompt.match(/badge\s+(?:id\s+)?(\d+)/i);

        let badgeIds;
        if (badgeRangeMatch) {
            const start = badgeRangeMatch[1];
            const end = badgeRangeMatch[2] || start;
            badgeIds = [{ start, end }];
        } else if (singleBadgeMatch) {
            badgeIds = [
                { start: singleBadgeMatch[1], end: singleBadgeMatch[1] },
            ];
        } else {
            badgeIds = [{ start: '1', end: '1' }];
        }

        // Extract memo
        const memoMatch =
            prompt.match(/(?:memo|message|note)[:\s]+"([^"]+)"/i) ||
            prompt.match(/(?:memo|message|note)[:\s]+'([^']+)'/i) ||
            prompt.match(/"([^"]{4,})"/); // Any quoted string longer than 3 chars

        return {
            collectionId: collectionMatches ? collectionMatches[1] : '1',
            from: fromAddress,
            toAddresses: toAddresses,
            amount: amountMatches ? amountMatches[1] : '1',
            badgeIds: badgeIds,
            ownershipTimes: [
                {
                    start: '1',
                    end: '18446744073709551615', // Max uint64 - represents "forever"
                },
            ],
            memo: memoMatch ? memoMatch[1] : '',
            precalculateBalancesFromApproval: '',
            merkleProofs: [],
        };
    }

    getSchemaInfo(): any {
        if (!this.schema) {
            return { initialized: false, messageCount: 0 };
        }

        const messageInfo: any = {};
        this.schema.messages.forEach((message, name) => {
            messageInfo[name] = {
                fieldCount: message.fields.length,
                fields: message.fields.map((f) => ({
                    name: f.name,
                    type: f.type,
                    repeated: f.repeated,
                    optional: f.optional,
                })),
            };
        });

        return {
            initialized: true,
            messageCount: this.schema.messages.size,
            messages: messageInfo,
            importCount: this.schema.imports.size,
        };
    }
}
