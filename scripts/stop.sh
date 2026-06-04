#!/bin/bash

CONTAINER_NAME="pm-app"

docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "Container stopped."
