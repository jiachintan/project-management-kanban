# Kanban Studio

A single-board Kanban app with an AI assistant. Built with Next.js, FastAPI, and Claude.

## Features

- Kanban board with 5 columns (Backlog, Discovery, In Progress, Review, Done)
- Drag-and-drop cards between columns
- Rename columns, add/edit/delete cards
- AI chat sidebar — ask Claude to create, move, edit, or delete cards
- Persistent state via SQLite
- Single hardcoded user (`user` / `password`) for local use

## Requirements

- Docker
- An Anthropic API key

## Setup

1. Add your API key to `.env` in the project root:

```
CLAUDE_API_KEY=sk-ant-...
```

2. Start the app:

```bash
bash scripts/start.sh   # Mac/Linux
scripts\start.bat       # Windows
```

3. Open http://localhost:8000 and sign in with `user` / `password`.

## Stop

```bash
bash scripts/stop.sh
```

## Stack

- Frontend: Next.js (static export)
- Backend: Python FastAPI + SQLAlchemy + SQLite
- AI: Anthropic Claude (tool use for structured board operations)
- Container: Docker (single image, backend serves the built frontend)
