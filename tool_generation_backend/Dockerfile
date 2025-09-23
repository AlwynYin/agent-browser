# Use Python 3.13 slim image
FROM python:3.13-slim

# Set working directory to match local structure
WORKDIR /app/tool_generation_backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Codex CLI from GitHub releases
RUN curl -L https://github.com/openai/codex/releases/download/rust-v0.39.0/codex-x86_64-unknown-linux-gnu.tar.gz -o codex.tar.gz \
    && tar -xzf codex.tar.gz \
    && mv codex-x86_64-unknown-linux-gnu /usr/local/bin/codex \
    && chmod +x /usr/local/bin/codex \
    && rm codex.tar.gz

# Verify Codex CLI installation
RUN which codex && ls -la /usr/local/bin/codex && codex --version

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

# Note: Codex authentication will happen at app startup

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Start command (from within tool_generation_backend)
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]