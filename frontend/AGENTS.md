# Frontend Agent Guide

## Overview

A pure frontend-only Kanban board demo built with Next.js 16 (React 19, TypeScript, Tailwind CSS v4). All state is in-memory — there is no backend integration yet. This is the starting point for the full-stack app.

## Tech Stack

- **Next.js 16.1.6** with App Router
- **React 19** (client components where needed)
- **TypeScript**
- **Tailwind CSS v4** (PostCSS config via `postcss.config.mjs`)
- **@dnd-kit** (core, sortable, utilities) — drag-and-drop
- **clsx** — conditional classNames
- **Vitest + React Testing Library** — unit/component tests
- **Playwright** — e2e tests

## Directory Structure

```
frontend/
  src/
    app/
      page.tsx          # Root page — renders <KanbanBoard />
      layout.tsx        # Root layout (fonts, global styles)
      globals.css       # CSS variables and base styles
    components/
      KanbanBoard.tsx   # Main board — owns all state, DnD context
      KanbanColumn.tsx  # Single column — droppable, sortable context
      KanbanCard.tsx    # Single card — sortable, delete button
      KanbanCardPreview.tsx  # Drag overlay ghost card
      NewCardForm.tsx   # Inline form to add a card to a column
    lib/
      kanban.ts         # Types, initial data, moveCard(), createId()
    test/
      setup.ts          # Vitest setup (jest-dom matchers)
      vitest.d.ts       # Type declarations
  tests/
    kanban.spec.ts      # Playwright e2e tests
```

## Key Data Types (src/lib/kanban.ts)

```ts
type Card = { id: string; title: string; details: string }
type Column = { id: string; title: string; cardIds: string[] }
type BoardData = { columns: Column[]; cards: Record<string, Card> }
```

Board has 5 fixed columns: Backlog, Discovery, In Progress, Review, Done.

## State Management

All state lives in `KanbanBoard` via `useState<BoardData>`. No context, no external store.

Handlers passed as props:
- `handleRenameColumn(columnId, title)` — updates column title
- `handleAddCard(columnId, title, details)` — creates card with `createId()`, appends to column
- `handleDeleteCard(columnId, cardId)` — removes card from both `cards` map and column's `cardIds`
- `handleDragStart` / `handleDragEnd` — DnD lifecycle; calls `moveCard()` on drop

## Drag and Drop

Uses `DndContext` with `PointerSensor` (6px activation distance). `KanbanColumn` is droppable. `KanbanCard` is sortable. `KanbanCardPreview` renders in `DragOverlay`. `moveCard()` in `kanban.ts` handles both same-column reorder and cross-column moves.

## Color Scheme (CSS variables in globals.css)

- `--accent-yellow: #ecad0a`
- `--primary-blue: #209dd7`
- `--secondary-purple: #753991`
- `--navy-dark: #032147`
- `--gray-text: #888888`

## Existing Tests

- `src/lib/kanban.test.ts` — unit tests for `moveCard` (same-column reorder, cross-column move, drop to column end)
- `src/components/KanbanBoard.test.tsx` — component tests (renders 5 columns, rename column, add and delete card)
- `tests/kanban.spec.ts` — Playwright e2e tests

Run unit tests: `npm run test:unit`
Run e2e tests: `npm run test:e2e`

## Integration Notes (for future parts)

- The `initialData` in `kanban.ts` will be replaced by an API fetch from `GET /api/board`
- A new `src/lib/api.ts` will provide typed fetch helpers for the backend
- A login page at `/login` will be added; unauthenticated users are redirected there
- An AI chat sidebar component will be added to `KanbanBoard`
- `next.config.ts` will be updated with `output: 'export'` for static build serving via FastAPI
