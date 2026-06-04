import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def authed_client(client):
    client.post("/api/auth/login", json={"username": "user", "password": "password"})
    return client
