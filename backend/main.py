import os

from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from auth import VALID_PASSWORD, VALID_USERNAME, create_token, verify_token

app = FastAPI()

COOKIE_NAME = "session"


class LoginRequest(BaseModel):
    username: str
    password: str


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(body: LoginRequest, response: Response):
    if body.username != VALID_USERNAME or body.password != VALID_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(body.username)
    response.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax")
    return {"username": body.username}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@app.get("/api/auth/me")
def me(session: str | None = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    username = verify_token(session)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid session")
    return {"username": username}


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
