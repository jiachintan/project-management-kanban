from unittest.mock import MagicMock, patch

import pytest

from ai_schema import BoardUpdate, ChatResponse, CreateCardOp, DeleteCardOp, MoveCardOp, UpdateCardOp


def _make_text_block(text):
    block = MagicMock()
    block.type = "text"
    block.text = text
    return block


def _make_tool_block(operations):
    block = MagicMock()
    block.type = "tool_use"
    block.name = "update_board"
    block.input = {"operations": operations}
    return block


def _mock_ai_response(content_blocks):
    mock_client = MagicMock()
    mock_message = MagicMock()
    mock_message.content = content_blocks
    mock_client.messages.create.return_value = mock_message
    return mock_client


# --- /api/chat endpoint tests ---

def test_chat_no_board_update(authed_client):
    mock_client = _mock_ai_response([_make_text_block("Hello! How can I help?")])
    with patch("ai._client", mock_client):
        resp = authed_client.post("/api/chat", json={"message": "Hello", "history": []})
    assert resp.status_code == 200
    data = resp.json()
    assert data["reply"] == "Hello! How can I help?"
    assert data["board_updated"] is False


def test_chat_history_passed_through(authed_client):
    mock_client = _mock_ai_response([_make_text_block("Sure!")])
    with patch("ai._client", mock_client):
        resp = authed_client.post(
            "/api/chat",
            json={
                "message": "Add a card",
                "history": [
                    {"role": "user", "content": "Hi"},
                    {"role": "assistant", "content": "Hello!"},
                ],
            },
        )
    assert resp.status_code == 200
    call_kwargs = mock_client.messages.create.call_args
    messages = call_kwargs.kwargs["messages"]
    assert messages[0] == {"role": "user", "content": "Hi"}
    assert messages[1] == {"role": "assistant", "content": "Hello!"}
    assert messages[2]["content"] == "Add a card"


def test_chat_create_card(authed_client):
    # First get a column id from the board
    resp = authed_client.get("/api/board")
    column_id = resp.json()["columns"][0]["id"]

    mock_client = _mock_ai_response([
        _make_text_block("Created a card for you."),
        _make_tool_block([{"op": "create_card", "column_id": column_id, "title": "New Task", "details": ""}]),
    ])
    with patch("ai._client", mock_client):
        resp = authed_client.post("/api/chat", json={"message": "Add a card called New Task", "history": []})

    assert resp.status_code == 200
    data = resp.json()
    assert data["board_updated"] is True
    assert data["reply"] == "Created a card for you."

    # Verify card exists on board
    board = authed_client.get("/api/board").json()
    titles = [c["title"] for col in board["columns"] for c in col["cards"]]
    assert "New Task" in titles


def test_chat_update_card(authed_client):
    # Create a card first
    board = authed_client.get("/api/board").json()
    column_id = board["columns"][0]["id"]
    card_resp = authed_client.post(
        "/api/board/cards", json={"column_id": column_id, "title": "Old Title", "details": ""}
    )
    card_id = card_resp.json()["id"]

    mock_client = _mock_ai_response([
        _make_text_block("Updated the card."),
        _make_tool_block([{"op": "update_card", "card_id": card_id, "title": "New Title", "details": "updated"}]),
    ])
    with patch("ai._client", mock_client):
        resp = authed_client.post("/api/chat", json={"message": "Rename card", "history": []})

    assert resp.status_code == 200
    assert resp.json()["board_updated"] is True

    board = authed_client.get("/api/board").json()
    titles = [c["title"] for col in board["columns"] for c in col["cards"]]
    assert "New Title" in titles
    assert "Old Title" not in titles


def test_chat_delete_card(authed_client):
    board = authed_client.get("/api/board").json()
    column_id = board["columns"][0]["id"]
    card_resp = authed_client.post(
        "/api/board/cards", json={"column_id": column_id, "title": "To Delete", "details": ""}
    )
    card_id = card_resp.json()["id"]

    mock_client = _mock_ai_response([
        _make_text_block("Deleted."),
        _make_tool_block([{"op": "delete_card", "card_id": card_id}]),
    ])
    with patch("ai._client", mock_client):
        resp = authed_client.post("/api/chat", json={"message": "Delete that card", "history": []})

    assert resp.status_code == 200
    assert resp.json()["board_updated"] is True

    board = authed_client.get("/api/board").json()
    titles = [c["title"] for col in board["columns"] for c in col["cards"]]
    assert "To Delete" not in titles


def test_chat_move_card(authed_client):
    board = authed_client.get("/api/board").json()
    src_col_id = board["columns"][0]["id"]
    dst_col_id = board["columns"][1]["id"]
    card_resp = authed_client.post(
        "/api/board/cards", json={"column_id": src_col_id, "title": "Mover", "details": ""}
    )
    card_id = card_resp.json()["id"]

    mock_client = _mock_ai_response([
        _make_text_block("Moved the card."),
        _make_tool_block([{"op": "move_card", "card_id": card_id, "column_id": dst_col_id, "position": 0}]),
    ])
    with patch("ai._client", mock_client):
        resp = authed_client.post("/api/chat", json={"message": "Move card", "history": []})

    assert resp.status_code == 200
    assert resp.json()["board_updated"] is True

    board = authed_client.get("/api/board").json()
    dst_col = next(c for c in board["columns"] if c["id"] == dst_col_id)
    assert any(c["title"] == "Mover" for c in dst_col["cards"])


def test_chat_requires_auth(client):
    resp = client.post("/api/chat", json={"message": "Hello", "history": []})
    assert resp.status_code == 401


# --- ai.chat() unit tests ---

def test_ai_chat_function_no_update():
    from ai import chat
    mock_client = _mock_ai_response([_make_text_block("Just a reply.")])
    with patch("ai._client", mock_client):
        result = chat("hi", [], {"columns": []})
    assert result.reply == "Just a reply."
    assert result.board_update is None


def test_ai_chat_function_with_operations():
    from ai import chat
    mock_client = _mock_ai_response([
        _make_tool_block([{"op": "create_card", "column_id": 1, "title": "Task", "details": ""}])
    ])
    with patch("ai._client", mock_client):
        result = chat("add a card", [], {"columns": []})
    assert result.board_update is not None
    assert len(result.board_update.operations) == 1
    op = result.board_update.operations[0]
    assert isinstance(op, CreateCardOp)
    assert op.title == "Task"
