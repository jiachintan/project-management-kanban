# Code Review

Reviewed against the full repository at commit `10e40b1`. Scope covers `backend/`, `frontend/src/`, `Dockerfile`, `scripts/`, and config files. `node_modules` and `.venv` are excluded.

Issues are grouped by severity.

---

## Critical (Security)

### C1 - Unprotected AI test endpoint leaks API credits
**File:** `backend/main.py:78-81`

`POST /api/ai/test` requires no authentication. Any unauthenticated caller can trigger a real Anthropic API call, burning API credits and potentially being used for abuse.

**Action:** Remove the endpoint entirely, or add `username: str = Depends(current_user)` to protect it.

---

### C2 - SQLite database not in .gitignore
**File:** `.gitignore` (root)

The root `.gitignore` ignores `db.sqlite3` (Django convention) but not `*.db` or `backend/pm.db`. The git status already shows `backend/pm.db` as untracked. If accidentally committed, production data or test data with real user sessions would be in version history.

**Action:** Add `backend/pm.db` or `*.db` to the root `.gitignore`.

---

### C3 - Weak default JWT secret
**File:** `backend/auth.py:6`

```python
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod-minimum-32-chars")
```

If `SECRET_KEY` is not set in the environment, the fallback is a predictable, public string. Any attacker can forge valid session tokens for any username. Since this runs in Docker with an `.env` file, the env var may simply be missing.

**Action:** Remove the fallback. Raise a `ValueError` at startup if `SECRET_KEY` is not set, so the app fails loudly rather than silently insecurely.

---

### C4 - Session cookie missing `secure` flag
**File:** `backend/main.py:61`

```python
response.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax")
```

`secure=True` is absent. Browsers will send the cookie over plain HTTP, enabling session hijacking over a non-HTTPS connection. For a local MVP this is low risk, but the flag costs nothing to add.

**Action:** Add `secure=True`. For local development this can be gated on an env var (e.g. `SECURE_COOKIES=true`).

---

## High (Bugs / Crashes)

### H1 - Unhandled promise rejections on card add and delete
**Files:** `frontend/src/components/KanbanBoard.tsx:115-157`

`handleAddCard` and `handleDeleteCard` are `async` functions that `await` API calls with no `try/catch`. Both are passed as callbacks typed as `void`-returning functions, so TypeScript does not warn. If the API call fails:
- `handleAddCard`: the form has already closed (`setIsOpen(false)` fires before the `await`), the card never appears, and there is no user feedback.
- `handleDeleteCard`: the card disappears from local state before the API call succeeds (delete updates state first), and a failure leaves the UI desynced with no recovery.

**Action:** Wrap both in try/catch and show an error message or re-add the card to state on failure (rollback pattern, consistent with `handleDragEnd`).

---

### H2 - Login page does not handle network errors
**File:** `frontend/src/app/login/page.tsx:19-30`

The `fetch` call in `handleSubmit` is not wrapped in try/catch. A network error (backend down, Docker not running) throws an unhandled rejection and leaves `loading` stuck as `true` indefinitely, freezing the submit button.

**Action:** Wrap in try/catch and set an error message and reset `loading` in the catch block.

---

### H3 - `rename_column` return type annotation incorrect
**File:** `backend/crud.py:55`

```python
def rename_column(db: Session, column_id: int, title: str, board: Board) -> Column:
```

The function returns `None` when the column is not found (`return None` on line 58, implicitly). The return type should be `Column | None`. This is the same pattern used correctly in `create_card`, `update_card`, and `move_card` — `rename_column` was missed.

**Action:** Change annotation to `-> Column | None`.

---

### H4 - AI operation parsing silently ignores validation errors
**File:** `backend/ai.py:99-107`

```python
ops.append(CreateCardOp(**op_data))
```

If Claude returns a malformed operation (e.g. missing `column_id` for a `create_card`), Pydantic raises a `ValidationError` which propagates as an unhandled 500. The entire `/api/chat` request fails even if other operations in the same response were valid.

**Action:** Wrap the operation-parsing loop in a try/except and skip invalid operations (logging the error), so valid operations still apply.

---

## Medium (Quality / Correctness)

### M1 - `@app.on_event("startup")` is deprecated
**File:** `backend/main.py:28-30`

FastAPI deprecated `@app.on_event` in favour of the `lifespan` context manager pattern. This will generate deprecation warnings in newer FastAPI/Starlette versions.

**Action:** Replace with:
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)
```

---

### M2 - Silent failure on column rename
**File:** `frontend/src/components/KanbanBoard.tsx:112`

```typescript
const handleRenameColumnCommit = (columnId: string, title: string) => {
    api.renameColumn(parseColId(columnId), title).catch(() => {});
};
```

A rename failure (e.g. network error) is silently swallowed. The UI shows the new name but the database has the old name, leaving them permanently out of sync.

**Action:** On catch, either revert local state to the original title or show an error toast.

---

### M3 - N+1 query pattern in `board_to_dict`
**File:** `backend/crud.py:36-52`

SQLAlchemy lazy-loads `board.columns` (one query), then for each column lazy-loads `col.cards` (one query per column = 5 queries for 5 columns). For 5 columns this is 6 queries per board fetch. Every API call that calls `board_to_dict` (including every chat message) makes 6 database round-trips.

**Action:** Use `selectinload` or `joinedload` on the board query to fetch columns and cards in 1-2 queries:
```python
from sqlalchemy.orm import selectinload
db.query(Board).options(
    selectinload(Board.columns).selectinload(Column.cards)
).filter(...).first()
```

---

### M4 - No `.dockerignore` file
**Project root**

Without a `.dockerignore`, `docker build` sends the entire working directory as build context, including `frontend/node_modules` (~hundreds of MB) and `backend/.venv`. This makes every build significantly slower.

**Action:** Create `.dockerignore` at project root:
```
frontend/node_modules
frontend/.next
backend/.venv
backend/__pycache__
backend/tests
backend/pm.db
**/*.pyc
```

---

### M5 - No `uv.lock` committed
**File:** `backend/pyproject.toml`

All backend dependencies use `>=` version ranges with no lock file committed. Docker builds resolve dependency versions at build time, so two builds at different times may produce different dependency sets, breaking reproducibility.

**Action:** Commit `backend/uv.lock` to the repository. In the Dockerfile, use `uv sync --frozen` instead of `uv sync` to enforce the lock file.

---

### M6 - `get_or_create_user` implicitly creates users for any valid token
**File:** `backend/crud.py:8-15`

Any signed JWT for an arbitrary username (e.g. a token for `"admin"`) will silently create a new user row in the database. For MVP with a single hardcoded user this is harmless, but it is a latent bug for any multi-user extension.

**Action:** Document this behaviour clearly in the function, or separate user lookup from user creation so that `get_board` requires the user to already exist.

---

## Low (Minor / Cleanup)

### L1 - Dead code: `initialData` and `createId` in `kanban.ts`
**File:** `frontend/src/lib/kanban.ts:18-72, 164-168`

`initialData` is the hardcoded frontend-only demo board data. `createId` generates prefixed IDs for local-only state. Neither is imported anywhere in the connected application — both are leftovers from the pre-backend frontend demo.

**Action:** Remove both exports.

---

### L2 - Message list uses array index as React key
**File:** `frontend/src/components/AIChatSidebar.tsx:70`

```tsx
{messages.map((msg, i) => (
    <div key={i} ...>
```

Using array index as key causes incorrect reconciliation when messages are prepended or inserted (though for this append-only list the practical impact is low). The pattern is still considered a React anti-pattern.

**Action:** Add a stable `id` field to the `Message` type (e.g. `crypto.randomUUID()` or a counter) and use that as the key.

---

### L3 - Auth check causes blank flash on home page
**File:** `frontend/src/app/page.tsx:25`

```tsx
if (!authed) return null;
```

While waiting for `/api/auth/me` to respond, the page renders nothing. This causes a visible blank flash before either the board or the login redirect appears.

**Action:** Render a loading indicator instead of `null` while the auth check is in-flight.

---

### L4 - `loadBoard` not memoised causes unnecessary re-renders
**File:** `frontend/src/components/KanbanBoard.tsx:56-61`

`loadBoard` is a plain function defined inside the component body and passed as the `onBoardUpdate` prop to `AIChatSidebar`. It is recreated on every render. Wrapping it in `useCallback` with an empty dependency array would prevent `AIChatSidebar` from receiving a new prop reference on every parent render.

**Action:** Wrap `loadBoard` in `useCallback(loadBoard, [])`.

---

### L5 - `CLAUDE_API_KEY` is a non-standard env var name
**File:** `backend/ai.py:53`

```python
api_key = os.environ.get("CLAUDE_API_KEY")
```

The Anthropic SDK conventionally reads `ANTHROPIC_API_KEY` automatically if no `api_key` argument is passed. Using a custom name requires manual wiring and can confuse developers expecting the standard name.

**Action:** Either rename to `ANTHROPIC_API_KEY` in `.env` and `ai.py`, or document the non-standard name explicitly in the README/`.env.example`.

---

## Summary Table

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| C1 | Critical | Security | Unprotected `/api/ai/test` endpoint |
| C2 | Critical | Security | `pm.db` not in `.gitignore` |
| C3 | Critical | Security | Predictable default JWT secret |
| C4 | Critical | Security | Session cookie missing `secure` flag |
| H1 | High | Bug | Unhandled promise rejections in add/delete card |
| H2 | High | Bug | Login network errors cause frozen UI |
| H3 | High | Bug | Incorrect return type on `rename_column` |
| H4 | High | Bug | AI operation `ValidationError` crashes entire chat request |
| M1 | Medium | Quality | Deprecated `@app.on_event` startup handler |
| M2 | Medium | Quality | Silent failure on column rename |
| M3 | Medium | Quality | N+1 query in `board_to_dict` |
| M4 | Medium | Quality | No `.dockerignore` |
| M5 | Medium | Quality | No `uv.lock` committed |
| M6 | Medium | Quality | Implicit user creation in `get_or_create_user` |
| L1 | Low | Cleanup | Dead code: `initialData` and `createId` |
| L2 | Low | Cleanup | Array index used as React key |
| L3 | Low | UX | Blank flash during auth check |
| L4 | Low | Quality | `loadBoard` not memoised |
| L5 | Low | Quality | Non-standard `CLAUDE_API_KEY` env var name |
