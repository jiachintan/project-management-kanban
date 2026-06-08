from tests.conftest import TEST_PASSWORD, TEST_USERNAME


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_register_success(client):
    res = client.post("/api/auth/register", json={"username": "newuser", "password": "securepass"})
    assert res.status_code == 201
    assert res.json() == {"username": "newuser"}


def test_register_duplicate_username(client):
    client.post("/api/auth/register", json={"username": "newuser", "password": "securepass"})
    res = client.post("/api/auth/register", json={"username": "newuser", "password": "securepass"})
    assert res.status_code == 409


def test_register_short_username(client):
    res = client.post("/api/auth/register", json={"username": "ab", "password": "securepass"})
    assert res.status_code == 422


def test_register_short_password(client):
    res = client.post("/api/auth/register", json={"username": "newuser", "password": "abc"})
    assert res.status_code == 422


def test_login_success(client, db_session):
    from crud import register_user
    register_user(db_session, TEST_USERNAME, TEST_PASSWORD)
    res = client.post("/api/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})
    assert res.status_code == 200
    assert res.json() == {"username": TEST_USERNAME}
    assert "session" in res.cookies


def test_login_wrong_password(client, db_session):
    from crud import register_user
    register_user(db_session, TEST_USERNAME, TEST_PASSWORD)
    res = client.post("/api/auth/login", json={"username": TEST_USERNAME, "password": "wrong"})
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post("/api/auth/login", json={"username": "nobody", "password": "pass"})
    assert res.status_code == 401


def test_me_unauthenticated(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_authenticated(authed_client):
    res = authed_client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json() == {"username": TEST_USERNAME}


def test_logout(authed_client):
    res = authed_client.post("/api/auth/logout")
    assert res.status_code == 200
    res = authed_client.get("/api/auth/me")
    assert res.status_code == 401
