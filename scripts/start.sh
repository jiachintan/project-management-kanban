#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTAINER_NAME="pm-app"
IMAGE_NAME="pm-app"

cd "$PROJECT_ROOT"

echo "Building Docker image..."
docker build -t "$IMAGE_NAME" .

# Stop and remove any existing container
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

ENV_FLAG=""
if [ -f .env ]; then
    ENV_FLAG="--env-file .env"
fi

echo "Starting container..."
docker run -d --name "$CONTAINER_NAME" -p 8000:8000 $ENV_FLAG \
  -v pm-app-data:/app/data \
  -e DB_PATH=/app/data/pm.db \
  "$IMAGE_NAME"

echo "App running at http://localhost:8000"
