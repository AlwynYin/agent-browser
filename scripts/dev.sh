#!/bin/bash

# Start all services in development mode
echo "🚀 Starting agent-browser development environment..."

# Kill any existing processes on our ports
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true

# Start schema package in watch mode
echo "📦 Starting schema package in watch mode..."
pnpm --filter @agent-browser/schema run dev & p1=$!

# Wait a moment for schema to build
sleep 2

# Start server in development mode  
echo "🖥️  Starting server in development mode..."
pnpm --filter @agent-browser/server run dev & p2=$!

# Start client in development mode
echo "🌐 Starting client in development mode..."
pnpm --filter @agent-browser/client run dev & p3=$!

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up processes..."
    kill $p1 $p2 $p3 2>/dev/null
    exit
}

# Trap signals to cleanup
trap cleanup SIGINT SIGTERM

echo "✅ All services started!"
echo "   Client: http://localhost:3000"
echo "   Server: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for any process to exit and kill the others
wait
cleanup