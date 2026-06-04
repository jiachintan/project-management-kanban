# Stage 1: Build Next.js static site
FROM node:22-slim AS frontend-build

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies (layer-cached separately from source)
COPY backend/pyproject.toml .
RUN uv sync --no-dev

# Copy backend source
COPY backend/ .

# Copy built frontend into backend/static/
COPY --from=frontend-build /frontend/out ./static

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
