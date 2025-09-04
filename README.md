# Agent Browser

A tool-based agentic system for chemistry computation that automatically implements Python tools based on user requirements.

## Phase 1 Architecture

The system follows a simplified 5-step workflow:

1. **User Input**: User provides chemistry computation requirement
2. **Orchestrator Agent**: Generates implementation plan and search plan
3. **Browser Agent**: Searches for API documentation using browser-use
4. **Engineer Agent**: Implements Python tools based on search results
5. **Execution**: Calls tools to provide results to user

## Tech Stack

- **Frontend**: React 19.1.0 + TypeScript + Vite 7.0.0 + Material-UI v7.2.0 + Jotai
- **Backend**: Express.js + TypeScript + MongoDB + Socket.IO
- **Agents**: OpenAI API integration + browser-use API
- **Build System**: PNPM workspaces + coordinated dev/build scripts

## Quick Start

### Prerequisites

- Node.js 18+
- PNPM 10.11.1+
- MongoDB (local or cloud)
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your configuration:
   - Add your OpenAI API key
   - Configure MongoDB URL
   - Set Python execution API URL (if available)

### Development

Start all services in development mode:
```bash
pnpm dev
```

This will start:
- Client: http://localhost:3000
- Server: http://localhost:3001
- Schema: Watch mode for changes

### Build

Build all packages for production:
```bash
pnpm build
```

## Project Structure

```
packages/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── atoms/         # Jotai state atoms
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # API client and utilities
│   │   └── types/         # TypeScript type definitions
├── server/                 # Express.js backend
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic services
│   │   ├── repositories/  # Data access layer
│   │   ├── middleware/    # Express middleware
│   │   └── websocket/     # Socket.IO handlers
├── schema/                 # Shared data models and types
└── agents/                 # Agent implementations (future)
    ├── orchestrator/
    ├── browser/
    └── engineer/
```

## Development Progress

### Phase 1.1: Project Foundation ✅
- [x] PNPM monorepo structure
- [x] TypeScript configuration
- [x] Core data models
- [x] Express.js server setup
- [x] React frontend setup

### Phase 1.2: Agent Implementation (Next)
- [ ] Orchestrator Agent with OpenAI
- [ ] Browser Agent with browser-use API
- [ ] Engineer Agent with code generation
- [ ] Phase 1 workflow integration

### Phase 1.3: Testing & Polish (Future)
- [ ] End-to-end workflow testing
- [ ] Error handling and recovery
- [ ] UI polish and user experience

## API Endpoints

- `POST /api/sessions` - Create new computation session
- `GET /api/sessions/:id` - Get session details
- `GET /api/sessions/user/:userId` - Get user sessions
- `POST /api/sessions/:id/tools/:toolId/execute` - Execute tool
- `GET /health` - Health check

## WebSocket Events

Real-time updates via Socket.IO:
- `session-update` - Session status and progress updates
- `tool-implemented` - New tool implementations
- `execution-result` - Tool execution results

## Contributing

This project follows Forest's architectural patterns and conventions. When contributing:

1. Follow the existing MVVM pattern with Jotai
2. Use TypeScript strictly
3. Follow Material-UI design patterns
4. Add proper error handling
5. Update tests as needed

## License

[License TBD]