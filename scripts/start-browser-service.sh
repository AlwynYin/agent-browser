#!/bin/bash

# Start Browser Agent Service
# This script sets up and starts the Python browser-use service

echo "🚀 Starting Browser Agent Service..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is required but not installed"
    exit 1
fi

# Check if pip is available
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    echo "❌ pip is required but not installed"
    exit 1
fi

# Set up virtual environment if it doesn't exist
VENV_DIR="./packages/browser-service/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Install dependencies
echo "📥 Installing Python dependencies..."
pip install -r packages/browser-service/requirements.txt

# Set environment variables
if [ -f ".env" ]; then
    echo "🔑 Loading environment variables from .env..."
    export $(grep -v '^#' .env | xargs)
else
    echo "⚠️ No .env file found. Make sure OPENAI_API_KEY is set in your environment."
fi

# Start the service
echo "✅ Starting Browser Agent Service on port 8001..."
cd packages/browser-service
python browser_agent_service.py