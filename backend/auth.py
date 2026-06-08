import logging
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

_DEFAULT_SECRET = "dev-secret-key-change-in-prod-minimum-32-chars"
SECRET_KEY = os.getenv("SECRET_KEY", _DEFAULT_SECRET)

if SECRET_KEY == _DEFAULT_SECRET:
    logging.warning(
        "SECRET_KEY is using the insecure default value. "
        "Set SECRET_KEY in your environment before deploying."
    )
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
