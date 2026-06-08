import os
from contextlib import asynccontextmanager

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ai import ask, chat
from ai_schema import CreateCardOp, DeleteCardOp, MoveCardOp, UpdateCardOp
from auth import create_token, verify_token
from crud import (
    authenticate_user,
    board_to_dict,
    create_board,
    create_card,
    delete_board,
    delete_card,
    get_board,
    list_boards,
    move_card,
    register_user,
    rename_board,
    rename_column,
    update_card,
)
from database import get_db, init_db

COOKIE_NAME = "session"
SECURE_COOKIES = os.getenv("SECURE_COOKIES", "false").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)


# --- Auth helpers ---

class LoginRequest(BaseModel):
    username: str
    password: str


def current_user(session: str | None = Cookie(default=None)) -> str:
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    username = verify_token(session)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid session")
    return username


# --- Auth routes ---

@app.get("/api/health")
def health():
    return {"status": "ok"}


class RegisterRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if len(body.username) < 3 or len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Username must be at least 3 chars and password at least 6 chars")
    user = register_user(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=409, detail="Username already taken")
    return {"username": user.username}


@app.post("/api/auth/login")
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user.username)
    response.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax", secure=SECURE_COOKIES)
    return {"username": user.username}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@app.get("/api/auth/me")
def me(username: str = Depends(current_user)):
    return {"username": username}


# --- AI routes ---

@app.post("/api/ai/test")
def ai_test(username: str = Depends(current_user)):
    response = ask("What is 2+2?")
    return {"response": response}


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = []
    board_id: int | None = None


@app.post("/api/chat")
def chat_route(
    body: ChatRequest,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    board_id = body.board_id
    board = get_board(db, username, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    board_dict = board_to_dict(board)
    history = [{"role": m.role, "content": m.content} for m in body.history]

    result = chat(body.message, history, board_dict)

    board_updated = False
    if result.board_update:
        for op in result.board_update.operations:
            if isinstance(op, CreateCardOp):
                create_card(db, op.column_id, op.title, op.details, board)
                board_updated = True
            elif isinstance(op, UpdateCardOp):
                update_card(db, op.card_id, op.title, op.details, board)
                board_updated = True
            elif isinstance(op, DeleteCardOp):
                delete_card(db, op.card_id, board)
                board_updated = True
            elif isinstance(op, MoveCardOp):
                move_card(db, op.card_id, op.column_id, op.position, board)
                board_updated = True

    return {"reply": result.reply, "board_updated": board_updated}


# --- Board routes ---

@app.get("/api/boards")
def list_boards_route(username: str = Depends(current_user), db: Session = Depends(get_db)):
    boards = list_boards(db, username)
    return [{"id": b.id, "title": b.title} for b in boards]


class CreateBoardRequest(BaseModel):
    title: str


@app.post("/api/boards", status_code=201)
def create_board_route(
    body: CreateBoardRequest,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    board = create_board(db, username, body.title)
    if not board:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": board.id, "title": board.title}


@app.put("/api/boards/{board_id}")
def rename_board_route(
    board_id: int,
    body: CreateBoardRequest,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    board = rename_board(db, board_id, body.title, username)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"id": board.id, "title": board.title}


@app.delete("/api/boards/{board_id}", status_code=204)
def delete_board_route(
    board_id: int,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not delete_board(db, board_id, username):
        raise HTTPException(status_code=404, detail="Board not found")


@app.get("/api/board")
def get_board_route(
    board_id: int | None = None,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    board = get_board(db, username, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board_to_dict(board)


class RenameColumnRequest(BaseModel):
    title: str


@app.put("/api/board/columns/{column_id}")
def rename_column_route(
    column_id: int,
    body: RenameColumnRequest,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    board = get_board(db, username)
    col = rename_column(db, column_id, body.title, board)
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    return {"id": col.id, "title": col.title}


class CreateCardRequest(BaseModel):
    column_id: int
    title: str
    details: str = ""


@app.post("/api/board/cards", status_code=201)
def create_card_route(
    body: CreateCardRequest,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    board = get_board(db, username)
    card = create_card(db, body.column_id, body.title, body.details, board)
    if not card:
        raise HTTPException(status_code=404, detail="Column not found")
    return {"id": card.id, "title": card.title, "details": card.details, "position": card.position}


class UpdateCardRequest(BaseModel):
    title: str
    details: str = ""


@app.put("/api/board/cards/{card_id}")
def update_card_route(
    card_id: int,
    body: UpdateCardRequest,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    board = get_board(db, username)
    card = update_card(db, card_id, body.title, body.details, board)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"id": card.id, "title": card.title, "details": card.details}


@app.delete("/api/board/cards/{card_id}", status_code=204)
def delete_card_route(
    card_id: int,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    board = get_board(db, username)
    if not delete_card(db, card_id, board):
        raise HTTPException(status_code=404, detail="Card not found")


class MoveCardRequest(BaseModel):
    column_id: int
    position: int


@app.put("/api/board/cards/{card_id}/move")
def move_card_route(
    card_id: int,
    body: MoveCardRequest,
    username: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    board = get_board(db, username)
    card = move_card(db, card_id, body.column_id, body.position, board)
    if not card:
        raise HTTPException(status_code=404, detail="Card or column not found")
    return {"id": card.id, "column_id": card.column_id, "position": card.position}


# --- Static file serving ---

static_dir = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
else:
    @app.get("/")
    def root():
        return HTMLResponse(
            "<html><body><h1>Hello World</h1>"
            "<p>Backend is running. Frontend not yet built.</p>"
            "</body></html>"
        )
