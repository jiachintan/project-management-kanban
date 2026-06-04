def test_get_board_unauthenticated(client):
    res = client.get("/api/board")
    assert res.status_code == 401


def test_get_board_creates_default(authed_client):
    res = authed_client.get("/api/board")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "My Board"
    assert len(data["columns"]) == 5
    titles = [c["title"] for c in data["columns"]]
    assert titles == ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def test_get_board_idempotent(authed_client):
    res1 = authed_client.get("/api/board")
    res2 = authed_client.get("/api/board")
    assert res1.json()["id"] == res2.json()["id"]


def test_rename_column(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = board["columns"][0]["id"]
    res = authed_client.put(f"/api/board/columns/{col_id}", json={"title": "Todo"})
    assert res.status_code == 200
    assert res.json()["title"] == "Todo"
    board2 = authed_client.get("/api/board").json()
    assert board2["columns"][0]["title"] == "Todo"


def test_rename_column_not_found(authed_client):
    authed_client.get("/api/board")
    res = authed_client.put("/api/board/columns/99999", json={"title": "X"})
    assert res.status_code == 404


def test_create_card(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = board["columns"][0]["id"]
    res = authed_client.post("/api/board/cards", json={"column_id": col_id, "title": "New card", "details": "Some details"})
    assert res.status_code == 201
    card = res.json()
    assert card["title"] == "New card"
    assert card["details"] == "Some details"


def test_create_card_invalid_column(authed_client):
    authed_client.get("/api/board")
    res = authed_client.post("/api/board/cards", json={"column_id": 99999, "title": "X"})
    assert res.status_code == 404


def test_update_card(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = board["columns"][0]["id"]
    card = authed_client.post("/api/board/cards", json={"column_id": col_id, "title": "Original"}).json()
    res = authed_client.put(f"/api/board/cards/{card['id']}", json={"title": "Updated", "details": "New details"})
    assert res.status_code == 200
    assert res.json()["title"] == "Updated"
    assert res.json()["details"] == "New details"


def test_update_card_not_found(authed_client):
    authed_client.get("/api/board")
    res = authed_client.put("/api/board/cards/99999", json={"title": "X"})
    assert res.status_code == 404


def test_delete_card(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = board["columns"][0]["id"]
    card = authed_client.post("/api/board/cards", json={"column_id": col_id, "title": "To delete"}).json()
    res = authed_client.delete(f"/api/board/cards/{card['id']}")
    assert res.status_code == 204
    board2 = authed_client.get("/api/board").json()
    card_ids = [c["id"] for c in board2["columns"][0]["cards"]]
    assert card["id"] not in card_ids


def test_delete_card_not_found(authed_client):
    authed_client.get("/api/board")
    res = authed_client.delete("/api/board/cards/99999")
    assert res.status_code == 404


def test_move_card(authed_client):
    board = authed_client.get("/api/board").json()
    src_col_id = board["columns"][0]["id"]
    dst_col_id = board["columns"][1]["id"]
    card = authed_client.post("/api/board/cards", json={"column_id": src_col_id, "title": "Move me"}).json()
    res = authed_client.put(f"/api/board/cards/{card['id']}/move", json={"column_id": dst_col_id, "position": 0})
    assert res.status_code == 200
    assert res.json()["column_id"] == dst_col_id


def test_move_card_not_found(authed_client):
    authed_client.get("/api/board")
    res = authed_client.put("/api/board/cards/99999/move", json={"column_id": 1, "position": 0})
    assert res.status_code == 404
