# BitBadges AI Agent

A quickstarter/boilerplate for an autonomous AI agent for interacting with the BitBadges blockchain. This monorepo contains a React frontend and Node.js backend with WebSocket support for real-time chat interactions.

> **💡 Important Note**: This repository is a quickstarter/boilerplate and is **not production-ready**. The chat interface provided is primarily for development, testing, and demonstration purposes. For production use, you'll typically want to implement autonomous behavior by directly interfacing with the backend services. This codebase is designed to be highly customizable - we've intentionally left many aspects open-ended so you can build the specific autonomous behaviors and integrations that fit your use case.

## Features

-   **AI Agent Wallet**: Autonomous Ethereum wallet for blockchain interactions
-   **Natural Language Transactions**: Generate and execute BitBadges transactions from plain English
-   **Real-time Chat Interface**: WebSocket-based communication with the AI agent
-   **BitBadges API Integration**: Full access to BitBadges API endpoints and documentation
-   **Transaction Simulation**: Test transactions before broadcasting to the blockchain
-   **Wallet Management**: Create, load, and manage encrypted wallets
-   **Plugin System**: Extensible command system for wallet, transaction, and API operations

## Architecture

### Monorepo Structure

```
packages/
├── backend/           # Express server with Socket.IO
│   ├── src/
│   │   ├── plugins/   # Command plugins (wallet, tx, bitbadges)
│   │   └── services/  # Core services (wallet, proto, settings)
│   └── data/          # Proto schemas and cached data
└── frontend/          # React app with Vite
    └── src/
        ├── components/  # UI components
        └── services/    # API and socket services
```

### Key Components

-   **Backend**: Express server with Socket.IO for real-time communication
-   **Frontend**: React 18 with TypeScript and Tailwind CSS
-   **Plugin System**: Modular commands using `/command` syntax
-   **Wallet Service**: Ethereum wallet management with BitBadges integration
-   **Proto Service**: Transaction generation from natural language
-   **Settings Service**: Configuration management for API keys and addresses

## Prerequisites

-   **Node.js** >= 18.0.0
-   **npm** >= 9.0.0
-   **BitBadges account** (for API access and funding)

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd bitbadges-ai

# Install dependencies
npm install
```

### 2. Environment Setup

Copy the example environment files and configure them:

```bash
# Backend environment
cp packages/backend/.env.example packages/backend/.env

# Frontend environment
cp packages/frontend/.env.example packages/frontend/.env
```

Configure your environment variables:

**Backend (`packages/backend/.env`)**:

```env
# BitBadges API Configuration
BITBADGES_API_URL=http://localhost:3001
BITBADGES_NODE_URL=http://localhost:1317
BITBADGES_RPC_URL=http://localhost:26657
BITBADGES_API_KEY=your_bitbadges_api_key_here

# Server Configuration
PORT=3005
CLIENT_URL=http://localhost:3006
```

**Frontend (`packages/frontend/.env`)**:

```env
VITE_API_URL=http://localhost:3005/api
```

### 3. Development

Start both frontend and backend in development mode:

```bash
npm run dev
```

Or start them individually:

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

### 4. Access the Application

-   **Frontend**: http://localhost:3006
-   **Backend API**: http://localhost:3005
-   **Health Check**: http://localhost:3005/health

## Setting Up Your AI Agent

### 1. Create an AI Agent Wallet

1. Open the application in your browser
2. Click the sidebar toggle (☰) to open the configuration panel
3. Navigate to the **Wallet** tab
4. Click **Create Wallet** and choose your setup method:
    - **Auto-Generate**: Let the system create a new wallet
    - **Enter Seed Phrase**: Use an existing mnemonic
5. Optionally encrypt with a password for additional security
6. **Save your mnemonic phrase safely** - you won't see it again!

### 2. Fund Your AI Agent Wallet

The AI agent needs $BADGE credits to pay for transaction fees:

1. Copy your agent's wallet address from the Wallet tab
2. Visit [bitbadges.io](https://bitbadges.io)
3. Send $BADGE credits to your agent's address
4. Return to the app - the funding info will disappear once balance > 0

### 3. Configure API Access (Optional)

For enhanced API access:

1. Navigate to the **Settings** tab
2. Enter your BitBadges API key (if you have one)
3. Click **Save Settings**

### 4. Set Up Transaction Authorization (Optional)

If you want the AI agent to perform transactions on behalf of your main account:

1. Go to your [BitBadges account settings](https://bitbadges.io/account)
2. Navigate to **Approved Transactors**
3. Add your AI agent's wallet address as an approved transactor
4. In the app Settings tab, enter your main BitBadges address as **Creator Address**
5. Save settings

> ⚠️ **Important**: When using a custom creator address, you must add the AI agent's address as an approved transactor in your BitBadges account settings for transactions to work properly.

## Using the AI Agent

### Available Commands

#### Wallet Commands

-   `/wallet status` - Check wallet status and connection
-   `/wallet address` - Get the agent's wallet address
-   `/wallet balance` - Check $BADGE balance on BitBadges blockchain
-   `/wallet publickey` - Generate base64 public key
-   `/wallet account` - Get BitBadges account info (number/sequence)
-   `/wallet sign {"message": "Hello"}` - Sign a message
-   `/wallet blockheight` - Get latest block height

#### Transaction Generation

-   `/tx status` - Check transaction service status
-   `/tx schema {"message": "MsgTransferBadges"}` - Get message schema
-   `/tx transfer {"prompt": "Transfer 5 badges from bb1a to bb1k in collection 123"}` - Generate transaction
-   `/tx simulate {"prompt": "Transfer 5 badges from bb1a to bb1k in collection 123"}` - Simulate transaction
-   `/tx broadcast {"prompt": "Transfer 5 badges from bb1a to bb1k in collection 123"}` - Execute transaction

> **⚠️ Transaction Support**: Currently, only `MsgTransferBadges` transaction type is supported. Support for additional message types (collection creation, approval management, etc.) can be extended by using the BitBadges SDK. See the [BitBadges SDK documentation](https://docs.bitbadges.io/) for more information.

> **⚠️ Natural Language Processing**: The natural language to transaction generation is functional but basic. You can enhance this by improving the proto service or integrating with more advanced AI models. However, for autonomous agents in production, you'll typically want to construct exact transaction messages programmatically rather than relying on plain English parsing.

### Example Interactions

```
# Check agent status
/wallet status

# Transfer badges using natural language
/tx transfer {"prompt": "Send 10 badges for collection 1 from Mint to bb1xyz123..."}
```

## Development Commands

```bash
# Development
npm run dev                    # Start both frontend and backend
npm run dev:backend           # Start backend only
npm run dev:frontend          # Start frontend only

# Building
npm run build                 # Build both packages
npm run build:backend        # Build backend only
npm run build:frontend       # Build frontend only

# Production
npm start                     # Start backend in production mode

# Code Quality
npm run lint                  # Lint all packages
npm run type-check           # Type check all packages

# Utilities
npm run clean                # Clean build artifacts
```

## Plugin Development

The system uses an extensible plugin architecture. To create a new plugin:

1. Create a new file in `packages/backend/src/plugins/`
2. Implement the `Plugin` interface:

```typescript
export const myPlugin = {
    name: 'myplugin',
    description: 'Description of what this plugin does',

    async execute(args: any[]): Promise<CommandResult> {
        // Plugin logic here
        return {
            success: true,
            data: {
                /* result data */
            },
            logs: ['Plugin executed successfully'],
        };
    },
};
```

3. Register the plugin in `packages/backend/src/services/pluginManager.ts`

## BitBadges Integration

### API Documentation

-   **Stoplight Docs**: https://bitbadges.stoplight.io/docs/bitbadges
-   **Official Docs**: https://docs.bitbadges.io
-   **Transaction Builder**: https://bitbadges.io/dev/broadcast

### Local Development with BitBadges

The system is configured for localhost development with these default ports:

-   **BitBadges Indexer / API**: `http://localhost:3001`
-   **BitBadges Node API**: `http://localhost:1317` (Cosmos REST API)
-   **BitBadges RPC**: `http://localhost:26657` (Tendermint RPC)

## Troubleshooting

### Common Issues

**Wallet Creation Fails**

-   Ensure you have sufficient permissions to write to the data directory
-   Check that no conflicting wallet files exist

**Transaction Failures**

-   Verify your agent wallet has sufficient $BADGE balance
-   Check that approved transactor settings are correct (if using custom creator address)
-   Ensure the BitBadges network is accessible

**API Connection Issues**

-   Verify environment variables are set correctly
-   Check that BitBadges services are running (for local development)
-   Confirm API key is valid (if using authenticated endpoints)

**WebSocket Connection Problems**

-   Ensure both frontend and backend are running
-   Check for port conflicts (default: backend 3005, frontend 3006)
-   Verify CORS settings in backend configuration

### Getting Help

1. Check the browser console and server logs for error messages
2. Verify all environment variables are configured correctly
3. Ensure your BitBadges account has proper permissions
4. Try restarting both frontend and backend services

## Extension Ideas

This codebase is intentionally open-ended and designed for customization. Here are some ideas for extending the functionality:

### Autonomous Behavior

-   **Cron/Scheduled Tasks**: Implement scheduled operations (e.g., periodic badge distributions, automated market making)
-   **Event Listeners**: Monitor blockchain events and trigger automatic responses
-   **Condition-Based Actions**: Execute transactions based on specific criteria or thresholds
-   **Multi-Agent Coordination**: Implement communication between multiple AI agents

### User Experience Enhancements

-   **Address Book**: Store and manage frequently used BitBadges addresses with nicknames
-   **Transaction Confirmations**: Add confirmation dialogs with transaction details before execution
-   **Enhanced Address Display**: Show ENS names, avatar images, or custom labels for addresses
-   **Transaction History**: Track and display past transactions with filtering and search
-   **Rich Notifications**: Real-time notifications for transaction status, balance changes, etc.

### Integration & Automation

-   **External API Integration**: Connect to external data sources (price feeds, social media, etc.)
-   **Webhook Support**: Receive notifications from external services
-   **Database Integration**: Persistent storage for transaction history, user preferences, analytics
-   **Multi-Chain Support**: Extend to other blockchains beyond BitBadges
-   **AI Model Integration**: Connect to OpenAI, Claude, or other AI services for enhanced natural language processing

### Advanced Transaction Features

-   **Batch Transactions**: Execute multiple operations in a single transaction
-   **Additional Message Types**: Support for collection creation, approval management, attestations
-   **Template System**: Pre-defined transaction templates for common operations
-   **Gas Optimization**: Intelligent fee estimation and transaction timing

### Developer Tools

-   **GraphQL API**: Alternative API interface for complex queries
-   **SDK Generation**: Auto-generate client SDKs for different languages
-   **Testing Framework**: Comprehensive testing tools for transaction simulation
-   **Monitoring & Analytics**: Dashboard for tracking agent performance and blockchain interactions

### Security & Compliance

-   **Multi-Signature Support**: Require multiple approvals for high-value transactions
-   **Spending Limits**: Implement daily/weekly transaction limits
-   **Audit Logging**: Comprehensive logging for compliance and debugging
-   **Role-Based Access**: Different permission levels for different operations

Remember: The plugin system, service architecture, and API structure are all designed to make these extensions straightforward to implement!

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -m "Add my feature"`
5. Push to the branch: `git push origin feature/my-feature`
6. Submit a pull request

## Support

For questions and support:

-   Check the [BitBadges Documentation](https://docs.bitbadges.io)
-   Review the [API Documentation](https://bitbadges.stoplight.io/docs/bitbadges)
-   Open an issue in this repository

---

**Happy Building with BitBadges AI! 🚀**
