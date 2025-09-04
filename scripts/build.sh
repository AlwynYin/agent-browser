#!/bin/bash

set -e

echo "🏗️  Building agent-browser..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
pnpm run clean

# Build schema package first (dependencies need it)
echo "📦 Building schema package..."
pnpm --filter @agent-browser/schema run build

# Build server
echo "🖥️  Building server..."
pnpm --filter @agent-browser/server run build

# Build client
echo "🌐 Building client..."
pnpm --filter @agent-browser/client run build

# Combine builds into single distribution
echo "📦 Creating combined distribution..."
rm -rf build/dist 2>/dev/null || true
mkdir -p build/dist

# Copy server build
cp -r packages/server/dist build/

# Copy client build as public directory
cp -r packages/client/dist build/dist/public

echo "✅ Build complete!"
echo "   Distribution: ./build/dist/"
echo "   Server: ./build/dist/server.js"
echo "   Public: ./build/dist/public/"