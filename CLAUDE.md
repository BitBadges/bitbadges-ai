# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BitBadges AI - An autonomous AI agent for interacting with the BitBadges blockchain. This monorepo contains a React frontend and Node.js backend with WebSocket support for real-time chat interactions.

## Development Setup

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
npm install
```

### Development Commands
```bash
# Start both frontend and backend in development mode
npm run dev

# Start only backend
npm run dev:backend

# Start only frontend  
npm run dev:frontend

# Build both packages
npm run build

# Build individual packages
npm run build:backend
npm run build:frontend

# Production start (backend only)
npm start

# Lint all packages
npm run lint

# Type check all packages
npm run type-check

# Clean build artifacts
npm run clean
```

### Environment Setup
Copy `.env.example` files in both packages and configure:
- Backend: `packages/backend/.env`
- Frontend: `packages/frontend/.env`

## Architecture

### Monorepo Structure
- `packages/backend/` - Express server with Socket.IO
- `packages/frontend/` - React app with Vite

### Backend (`packages/backend/`)
- **Express Server** with WebSocket support via Socket.IO
- **Plugin System** for extensible commands
- **Built-in Plugins**:
  - `http` - HTTP request execution
  - `bitbadges` - BitBadges API integration
  - `code` - Code execution (placeholder)
- **API Endpoints**:
  - `GET /health` - Health check
  - `GET /api/plugins` - List available plugins
  - `POST /api/execute` - Execute plugin commands
- **WebSocket Events**:
  - `chat-message` - Real-time message exchange
  - `join-room` - Room management

### Frontend (`packages/frontend/`)
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time communication
- **Components**:
  - `ChatMessage` - Message display with markdown support
  - `ChatInput` - Message input with command suggestions
  - `Sidebar` - Plugin configuration and settings
- **Services**:
  - `socketService` - WebSocket connection management
  - `apiService` - HTTP API calls

### Plugin System
Commands use `/command` syntax:
- `/http {"url": "...", "method": "GET"}` - HTTP requests
- `/bitbadges getUser {"address": "cosmos1..."}` - BitBadges queries
- `/code console.log("hello")` - Code execution
- `/help` - Show available commands

### BitBadges Integration
The `bitbadges` plugin provides methods for:
- `getBalance` - Check badge balances
- `getBadge` - Get badge information
- `getCollection` - Get collection details
- `searchCollections` - Search collections
- `getUser` - Get user profile

## Development Notes

- Backend runs on port 3005 by default
- Frontend runs on port 3006 by default
- WebSocket connection established automatically
- Commands are processed server-side with results returned via WebSocket
- All API calls include proper error handling and rate limiting
- Plugin system is extensible - add new plugins in `packages/backend/src/plugins/`

## Localhost Configuration

The system is configured for localhost development with these default ports:
- **BitBadges API**: `http://localhost:3001`
- **BitBadges Node API**: `http://localhost:1317` (Cosmos REST API)
- **BitBadges RPC**: `http://localhost:26657` (Tendermint RPC)
- **AI Backend**: `http://localhost:3005`
- **AI Frontend**: `http://localhost:3006`

Environment variables can be set to override defaults:
- `BITBADGES_API_URL` - BitBadges API endpoint
- `BITBADGES_NODE_URL` - BitBadges Cosmos node API
- `BITBADGES_RPC_URL` - BitBadges RPC endpoint