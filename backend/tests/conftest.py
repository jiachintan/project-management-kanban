import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from crud import register_user
from database import get_db
from main import app
from models import Base

TEST_USERNAME = "testuser"
TEST_PASSWORD = "testpass123"


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def authed_client(client, db_session):
    register_user(db_session, TEST_USERNAME, TEST_PASSWORD)
    client.post("/api/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})
    return client
