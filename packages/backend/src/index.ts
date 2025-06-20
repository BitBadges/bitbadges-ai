import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PluginManager } from './services/pluginManager';
import { WalletService } from './services/walletService';
import { OpenAPIService } from './services/openApiService';
import { ProtoService } from './services/protoService';
import { initializeBitBadgesApi, getBitBadgesApiInfo } from './services/bitbadgesApiService';
import { ChatMessage, AgentConfig, WalletConfig, CommandResult } from './types';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3006",
    methods: ["GET", "POST"]
  }
});

const pluginManager = new PluginManager();
const walletService = WalletService.getInstance();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3006"
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.get('/api/plugins', (req, res) => {
  const plugins = pluginManager.getAllPlugins().map(plugin => ({
    name: plugin.name,
    description: plugin.description
  }));
  res.json({ plugins });
});

app.post('/api/execute', async (req, res) => {
  try {
    const { command, args } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const result = await pluginManager.executeCommand(command, args || []);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Wallet Management Routes
app.get('/api/wallet/status', async (req, res) => {
  try {
    const hasWallet = walletService.hasWallet();
    const walletExists = await walletService.walletExists();
    const walletInfo = walletService.getWalletInfo();
    
    res.json({
      hasWallet,
      walletExists,
      address: walletInfo?.address || null,
      encrypted: walletInfo?.encrypted || false,
      createdAt: walletInfo?.createdAt || null,
      lastUsed: walletInfo?.lastUsed || null
    });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get wallet status' 
    });
  }
});

app.post('/api/wallet/create', async (req, res) => {
  try {
    const config: WalletConfig = req.body;
    
    if (walletService.hasWallet()) {
      return res.status(400).json({ error: 'Wallet already exists' });
    }

    const walletInfo = await walletService.initializeWallet(config);
    
    res.json({
      success: true,
      address: walletInfo.address,
      encrypted: walletInfo.encrypted,
      createdAt: walletInfo.createdAt,
      mnemonic: config.autoGenerate ? walletInfo.mnemonic : undefined // Only return mnemonic for auto-generated
    });
  } catch (error) {
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to create wallet' 
    });
  }
});

app.post('/api/wallet/load', async (req, res) => {
  try {
    const { password } = req.body;
    
    const walletInfo = await walletService.loadWallet(password);
    
    if (!walletInfo) {
      return res.status(404).json({ error: 'No wallet found' });
    }

    res.json({
      success: true,
      address: walletInfo.address,
      encrypted: walletInfo.encrypted,
      createdAt: walletInfo.createdAt,
      lastUsed: walletInfo.lastUsed
    });
  } catch (error) {
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to load wallet' 
    });
  }
});

app.post('/api/wallet/sign', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!walletService.hasWallet()) {
      return res.status(400).json({ error: 'No wallet loaded' });
    }

    const signature = await walletService.signMessage(message);
    
    res.json({
      success: true,
      signature,
      address: walletService.getAddress()
    });
  } catch (error) {
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to sign message' 
    });
  }
});

app.delete('/api/wallet', async (req, res) => {
  try {
    await walletService.deleteWallet();
    
    res.json({
      success: true,
      message: 'Wallet deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to delete wallet' 
    });
  }
});

app.get('/api/wallet/balance/:network?', async (req, res) => {
  try {
    const network = req.params.network || 'mainnet';
    
    if (!walletService.hasWallet()) {
      return res.status(400).json({ error: 'No wallet loaded' });
    }

    // Default to Ethereum mainnet, but allow other networks
    const providerUrls: Record<string, string> = {
      mainnet: 'https://eth.llamarpc.com',
      sepolia: 'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
      polygon: 'https://polygon-rpc.com',
      bsc: 'https://bsc-dataseed1.binance.org'
    };

    const providerUrl = providerUrls[network] || providerUrls.mainnet;
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(providerUrl);
    
    const balance = await walletService.getBalance(provider);
    
    res.json({
      success: true,
      balance,
      network,
      address: walletService.getAddress()
    });
  } catch (error) {
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to get balance' 
    });
  }
});

app.get('/api/wallet/publickey', async (req, res) => {
  try {
    if (!walletService.hasWallet()) {
      return res.status(400).json({ error: 'No wallet loaded' });
    }

    const publicKey = walletService.generateBase64PublicKey();
    
    res.json({
      success: true,
      publicKey,
      address: walletService.getAddress(),
      format: 'base64'
    });
  } catch (error) {
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate public key' 
    });
  }
});

app.get('/api/wallet/account', async (req, res) => {
  try {
    if (!walletService.hasWallet()) {
      return res.status(400).json({ error: 'No wallet loaded' });
    }

    const nodeUrl = req.query.nodeUrl as string || process.env.BITBADGES_NODE_URL || 'http://localhost:1317';
    const accountInfo = await walletService.getCosmosAccountInfo(nodeUrl);
    
    res.json({
      success: true,
      ...accountInfo,
      nodeUrl
    });
  } catch (error) {
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to get account info' 
    });
  }
});

app.post('/api/wallet/broadcast', async (req, res) => {
  try {
    if (!walletService.hasWallet()) {
      return res.status(400).json({ error: 'No wallet loaded' });
    }

    const { txBody, nodeUrl, rpcUrl, maxWaitBlocks } = req.body;
    
    if (!txBody) {
      return res.status(400).json({ error: 'Transaction body is required' });
    }

    const confirmation = await walletService.broadcastTransaction(
      txBody,
      nodeUrl,
      rpcUrl,
      maxWaitBlocks || 10
    );
    
    res.json({
      success: true,
      ...confirmation,
      message: confirmation.confirmed ? 'Transaction confirmed successfully' : 'Transaction broadcasted but not confirmed'
    });
  } catch (error) {
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to broadcast transaction' 
    });
  }
});

app.get('/api/wallet/blockheight', async (req, res) => {
  try {
    const rpcUrl = req.query.rpcUrl as string || process.env.BITBADGES_RPC_URL || 'http://localhost:26657';
    const height = await walletService.getLatestBlockHeight(rpcUrl);
    
    res.json({
      success: true,
      height,
      rpcUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to get block height' 
    });
  }
});

app.get('/api/wallet/badgebalance', async (req, res) => {
  try {
    if (!walletService.hasWallet()) {
      return res.status(400).json({ error: 'No wallet loaded' });
    }

    const nodeUrl = req.query.nodeUrl as string || process.env.BITBADGES_NODE_URL || 'http://localhost:1317';
    const balance = await walletService.getBitBadgesBalance(nodeUrl);
    
    res.json({
      success: true,
      ...balance,
      nodeUrl,
      displayBalance: `${balance.badge} $BADGE`,
      rawBalance: `${balance.ubadge} ubadge`
    });
  } catch (error) {
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to get BitBadges balance' 
    });
  }
});

// BitBadges API Service Routes
app.get('/api/bitbadges/status', (req, res) => {
  try {
    const apiInfo = getBitBadgesApiInfo();
    
    res.json({
      success: true,
      ...apiInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get BitBadges API status'
    });
  }
});

// Socket.IO for real-time chat
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    console.log(`Client ${socket.id} joined room ${roomId}`);
  });

  socket.on('chat-message', async (data: { 
    message: ChatMessage, 
    roomId: string,
    config?: AgentConfig 
  }) => {
    try {
      console.log('Received message:', data.message.content);
      
      // Echo the user message to all clients in the room
      io.to(data.roomId).emit('chat-message', data.message);

      // Process the message and check for commands
      const response = await processMessage(data.message, data.config);
      
      // Send AI response
      io.to(data.roomId).emit('chat-message', response);
    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorResponse: ChatMessage = {
        id: Date.now().toString(),
        content: 'Sorry, I encountered an error processing your message.',
        role: 'assistant',
        timestamp: new Date(),
        metadata: { error: true }
      };
      
      io.to(data.roomId).emit('chat-message', errorResponse);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

function parseCommandArgs(argsString: string): any[] {
  const trimmed = argsString.trim();
  
  console.log('Parsing command args:', trimmed);
  
  // Look for JSON anywhere in the string
  const jsonMatch = trimmed.match(/(\{.*\}|\[.*\])/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      console.log('Successfully parsed JSON:', parsed);
      
      // Split the args string to get the action and the JSON
      const parts = trimmed.split(/(\{.*\}|\[.*\])/);
      const action = parts[0].trim();
      
      if (action) {
        return [action, parsed];
      } else {
        return [parsed];
      }
    } catch (error) {
      console.warn('Failed to parse JSON:', error);
    }
  }
  
  // Try to parse as complete JSON first - look for complete JSON objects/arrays
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      console.log('Successfully parsed complete JSON:', parsed);
      return [parsed];
    } catch (error) {
      console.warn('Failed to parse JSON object:', error);
    }
  } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      console.log('Successfully parsed complete JSON array:', parsed);
      return [parsed];
    } catch (error) {
      console.warn('Failed to parse JSON array:', error);
    }
  }
  
  // Handle quoted strings and space-separated args
  const args: string[] = [];
  let currentArg = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    
    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = '';
    } else if (!inQuotes && char === ' ') {
      if (currentArg.length > 0) {
        args.push(currentArg);
        currentArg = '';
      }
    } else {
      currentArg += char;
    }
  }
  
  if (currentArg.length > 0) {
    args.push(currentArg);
  }
  
  return args;
}

function formatPluginResponse(command: string, result: CommandResult): string {
  // Handle special formatting for different plugins
  switch (command) {
    case 'docs':
      return formatDocsResponse(result);
    case 'proto':
      return formatProtoResponse(result);
    case 'wallet':
      return formatWalletResponse(result);
    default:
      return formatGenericResponse(result);
  }
}

function formatDocsResponse(result: CommandResult): string {
  if (!result.data) {
    return 'Command executed successfully.';
  }

  const data = result.data;

  // Handle documentation question answers
  if (data.answer && data.question) {
    let response = `**Question:** ${data.question}\n\n`;
    response += `**Answer:**\n${data.answer}\n\n`;
    
    if (data.method) {
      const methodText = data.method === 'ai-search' ? 'AI-powered search' : 'Keyword search';
      response += `*Answered using ${methodText}`;
      if (data.relevantChunks) {
        response += ` (${data.relevantChunks} relevant sections analyzed)`;
      }
      response += '*\n';
    }
    
    if (data.sources) {
      response += `\n*${data.sources}*`;
    }
    
    return response;
  }

  // Handle documentation status/fetch responses
  if (data.documentationAvailable !== undefined) {
    let response = '**Documentation Service Status**\n\n';
    response += `📚 Documentation: ${data.documentationAvailable ? '✅ Available' : '❌ Unavailable'}\n`;
    if (data.aiEnabled !== undefined) {
      response += `🤖 AI Features: ${data.aiEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
    }
    if (data.source) {
      response += `🔗 Source: ${data.source}\n`;
    }
    
    if (data.capabilities) {
      response += '\n**Capabilities:**\n';
      Object.entries(data.capabilities).forEach(([feature, enabled]) => {
        response += `- ${feature}: ${enabled ? '✅' : '❌'}\n`;
      });
    }
    
    if (result.logs && result.logs.length > 0) {
      response += `\n**Status:** ${result.logs.join(' • ')}`;
    }
    
    return response;
  }

  // Handle documentation fetch responses
  if (data.size) {
    let response = '**BitBadges Documentation Statistics**\n\n';
    response += `📄 Characters: ${data.size.characters.toLocaleString()}\n`;
    response += `📝 Words: ${data.size.words.toLocaleString()}\n`;
    response += `🔤 Estimated Tokens: ${data.size.estimatedTokens.toLocaleString()}\n`;
    if (data.source) {
      response += `🔗 Source: ${data.source}\n`;
    }
    if (data.preview) {
      response += `\n**Preview:**\n${data.preview}`;
    }
    return response;
  }

  return formatGenericResponse(result);
}

function formatProtoResponse(result: CommandResult): string {
  if (!result.data) {
    return 'Command executed successfully.';
  }

  const data = result.data;

  // Handle transaction generation/broadcast/simulation responses
  if (data.generatedMessage) {
    let response = '';
    
    if (data.prompt) {
      response += `**Original Prompt:** ${data.prompt}\n\n`;
    }
    
    if (data.processedPrompt && data.processedPrompt !== data.prompt) {
      response += `**Processed Prompt:** ${data.processedPrompt}\n\n`;
    }
    
    if (data.generatedMessage.summary) {
      response += `**Transaction Summary:**\n${data.generatedMessage.summary}\n\n`;
    }
    
    // Handle simulation results
    if (data.simulation) {
      response += `**🧪 Simulation Results:**\n`;
      response += `- Status: ${data.simulation.valid ? '✅ Valid' : '❌ Invalid'}\n`;
      response += `- Gas Used: ${data.simulation.gasUsed.toLocaleString()}\n`;
      response += `- Recommended Gas: ${data.simulation.recommendedGas.toLocaleString()} (includes ${Math.round((data.simulation.gasBuffer / data.simulation.gasUsed) * 100)}% buffer)\n`;
      response += `- Estimated Cost: ${data.simulation.estimatedCost}\n`;
      response += `- Node: ${data.simulation.nodeUrl}\n\n`;
      
      if (data.simulation.simulationResult.log) {
        response += `**Simulation Log:**\n\`\`\`\n${data.simulation.simulationResult.log}\n\`\`\`\n\n`;
      }
    }
    
    // Handle broadcast results
    if (data.transaction) {
      response += `**📡 Transaction Status:**\n`;
      response += `- Status: ${data.transaction.status}\n`;
      if (data.transaction.broadcast) {
        response += `- Transaction Hash: \`${data.transaction.broadcast.txhash}\`\n`;
        response += `- Block Height: ${data.transaction.broadcast.height}\n`;
        response += `- Gas Used: ${data.transaction.broadcast.gasUsed}/${data.transaction.broadcast.gasWanted}\n`;
      }
      response += '\n';
    }
    
    if (data.context && Object.keys(data.context.addressMappings || {}).length > 0) {
      response += `**🔄 Address Resolutions:**\n`;
      Object.entries(data.context.addressMappings).forEach(([from, to]) => {
        response += `- ${from} → ${to}\n`;
      });
      response += '\n';
    }
    
    if (data.generatedMessage.breakdown) {
      response += `**📋 Transaction Details:**\n\`\`\`json\n${JSON.stringify(data.generatedMessage.breakdown, null, 2)}\n\`\`\`\n\n`;
    }
    
    if (result.logs && result.logs.length > 0) {
      response += `**📝 Processing Log:**\n${result.logs.join('\n')}`;
    }
    
    return response;
  }

  return formatGenericResponse(result);
}

function formatWalletResponse(result: CommandResult): string {
  if (!result.data) {
    return formatGenericResponse(result);
  }

  const data = result.data;
  
  // Handle balance responses
  if (data.displayBalance && data.badge !== undefined) {
    let response = '**💰 BitBadges Balance**\n\n';
    response += `🏦 **Balance:** ${data.displayBalance || `${data.badge} $BADGE`}\n`;
    response += `📝 **Raw Balance:** ${data.rawBalance || `${data.ubadge} ubadge`}\n`;
    response += `📍 **Address:** \`${data.address}\`\n`;
    
    if (data.nodeUrl) {
      response += `🔗 **Node:** ${data.nodeUrl}\n`;
    }
    
    return response;
  }
  
  // For other wallet responses, use generic formatting
  return formatGenericResponse(result);
}

function formatGenericResponse(result: CommandResult): string {
  let responseContent = 'Command executed successfully:\n\n';
  
  if (result.data) {
    responseContent += `**Result:**\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`\n\n`;
  }
  
  if (result.logs && result.logs.length > 0) {
    responseContent += `**Logs:**\n${result.logs.join('\n')}`;
  }
  
  return responseContent;
}

async function processMessage(message: ChatMessage, config?: AgentConfig): Promise<ChatMessage> {
  // Simple command parsing - look for /command syntax
  const commandRegex = /^\/(\w+)\s*(.*)/;
  const match = message.content.match(commandRegex);
  
  if (match) {
    const [, command, argsString] = match;
    
    try {
      // Parse arguments - handle JSON or space-separated
      const args = argsString ? parseCommandArgs(argsString) : [];
      
      // Execute the command
      const result = await pluginManager.executeCommand(command, args);
      
      let responseContent = '';
      if (result.success) {
        // Handle special formatting for different plugins
        responseContent = formatPluginResponse(command, result);
      } else {
        responseContent = `Command failed: ${result.error}`;
      }
      
      return {
        id: Date.now().toString(),
        content: responseContent,
        role: 'assistant',
        timestamp: new Date(),
        metadata: { 
          command: true, 
          commandName: command,
          commandResult: result 
        }
      };
    } catch (error) {
      return {
        id: Date.now().toString(),
        content: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: 'assistant',
        timestamp: new Date(),
        metadata: { error: true, command: true }
      };
    }
  }

  // For non-command messages, return a simple AI response
  // In a real implementation, you would integrate with an AI service like OpenAI
  return {
    id: Date.now().toString(),
    content: `I received your message: "${message.content}"\n\nI'm a BitBadges AI agent with my own Ethereum wallet and full BitBadges API access! You can use commands like:\n\n**Wallet Commands:**\n- \`/wallet status\` - Check wallet status\n- \`/wallet address\` - Get my wallet address\n- \`/wallet balance\` - Check $BADGE balance on BitBadges blockchain\n- \`/wallet publickey\` - Generate base64 public key\n- \`/wallet account\` - Get BitBadges account info (number/sequence)\n- \`/wallet sign {"message": "Hello"}\` - Sign a message\n- \`/wallet broadcast {"txBody": {...}}\` - Broadcast transaction to blockchain\n- \`/wallet blockheight\` - Get latest block height\n\n**BitBadges API Commands:**\n- \`/bitbadges endpoints\` - List all available BitBadges endpoints\n- \`/bitbadges search {"query": "user"}\` - Search for specific endpoints\n- \`/bitbadges getUser {"address": "cosmos1..."}\` - Get user profile (legacy)\n- \`/bitbadges call {"operationId": "getUserByAddress", "pathParams": {"address": "cosmos1..."}}\` - Call any BitBadges endpoint\n\n**Transaction Generation:**\n- \`/proto status\` - Check proto service status\n- \`/proto schema {"message": "MsgTransferBadges"}\` - Get message schema\n- \`/proto transfer {"prompt": "Transfer 5 badges from alice to bob in collection 123"}\` - Generate transaction from natural language\n- \`/proto simulate {"prompt": "Transfer 5 badges from alice to bob in collection 123"}\` - Generate and simulate transaction (no broadcast)\n- \`/proto broadcast {"prompt": "Transfer 5 badges from alice to bob in collection 123"}\` - Generate and broadcast transaction\n\n**Documentation:**\n- \`/docs ask {"question": "How do I create a collection?"}\` - Ask questions about BitBadges documentation\n- \`/docs status\` - Check documentation service status\n- \`/docs fetch\` - Get documentation statistics\n\nType \`/bitbadges endpoints\` to see all ${OpenAPIService.getInstance().isInitialized() ? OpenAPIService.getInstance().getEndpoints().length + ' available ' : ''}BitBadges API endpoints!`,
    role: 'assistant',
    timestamp: new Date(),
    metadata: { aiGenerated: true }
  };
}

// Initialize services on startup
async function initializeServer() {
  try {
    // Initialize services in parallel for better performance
    const initPromises = [];

    // Initialize BitBadges API service first
    initializeBitBadgesApi();

    // Initialize OpenAPI service for BitBadges
    const bitbadgesOpenApiUrl = 'https://raw.githubusercontent.com/BitBadges/bitbadgesjs/main/packages/bitbadgesjs-sdk/openapi/combined_processed.yaml';
    const openApiService = OpenAPIService.getInstance(bitbadgesOpenApiUrl);
    initPromises.push(openApiService.initialize());
    
    // Initialize Proto service for transaction generation
    const protoService = ProtoService.getInstance();
    initPromises.push(protoService.initialize());

    // Wait for both services to initialize
    await Promise.all(initPromises);
    
    // Initialize wallet (if exists)
    if (await walletService.walletExists()) {
      try {
        await walletService.loadWallet();
        console.log('Wallet loaded successfully on startup');
      } catch (error) {
        console.log('Wallet exists but requires password to load');
      }
    }
  } catch (error) {
    console.error('Error initializing services:', error);
  }

  server.listen(PORT, () => {
    console.log(`BitBadges AI Backend running on port ${PORT}`);
    console.log(`Available plugins: ${pluginManager.getAvailableCommands().join(', ')}`);
    if (walletService.hasWallet()) {
      console.log(`Wallet address: ${walletService.getAddress()}`);
    }
    
    const openApiService = OpenAPIService.getInstance();
    if (openApiService.isInitialized()) {
      console.log(`BitBadges OpenAPI loaded with ${openApiService.getEndpoints().length} endpoints`);
    }
  });
}

initializeServer();