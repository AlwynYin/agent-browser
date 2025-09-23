# Use Python 3.13 slim image
FROM python:3.13-slim

# Set working directory to match local structure
WORKDIR /app/tool_generation_backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for Codex CLI
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Codex CLI globally
RUN npm install -g @openai/codex

# Add npm global bin to PATH
ENV PATH="/usr/local/bin:${PATH}"

# Verify Codex CLI installation and show npm global paths
RUN npm config get prefix && ls -la /usr/local/bin/ && which codex && codex --version

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install Python dependencies
RUN uv sync --frozen

# Copy application code
COPY . .

# Create tool service directory to match expected path structure
RUN mkdir -p /app/tool_service/tools

# Authenticate Codex CLI with OpenAI API key
# This expects OPENAI_API_KEY to be set as a build argument or environment variable
ARG OPENAI_API_KEY
RUN if [ -n "$OPENAI_API_KEY" ]; then \
        codex login --api-key "$OPENAI_API_KEY"; \
    else \
        echo "Warning: OPENAI_API_KEY not provided during build. Codex authentication will be required at runtime."; \
    fi

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Start command (from within tool_generation_backend)
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]