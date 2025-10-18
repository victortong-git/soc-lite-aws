FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app

# All environment variables in one layer
ENV UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DOCKER_CONTAINER=1 \
    AWS_REGION=us-east-1 \
    AWS_DEFAULT_REGION=us-east-1

# Copy requirements first for better caching
COPY requirements.txt requirements.txt

# Install from requirements file
RUN uv pip install -r requirements.txt

# Install OpenTelemetry (required by AgentCore)
RUN uv pip install aws-opentelemetry-distro>=0.10.1

# Create non-root user
RUN useradd -m -u 1000 bedrock_agentcore
USER bedrock_agentcore

# Expose ports for AgentCore Runtime
EXPOSE 9000
EXPOSE 8000
EXPOSE 8080

# Copy entire project (respecting .dockerignore)
COPY . .

# Run with OpenTelemetry instrumentation in module mode
CMD ["opentelemetry-instrument", "python", "-m", "secops_agent"]
