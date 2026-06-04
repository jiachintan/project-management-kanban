def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_login_success(client):
    res = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert res.status_code == 200
    assert res.json() == {"username": "user"}
    assert "session" in res.cookies


def test_login_wrong_password(client):
    res = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert res.status_code == 401


def test_login_wrong_username(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "password"})
    assert res.status_code == 401


def test_me_unauthenticated(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_authenticated(authed_client):
    res = authed_client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json() == {"username": "user"}


def test_logout(authed_client):
    res = authed_client.post("/api/auth/logout")
    assert res.status_code == 200
    # Session should be cleared after logout
    res = authed_client.get("/api/auth/me")
    assert res.status_code == 401
