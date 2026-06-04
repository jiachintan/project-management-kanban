# Backend Agent Guide

## Overview

Python FastAPI backend. Manages all API routes, serves the static Next.js frontend, handles auth, database access, and AI integration.

## Tech Stack

- **Python 3.12**
- **FastAPI** — API framework
- **uvicorn** — ASGI server
- **uv** — package manager (`pyproject.toml` with `[tool.uv] package = false`)
- **SQLite** — database (added in Part 6)
- **anthropic SDK** — Claude AI calls (added in Part 8)

## Running Locally (Docker)

From project root:
```
scripts/start.sh   # Mac/Linux
scripts/start.bat  # Windows
```

App runs at `http://localhost:8000`.

## File Structure

```
backend/
  main.py           # FastAPI app, all routes, static file serving
  pyproject.toml    # uv-managed dependencies
  static/           # Built Next.js output (copied in during Docker build, Part 3+)
```

## Current Routes

- `GET /api/health` — returns `{"status": "ok"}`
- `GET /` — serves static frontend (or placeholder HTML if no static/ dir)

## Static File Serving

`main.py` checks for a `static/` directory at runtime. If present, mounts it as a StaticFiles app at `/` with `html=True` (SPA fallback). If absent, serves a placeholder HTML response.

## Adding Dependencies

Edit `backend/pyproject.toml` dependencies list. The Dockerfile runs `uv sync --no-dev` on build.
