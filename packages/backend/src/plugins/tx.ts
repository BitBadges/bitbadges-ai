import {
    badges,
    convertToBitBadgesAddress,
    createTransactionPayload,
    createTxBroadcastBody,
    Numberify,
    proto,
    TxContext,
} from 'bitbadgesjs-sdk';
import { getBitBadgesApi } from '../services/bitbadgesApiService';
import { ProtoService } from '../services/protoService';
import {
    getCurrentNodeUrl,
    getCurrentRpcUrl,
    getEffectiveCreatorAddress,
} from '../services/settingsService';
import { WalletService } from '../services/walletService';
import { CommandResult } from '../types';

export const txPlugin = {
    name: 'tx',
    description:
        'Generate BitBadges transaction messages from natural language prompts using proto schemas',

    async execute(args: any[]): Promise<CommandResult> {
        console.log('Tx plugin received args:', args);

        if (args.length === 0) {
            return {
                success: false,
                error: 'Proto command requires action. Available actions: status, schema, transfer, generate, broadcast',
            };
        }

        let action: string;
        let params: any = {};

        // Handle different argument patterns
        if (args.length === 1) {
            if (typeof args[0] === 'string') {
                action = args[0];
            } else if (typeof args[0] === 'object') {
                // If only one arg and it's an object, assume it's a direct action call
                return {
                    success: false,
                    error: 'Action is required. Available actions: status, schema, transfer, generate',
                };
            } else {
                action = args[0];
            }
        } else {
            action = args[0];
            params = args[1] || {};
        }

        const protoService = ProtoService.getInstance();

        try {
            switch (action) {
                case 'status':
                    return await this.getStatus(protoService);

                case 'schema':
                    return await this.getSchema(protoService, params);

                case 'broadcast':
                    return await this.generateAndBroadcast(
                        protoService,
                        params
                    );

                case 'simulate':
                    return await this.generateAndSimulate(protoService, params);

                default:
                    return {
                        success: false,
                        error: `Unknown proto action: ${action}. Available actions: status, schema, transfer, generate, broadcast, simulate`,
                    };
            }
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Proto operation failed',
            };
        }
    },

    async getStatus(protoService: ProtoService): Promise<CommandResult> {
        const schemaInfo = protoService.getSchemaInfo();

        return {
            success: true,
            data: {
                ...schemaInfo,
                available: protoService.isInitialized(),
            },
            logs: [
                `Proto service ${
                    schemaInfo.initialized ? 'initialized' : 'not initialized'
                }`,
                `Messages loaded: ${schemaInfo.messageCount || 0}`,
            ],
        };
    },

    async getSchema(
        protoService: ProtoService,
        params: any
    ): Promise<CommandResult> {
        if (!protoService.isInitialized()) {
            return {
                success: false,
                error: 'Proto service not initialized. Please wait for startup to complete.',
            };
        }

        const { message } = params;

        if (message) {
            // Get specific message schema
            const allMessages = protoService.getAllMessages();
            const messageSchema = allMessages.get(message);

            if (!messageSchema) {
                return {
                    success: false,
                    error: `Message '${message}' not found. Available messages: ${Array.from(
                        allMessages.keys()
                    ).join(', ')}`,
                };
            }

            return {
                success: true,
                data: {
                    message: messageSchema.name,
                    fields: messageSchema.fields,
                    imports: messageSchema.imports,
                    description: messageSchema.description,
                },
                logs: [`Retrieved schema for ${message}`],
            };
        } else {
            // Get all available messages
            const schemaInfo = protoService.getSchemaInfo();
            return {
                success: true,
                data: schemaInfo,
                logs: [
                    `Retrieved all proto schemas (${schemaInfo.messageCount} messages)`,
                ],
            };
        }
    },

    async generateAndBroadcast(
        protoService: ProtoService,
        params: any
    ): Promise<CommandResult> {
        if (!protoService.isInitialized()) {
            return {
                success: false,
                error: 'Proto service not initialized. Please wait for startup to complete.',
            };
        }

        // Debug logging
        console.log('Proto broadcast params:', JSON.stringify(params, null, 2));

        // Handle both direct string and object with prompt property
        let prompt: string;
        if (typeof params === 'string') {
            prompt = params;
        } else if (params && typeof params === 'object' && params.prompt) {
            prompt = params.prompt;
        } else {
            return {
                success: false,
                error: `Prompt is required for broadcasting. Received params: ${JSON.stringify(
                    params
                )}. Example: "Transfer 5 badges from bb1a to bb1k in collection 123"`,
            };
        }

        const walletService = WalletService.getInstance();

        if (!walletService.hasWallet()) {
            return {
                success: false,
                error: 'No wallet loaded. Please set up a wallet first to broadcast transactions.',
            };
        }

        try {
            // Step 1: Generate the transaction message with context
            console.log(
                'Step 1: Generating transaction from prompt with context resolution...'
            );
            const result =
                await protoService.generateMsgTransferBadgesFromPrompt(
                    prompt,
                    walletService
                );

            // Extract the transfer message and context from the result
            const transferMsg = result.transferMsg || result;
            const context = result.context;

            // Step 2: Convert proto message to Cosmos transaction body format
            console.log('Step 2: Converting to transaction body...');
            const txBody = await this.convertProtoToTxBody(
                transferMsg,
                walletService
            );

            // Step 3: Broadcast the transaction
            console.log('Step 3: Broadcasting transaction...');
            const nodeUrl = params.nodeUrl || getCurrentNodeUrl();
            const rpcUrl = params.rpcUrl || getCurrentRpcUrl();
            const maxWaitBlocks = params.maxWaitBlocks || 10;

            const confirmation = await walletService.broadcastTransaction(
                txBody,
                nodeUrl,
                rpcUrl,
                maxWaitBlocks
            );

            const logs = [
                `Generated MsgTransferBadges from prompt: "${prompt}"`,
                `Transaction hash: ${confirmation.txhash}`,
                `Block height: ${confirmation.height}`,
                `Gas used: ${confirmation.gasUsed}/${confirmation.gasWanted}`,
                `Status: ${confirmation.confirmed ? 'Confirmed' : 'Pending'}`,
            ];

            // Add context resolution logs if available
            if (context) {
                if (context.addressMappings.size > 0) {
                    logs.unshift(
                        `Resolved ${
                            context.addressMappings.size
                        } address(es): ${(
                            Array.from(
                                context.addressMappings.entries() as any
                            ) as any
                        )
                            .map(([from, to]: [any, any]) => `${from} → ${to}`)
                            .join(', ')}`
                    );
                }
                if (
                    context.metadata.processedPrompt !==
                    context.metadata.originalPrompt
                ) {
                    logs.unshift(
                        `Processed prompt: "${context.metadata.processedPrompt}"`
                    );
                }
            }

            return {
                success: true,
                data: {
                    prompt,
                    processedPrompt:
                        context?.metadata.processedPrompt || prompt,
                    messageType: 'MsgTransferBadges',
                    typeUrl: transferMsg.typeUrl,
                    generatedMessage: {
                        summary: this.formatMessageSummary(transferMsg),
                        fullMessage: transferMsg,
                        breakdown: this.formatMessageBreakdown(transferMsg),
                    },
                    transaction: {
                        txBody: txBody,
                        broadcast: confirmation,
                        status: confirmation.confirmed
                            ? 'Confirmed'
                            : 'Pending',
                    },
                    context: context
                        ? {
                              resolvedAddresses: Object.fromEntries(
                                  context.resolvedAddresses
                              ),
                              addressMappings: Object.fromEntries(
                                  context.addressMappings
                              ),
                              userProfiles: Object.fromEntries(
                                  context.userProfiles
                              ),
                              collectionInfo: Object.fromEntries(
                                  context.collectionInfo
                              ),
                              agentWallet: context.agentWallet,
                              specialAddresses: context.specialAddresses,
                              timestamp: context.metadata.timestamp,
                          }
                        : null,
                    message: confirmation.confirmed
                        ? 'Transaction generated and broadcasted successfully!'
                        : 'Transaction generated and broadcasted but not yet confirmed',
                },
                logs,
            };
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to generate and broadcast transaction',
            };
        }
    },

    async generateAndSimulate(
        protoService: ProtoService,
        params: any
    ): Promise<CommandResult> {
        if (!protoService.isInitialized()) {
            return {
                success: false,
                error: 'Proto service not initialized. Please wait for startup to complete.',
            };
        }

        // Debug logging
        console.log('Proto simulate params:', JSON.stringify(params, null, 2));

        // Handle both direct string and object with prompt property
        let prompt: string;
        if (typeof params === 'string') {
            prompt = params;
        } else if (params && typeof params === 'object' && params.prompt) {
            prompt = params.prompt;
        } else {
            return {
                success: false,
                error: `Prompt is required for simulation. Received params: ${JSON.stringify(
                    params
                )}. Example: "Transfer 5 badges from bb1a to bb1k in collection 123"`,
            };
        }

        const walletService = WalletService.getInstance();

        if (!walletService.hasWallet()) {
            return {
                success: false,
                error: 'No wallet loaded. Please set up a wallet first to simulate transactions.',
            };
        }

        try {
            // Step 1: Generate the transaction message with context
            console.log(
                'Step 1: Generating transaction from prompt with context resolution...'
            );
            const result =
                await protoService.generateMsgTransferBadgesFromPrompt(
                    prompt,
                    walletService
                );

            // Extract the transfer message and context from the result
            const transferMsg = result.transferMsg || result;
            const context = result.context;

            // Step 2: Convert proto message to Cosmos transaction body
            console.log('Step 2: Converting to transaction body...');
            const txBody = await this.convertProtoToTxBody(
                transferMsg,
                walletService
            );

            // Step 3: Simulate the transaction only (no broadcast)
            console.log('Step 3: Simulating transaction...');
            const nodeUrl = params.nodeUrl || getCurrentNodeUrl();

            const simulationResponse = await this.simulateTransaction(
                txBody,
                nodeUrl
            );

            // Calculate gas and cost estimates
            const estimatedGas = parseInt(simulationResponse.gasInfo.gasUsed);
            const gasBuffer = Math.max(estimatedGas * 0.3, 100000);
            const recommendedGas = Math.ceil(estimatedGas + gasBuffer);

            // Get gas price for cost calculation
            let gasCost = 'Unknown';
            try {
                const bitbadgesApi = getBitBadgesApi();
                const statusRes = await bitbadgesApi.getStatus();
                const gasPrice = statusRes.status.gasPrice;

                const costInUbadge = Math.ceil(recommendedGas * gasPrice);
                const costInBadge = (costInUbadge / 1e9).toFixed(9);
                gasCost = `${costInUbadge} ubadge (${costInBadge} $BADGE)`;
            } catch (error) {
                throw new Error(
                    'Failed to get gas price for cost estimation: ' + error
                );
            }

            const logs = [
                `Generated MsgTransferBadges from prompt: "${prompt}"`,
                `Simulation successful - transaction is valid`,
                `Gas used: ${estimatedGas}`,
                `Recommended gas: ${recommendedGas} (includes 30% buffer)`,
                `Estimated cost: ${gasCost}`,
            ];

            // Add context resolution logs if available
            if (context) {
                if (context.addressMappings.size > 0) {
                    logs.unshift(
                        `Resolved ${
                            context.addressMappings.size
                        } address(es): ${(
                            Array.from(
                                context.addressMappings.entries() as any
                            ) as any
                        )
                            .map(([from, to]: [any, any]) => `${from} → ${to}`)
                            .join(', ')}`
                    );
                }
                if (
                    context.metadata.processedPrompt !==
                    context.metadata.originalPrompt
                ) {
                    logs.unshift(
                        `Processed prompt: "${context.metadata.processedPrompt}"`
                    );
                }
            }

            return {
                success: true,
                data: {
                    prompt,
                    processedPrompt:
                        context?.metadata.processedPrompt || prompt,
                    messageType: 'MsgTransferBadges',
                    typeUrl: transferMsg.typeUrl,
                    generatedMessage: {
                        summary: this.formatMessageSummary(transferMsg),
                        fullMessage: transferMsg,
                        breakdown: this.formatMessageBreakdown(transferMsg),
                    },
                    simulation: {
                        valid: true,
                        gasUsed: estimatedGas,
                        gasWanted: simulationResponse.gasInfo.gasWanted,
                        recommendedGas: recommendedGas,
                        gasBuffer: gasBuffer,
                        estimatedCost: gasCost,
                        nodeUrl: nodeUrl,
                        simulationResult: simulationResponse.result,
                    },
                    context: context
                        ? {
                              resolvedAddresses: Object.fromEntries(
                                  context.resolvedAddresses
                              ),
                              addressMappings: Object.fromEntries(
                                  context.addressMappings
                              ),
                              userProfiles: Object.fromEntries(
                                  context.userProfiles
                              ),
                              collectionInfo: Object.fromEntries(
                                  context.collectionInfo
                              ),
                              agentWallet: context.agentWallet,
                              specialAddresses: context.specialAddresses,
                              timestamp: context.metadata.timestamp,
                          }
                        : null,
                    message:
                        'Transaction generated and simulated successfully! Ready for broadcast.',
                },
                logs,
            };
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to generate and simulate transaction',
            };
        }
    },

    async convertProtoToTxBody(
        transferMsg: any,
        walletService: WalletService
    ): Promise<any> {
        console.log('Converting proto message to transaction body...');
        console.log('Proto message:', JSON.stringify(transferMsg, null, 2));

        // Get account info for transaction
        const accountInfo = await walletService.getCosmosAccountInfo();

        try {
            // Get the effective creator address (user setting or AI agent wallet)
            const defaultCreatorAddress = convertToBitBadgesAddress(
                accountInfo.ethereumAddress
            );
            const effectiveCreatorAddress =
                getEffectiveCreatorAddress(defaultCreatorAddress) ||
                defaultCreatorAddress;

            const isCustomCreatorAddress =
                effectiveCreatorAddress !== defaultCreatorAddress;

            console.log('Using creator address:', effectiveCreatorAddress);
            let sender = {
                address: accountInfo.ethereumAddress,
                sequence: Numberify(accountInfo.sequence),
                accountNumber: Numberify(accountInfo.accountNumber),
                pubkey: accountInfo.base64PubKey,
                publicKey: accountInfo.base64PubKey,
            };

            const msgs = [];
            if (isCustomCreatorAddress) {
                console.log('CUSTOM AUTHZ');
                msgs.push(
                    new proto.cosmos.authz.v1beta1.MsgExec({
                        grantee: convertToBitBadgesAddress(
                            defaultCreatorAddress
                        ),
                        msgs: [
                            new badges.MsgTransferBadges({
                                creator: effectiveCreatorAddress,
                                ...transferMsg.value,
                                creatorOverride: '',
                            }),
                        ].map((msg) => {
                            const MsgType = msg.constructor as any;
                            const typeUrl = `/${MsgType.typeName}`;

                            return {
                                typeUrl,
                                value: msg.toBinary(),
                            };
                        }),
                    })
                );
            } else {
                msgs.push(
                    new badges.MsgTransferBadges({
                        creator: effectiveCreatorAddress,
                        ...transferMsg.value,
                        creatorOverride: '',
                    })
                );
            }

            // Step 1: Create transaction with high gas limit for simulation
            console.log('Step 1: Creating transaction for gas estimation...');
            const simulationTxContext: TxContext = {
                testnet: false,
                sender: sender,
                memo: '',
                fee: { denom: 'ubadge', amount: '0', gas: '50000000' }, // High gas for simulation
            };

            const simulationTxn = createTransactionPayload(
                simulationTxContext,
                msgs
            );
            if (!simulationTxn.txnString)
                throw new Error(
                    'No transaction string generated for simulation'
                );

            const simulationSig = await walletService.signMessage(
                simulationTxn.txnString
            );
            const simulationRawTx = createTxBroadcastBody(
                simulationTxContext,
                msgs,
                simulationSig
            );

            // Step 2: Simulate the transaction to get gas estimate
            console.log('Step 2: Simulating transaction to estimate gas...');
            const nodeUrl = getCurrentNodeUrl();
            const simulationResponse = await this.simulateTransaction(
                simulationRawTx,
                nodeUrl
            );

            const estimatedGas = parseInt(simulationResponse.gasInfo.gasUsed);
            const gasBuffer = Math.max(estimatedGas * 0.3, 100000); // 30% buffer or 100k minimum
            const finalGas = Math.ceil(estimatedGas + gasBuffer);

            console.log(
                `Gas estimation: used=${estimatedGas}, buffer=${gasBuffer}, final=${finalGas}`
            );

            const statusRes = await getBitBadgesApi().getStatus();
            const gasPrice = statusRes.status.gasPrice;
            const amount = Math.ceil(finalGas * gasPrice);

            // Step 3: Create final transaction with estimated gas
            console.log(
                'Step 3: Creating final transaction with estimated gas...'
            );
            const finalTxContext: TxContext = {
                testnet: false,
                sender: sender,
                memo: '',
                fee: {
                    denom: 'ubadge',
                    amount: Math.ceil(amount).toString(),
                    gas: finalGas.toString(),
                },
            };

            const finalTxn = createTransactionPayload(finalTxContext, msgs);
            if (!finalTxn.txnString)
                throw new Error(
                    'No transaction string generated for final transaction'
                );

            const finalSig = await walletService.signMessage(
                finalTxn.txnString
            );
            const finalRawTx = createTxBroadcastBody(
                finalTxContext,
                msgs,
                finalSig
            );

            console.log(`Transaction created with optimized gas: ${finalGas}`);
            return finalRawTx;
        } catch (error) {
            console.error(
                'Error converting proto message to transaction body:',
                error
            );
            throw error;
        }
    },

    async simulateTransaction(txBody: any, nodeUrl: string): Promise<any> {
        const axios = require('axios');
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
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                const errorMsg =
                    error.response?.data?.message ||
                    error.response?.data?.error ||
                    error.message;
                throw new Error(`Transaction simulation failed: ${errorMsg}`);
            }
            throw error;
        }
    },

    formatMessageSummary(transferMsg: any): string {
        try {
            const msg = transferMsg.value || transferMsg;
            const transfer = msg.transfers?.[0];

            if (!transfer) {
                return 'Transfer message (unable to parse details)';
            }

            const fromAddr = transfer.from || 'Unknown';
            const toAddresses = transfer.toAddresses || [];
            const toAddr = toAddresses[0] || 'Unknown';
            const balance = transfer.balances?.[0];
            const amount = balance?.amount || '0';
            const badgeIds = balance?.badgeIds?.[0];
            const badgeRange = badgeIds
                ? badgeIds.start === badgeIds.end
                    ? `#${badgeIds.start}`
                    : `#${badgeIds.start}-${badgeIds.end}`
                : 'Unknown';
            const collectionId = msg.collectionId || 'Unknown';
            const approvals = transfer.prioritizedApprovals || [];
            const approvalInfo =
                approvals.length > 0
                    ? ` (${approvals.length} approval${
                          approvals.length > 1 ? 's' : ''
                      })`
                    : '';

            return `Transfer ${amount} badges ${badgeRange} from ${this.shortenAddress(
                fromAddr
            )} to ${this.shortenAddress(
                toAddr
            )} in collection ${collectionId}${approvalInfo}`;
        } catch (error) {
            return 'Transfer message (parsing error)';
        }
    },

    formatMessageBreakdown(transferMsg: any): any {
        try {
            const msg = transferMsg.value || transferMsg;
            const transfer = msg.transfers?.[0];

            return {
                messageType: transferMsg.typeUrl || '/badges.MsgTransferBadges',
                creator: transferMsg.creator,
                collectionId: msg.collectionId,
                transferDetails: {
                    from: transfer?.from,
                    toAddresses: transfer?.toAddresses,
                    balances: transfer?.balances?.map((balance: any) => ({
                        amount: balance.amount,
                        badgeIds: balance.badgeIds,
                        ownershipTimes: balance.ownershipTimes,
                    })),
                    memo: transfer?.memo || '',
                    precalculateBalancesFromApproval:
                        transfer?.precalculateBalancesFromApproval || '',
                    merkleProofs: transfer?.merkleProofs || [],
                    prioritizedApprovals: transfer?.prioritizedApprovals || [],
                    affiliateAddress: transfer?.affiliateAddress || '',
                },
            };
        } catch (error) {
            return {
                messageType: transferMsg.typeUrl || '/badges.MsgTransferBadges',
                error: 'Unable to parse message breakdown',
                rawMessage: transferMsg,
            };
        }
    },

    shortenAddress(address: string): string {
        if (!address || address.length <= 12) {
            return address;
        }

        // Special addresses
        if (address === 'Mint') {
            return '🏛️ Mint';
        }

        // Shorten long addresses
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    },
};
