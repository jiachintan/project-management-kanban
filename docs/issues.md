# Known Issues and Solutions

## Issue 1: Drag and drop moves card to wrong column

**Date:** 2026-06-04
**Status:** Fixed

### Symptom

Dragging a card between columns either moved it to the wrong column or had no visible effect.

### Root Cause

SQLite uses separate auto-increment sequences per table. Both the `columns` table and the `cards` table start their IDs at 1:

- Column IDs: `1` (Backlog), `2` (Discovery), `3` (In Progress), `4` (Review), `5` (Done)
- Card IDs: `1`, `2`, `3`, `4`, ...

In the frontend, these were stored as plain numeric strings (`"1"`, `"2"`, `"3"`) for both columns and cards. The drag-and-drop library uses a helper function `findColumnId()` to determine which column a dropped item belongs to:

```ts
const isColumnId = (columns, id) =>
  columns.some((column) => column.id === id);
```

When card `"3"` was dragged and dropped over another card with ID `"3"`, this function matched against column ID `"3"` (In Progress) instead of treating it as a card. The result: cards were routed to the wrong column.

### Fix

Prefixed all frontend IDs to distinguish columns from cards:

- Columns: `"col-1"`, `"col-2"`, ..., `"col-5"`
- Cards: `"card-1"`, `"card-2"`, `"card-3"`, ...

The `findColumnId` check now works correctly because `"card-3" !== "col-3"`. The prefix is stripped when making backend API calls (`parseColId` / `parseCardId` helpers in `KanbanBoard.tsx`).

**Files changed:** `frontend/src/components/KanbanBoard.tsx`

---

## Issue 2: Old Docker container serving stale API on port 8000

**Date:** 2026-06-04
**Status:** Fixed (operational procedure)

### Symptom

After updating the backend code and restarting the local uvicorn server, `/api/board` returned the Next.js 404 HTML page instead of JSON. Routes `/api/health` and `/api/auth/me` worked correctly.

### Root Cause

A Docker container from a previous session was still running and listening on port 8000. The new uvicorn process failed to bind (or bound to a different interface) so all requests were silently handled by the stale Docker container, which ran an older version of the backend without the board routes.

### Fix

Stop all running Docker containers before starting the local development server:

```bash
docker stop $(docker ps -q --filter "publish=8000")
```

Then start uvicorn normally:

```bash
uv run uvicorn main:app --port 8000
```
