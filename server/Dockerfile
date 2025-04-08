# syntax=docker/dockerfile:1

# Use a slim Python base image
FROM python:3.9-slim AS base

# Set working directory
WORKDIR /app

# Install dependencies in a virtual environment
FROM base AS builder
COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Final stage
FROM base AS final
COPY --from=builder /app/.venv /app/.venv
COPY . .
ENV PATH="/app/.venv/bin:$PATH"

# Set the entrypoint
CMD ["python", "main.py"]