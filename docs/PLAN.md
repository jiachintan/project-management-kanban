# Project Management MVP - Detailed Plan

## Part 1: Plan

- [x] Review existing frontend code
- [x] Create frontend/AGENTS.md describing existing code
- [x] Enrich this PLAN.md with detailed substeps, checklists, and success criteria
- [x] User approves plan

**Success criteria:** User has approved this document before any code work begins.

**COMPLETE**

---

## Part 2: Scaffolding

Set up Docker infrastructure, FastAPI backend, and start/stop scripts. Validate with a "hello world" that confirms the container runs, serves static HTML, and can make an API call.

### Checklist
- [x] Create `backend/` directory with `pyproject.toml` (uv-managed), `main.py`
- [x] `main.py`: FastAPI app with `GET /api/health` returning `{"status": "ok"}` and a static HTML placeholder at `/`
- [x] Create `Dockerfile` at project root: installs uv, builds backend, exposes port 8000
- [x] Create `scripts/start.sh` (Mac/Linux) and `scripts/start.bat` (Windows) — builds and runs the Docker container
- [x] Create `scripts/stop.sh` and `scripts/stop.bat` — stops and removes the container
- [x] Verify: `docker build` succeeds, container starts, `GET /` returns placeholder HTML, `GET /api/health` returns JSON

### Tests
- Manual: `scripts/start.sh` → browser at `http://localhost:8000` shows placeholder HTML
- Manual: `curl http://localhost:8000/api/health` returns `{"status": "ok"}`

### Success criteria
Docker container builds and runs. `/` returns static HTML. `/api/health` returns `{"status": "ok"}`.

**COMPLETE**

---

## Part 3: Add in Frontend

Replace the placeholder HTML with the statically-built Next.js app, served by FastAPI.

### Checklist
- [x] Configure `frontend/next.config.ts` for static export (`output: 'export'`)
- [x] Update `Dockerfile`: add Node build stage, run `npm ci && npm run build`, copy `frontend/out/` to `backend/static/`
- [x] Configure FastAPI to serve `backend/static/` at `/`, with SPA fallback (serve `index.html` for unknown routes)
- [x] Confirm existing frontend vitest unit tests still pass (6/6 passing)
- [x] Confirm existing playwright e2e tests pass (3/3 passing)

### Tests
- Unit: `vitest run` passes (all existing tests)
- Integration: `docker build && docker run` → browser at `/` shows the Kanban board with 5 columns

### Success criteria
The full Kanban UI is accessible at `http://localhost:8000/`. No backend logic yet — state is still frontend-only.

**COMPLETE**

---

## Part 4: Fake User Sign-in

Gate the Kanban board behind a login screen. Credentials are hardcoded: `user` / `password`.

### Design Decisions
- **JWT over opaque token**: Used PyJWT (HS256) to sign tokens. Secret key loaded from `SECRET_KEY` env var with a safe default for local dev. Tokens expire after 24 hours.
- **Cookie transport**: Session token set as an `httponly`, `samesite=lax` cookie named `session`. This keeps the token out of JavaScript and safe from CSRF on same-site requests.
- **`current_user` dependency**: A FastAPI `Depends` function reads and verifies the cookie, raising HTTP 401 if missing or invalid. All protected routes declare this dependency — no per-route auth checks.
- **No password hashing for MVP**: Credentials are hardcoded strings (`user` / `password`). The schema stores a `password_hash` column for future multi-user support but is unused now.

### Checklist
- [x] Backend: `POST /api/auth/login` — accepts `{username, password}`, validates against hardcoded credentials, returns a signed JWT or opaque session token in a cookie
- [x] Backend: `POST /api/auth/logout` — clears session cookie
- [x] Backend: `GET /api/auth/me` — returns `{username}` if authenticated, else 401
- [x] Frontend: add `/login` route with a simple username/password form
- [x] Frontend: on app load, call `/api/auth/me`; redirect to `/login` if 401
- [x] Frontend: show a logout button; on click, call `/api/auth/logout` then redirect to `/login`
- [x] Backend pytest tests: login success, login failure (wrong password), logout, /me authenticated, /me unauthenticated (7/7 passing)
- [x] Frontend vitest tests: login form renders, submits, redirects on success, shows error on failure (10/10 passing)

### Tests
- pytest: `tests/test_auth.py` — covers all auth endpoints; 80%+ coverage on auth module
- Vitest: login page component tests
- Integration: can't access `/` without being logged in; login with correct credentials redirects to board; wrong credentials show error; logout works

### Success criteria
Unauthenticated users see the login page. `user`/`password` grants access to the Kanban board. Logout returns to login page.

**COMPLETE**

---

## Part 5: Database Modeling

Design and document the SQLite schema before writing any database code.

### Checklist
- [x] Design schema covering: `users`, `boards`, `columns`, `cards` tables
- [x] Write `docs/schema.md` with table definitions, field types, constraints, and relationships
- [x] Save a JSON representation of the schema to `docs/schema.json`
- [x] User reviews and approves schema

### Schema (draft)
- `users`: id (PK), username (unique), password_hash
- `boards`: id (PK), user_id (FK), title
- `columns`: id (PK), board_id (FK), title, position (int for order)
- `cards`: id (PK), column_id (FK), title, details, position (int for order)

### Success criteria
User has approved the schema before any database code is written.

**COMPLETE**

---

## Part 6: Backend API

Implement all CRUD routes for the Kanban board backed by SQLite. Database is created automatically if it does not exist.

### Design Decisions
- **SQLAlchemy 2.0 ORM**: Used declarative models with relationship lazy loading. Cascade deletes set on Board→Column and Column→Card so deleting a user's board cleans up everything.
- **`get_board` auto-seeds**: On first call for a user, `get_or_create_board` creates the board and seeds all 5 columns (Backlog, Discovery, In Progress, Review, Done) in a single transaction. Subsequent calls return the existing board.
- **Position as integer**: Cards and columns have an integer `position` field. On move, only the moved card's position is updated — no renumbering of siblings. This keeps the query simple for MVP.
- **Test isolation with `StaticPool`**: In-memory SQLite creates a new database per connection by default. Tests use `StaticPool` to force all connections to share one underlying connection, so tables created in setup are visible to the test session.
- **`pytest-cov`** added to dev dependencies. Final coverage: 98%.

### Checklist
- [x] Add SQLAlchemy (or aiosqlite) to backend dependencies
- [x] `backend/database.py`: SQLite setup, table creation on startup, session factory
- [x] `backend/models.py`: ORM models for users, boards, columns, cards
- [x] `backend/crud.py`: functions for board read/write operations
- [x] Routes (all require auth):
  - `GET /api/board` — returns the authenticated user's board as JSON
  - `PUT /api/board/columns/{column_id}` — rename a column
  - `POST /api/board/cards` — create a card in a column
  - `PUT /api/board/cards/{card_id}` — update card title/details
  - `DELETE /api/board/cards/{card_id}` — delete a card
  - `PUT /api/board/cards/{card_id}/move` — move card to a different column/position
- [x] On first login, seed the board with 5 default columns (Backlog, Discovery, In Progress, Review, Done)
- [x] pytest unit tests for all CRUD functions (mocked DB)
- [x] pytest integration tests for all routes (test client with real SQLite in-memory DB)
- [x] Achieve 80%+ unit test coverage on backend code (98% achieved)

### Tests
- `tests/test_board_api.py` — integration tests for all board routes
- `tests/test_crud.py` — unit tests for CRUD functions
- Coverage: `pytest --cov=backend --cov-report=term-missing` shows >= 80%

### Success criteria
All routes work correctly. pytest passes. 80%+ coverage.

**COMPLETE**

---

## Part 7: Frontend + Backend Integration

Wire the Next.js frontend to the FastAPI backend so the board state is fully persistent.

### Design Decisions
- **Prefixed frontend IDs**: SQLite auto-increment means column IDs (1–5) and card IDs (1, 2, 3…) share the same numeric space. The dnd-kit `findColumnId` helper checks if an ID matches a column — a card ID of `"3"` would collide with column ID `"3"` (In Progress). Fix: columns are stored as `"col-1"` through `"col-5"` and cards as `"card-1"`, `"card-2"` etc. in frontend state. Strip prefix when calling the API. See `docs/issues.md` Issue 1.
- **Rename on blur, not on every keystroke**: `onRename` updates local state on each keystroke (instant feedback). A new `onRenameCommit` prop fires the API call only on input blur, avoiding one API call per character typed.
- **Add card async — form closes immediately**: `NewCardForm` resets itself (closes) as soon as the user clicks "Add card". The card appears on the board once the API responds and state updates. No optimistic temp-ID needed for MVP.
- **Move card optimistic with rollback**: Drag-end updates local state immediately (smooth UX), then calls the API. If the API call fails, the previous column layout is restored.
- **`api.ts` typed with backend shapes**: `ApiBoard`, `ApiColumn`, `ApiCard` mirror the exact JSON the FastAPI routes return. `apiBoardToLocal()` converts them to the frontend `BoardData` format used by dnd-kit.

### Checklist
- [x] Create `frontend/src/lib/api.ts`: typed fetch helpers for all board API endpoints
- [x] Update `KanbanBoard` to load board state from `GET /api/board` on mount
- [x] Update handlers: rename column, add card, delete card, move card — each calls the relevant API endpoint, then updates local state on success
- [x] Add loading state (spinner or skeleton) and error state to `KanbanBoard`
- [x] Frontend vitest tests: mock `api.ts`, test that components call API correctly and handle responses (10/10 passing)
- [x] Integration test: full round-trip — login, create card, sign out, sign back in, card persists (verified manually)

### Tests
- Vitest: updated `KanbanBoard.test.tsx` with API mocks
- Integration: `docker build && docker run` → login → add a card → refresh → card still there

### Success criteria
All Kanban state persists across page reloads. No data lives only in React state.

**COMPLETE**

---

## Part 8: AI Connectivity

Connect the backend to the Anthropic Claude API. Verify with a simple test call.

### Checklist
- [x] Add `anthropic` Python SDK to backend dependencies
- [x] Load `CLAUDE_API_KEY` from environment (passed into Docker from `.env`)
- [x] `backend/ai.py`: minimal wrapper around the Anthropic client
- [x] `POST /api/ai/test` endpoint: sends "What is 2+2?" to Claude, returns the response (dev/test only — can be removed later)
- [x] pytest test: calls the test endpoint and asserts a response is returned (mocked Anthropic client)
- [ ] Manual verification: real API call returns a sensible answer

### Tests
- `tests/test_ai.py` — mocked Anthropic client, verifies the endpoint calls the client and returns a response

### Success criteria
`POST /api/ai/test` returns a valid response from Claude. API key is correctly loaded from environment.

**COMPLETE**

---

## Part 9: AI + Kanban Structured Output

Extend the AI backend to accept a user question plus conversation history, pass the current board state to Claude, and return both a chat reply and an optional board update.

### Checklist
- [x] Define structured output schema in `backend/ai_schema.py`:
  - Response: `{ "reply": str, "board_update": BoardUpdate | null }`
  - `BoardUpdate`: list of operations — create card, update card, delete card, move card
- [x] Update `backend/ai.py`: system prompt instructs Claude on the board JSON format and available operations; use Claude tool use to enforce schema
- [x] `POST /api/chat` endpoint:
  - Body: `{ "message": str, "history": [{"role": str, "content": str}] }`
  - Fetches current board state for the authenticated user
  - Sends board state + history + message to Claude
  - If `board_update` is present, applies operations to the DB
  - Returns `{ "reply": str, "board_updated": bool }`
- [x] pytest tests: mock Anthropic client, test that each operation type (create, update, delete, move) is applied correctly
- [x] pytest tests: verify conversation history is passed through correctly

### Tests
- `tests/test_chat.py` — all operation types, history handling, no-update path

### Success criteria
AI can create, edit, move, and delete cards via a single chat message. Board state in DB is updated correctly.

**COMPLETE**

---

## Part 10: AI Chat Sidebar UI

Add a polished chat sidebar to the frontend. When the AI updates the board, the UI refreshes automatically.

### Checklist
- [x] Create `frontend/src/components/AIChatSidebar.tsx`:
  - Input field and send button
  - Scrollable message history (user and AI messages)
  - Loading indicator while waiting for AI response
- [x] Add sidebar toggle button to the `KanbanBoard` header
- [x] On AI response: if `board_updated` is true, refetch board from `GET /api/board` and update state
- [x] Maintain conversation history in component state; send with each message
- [x] Apply project color scheme: purple submit button, navy headings, gray text
- [x] Vitest tests: sidebar renders, sends messages, displays replies, handles loading state
- [ ] Integration: full end-to-end — log in, open sidebar, ask AI to create a card, card appears on board

### Tests
- Vitest: `AIChatSidebar.test.tsx` — render, type, submit, display reply, board refresh trigger
- Integration: docker build and run, test the full AI chat flow manually

### Success criteria
User can open the sidebar, chat with the AI, and see card changes reflected on the board in real time.

**COMPLETE** (pending manual integration test via Docker)
