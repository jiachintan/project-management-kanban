import pytest
from crud import (
    SEED_COLUMNS,
    board_to_dict,
    create_card,
    delete_card,
    get_board,
    get_or_create_board,
    get_or_create_user,
    move_card,
    rename_column,
    update_card,
)
from models import Board, Column


def test_get_or_create_user_creates(db_session):
    user = get_or_create_user(db_session, "alice")
    assert user.id is not None
    assert user.username == "alice"


def test_get_or_create_user_idempotent(db_session):
    u1 = get_or_create_user(db_session, "alice")
    u2 = get_or_create_user(db_session, "alice")
    assert u1.id == u2.id


def test_get_or_create_board_seeds_columns(db_session):
    user = get_or_create_user(db_session, "alice")
    board = get_or_create_board(db_session, user)
    assert len(board.columns) == 5
    assert [c.title for c in board.columns] == SEED_COLUMNS


def test_get_or_create_board_idempotent(db_session):
    user = get_or_create_user(db_session, "alice")
    b1 = get_or_create_board(db_session, user)
    b2 = get_or_create_board(db_session, user)
    assert b1.id == b2.id


def test_board_to_dict(db_session):
    board = get_board(db_session, "alice")
    d = board_to_dict(board)
    assert "id" in d
    assert "title" in d
    assert len(d["columns"]) == 5
    assert "cards" in d["columns"][0]


def test_rename_column_success(db_session):
    board = get_board(db_session, "alice")
    col = board.columns[0]
    result = rename_column(db_session, col.id, "New Title", board)
    assert result is not None
    assert result.title == "New Title"


def test_rename_column_wrong_board(db_session):
    board = get_board(db_session, "alice")
    other_board = Board(user_id=board.user_id, title="Other")
    db_session.add(other_board)
    db_session.flush()
    other_col = Column(board_id=other_board.id, title="X", position=0)
    db_session.add(other_col)
    db_session.commit()
    result = rename_column(db_session, other_col.id, "Hacked", board)
    assert result is None


def test_create_card_success(db_session):
    board = get_board(db_session, "alice")
    col = board.columns[0]
    card = create_card(db_session, col.id, "My card", "Details", board)
    assert card is not None
    assert card.title == "My card"
    assert card.position == 0


def test_create_card_invalid_column(db_session):
    board = get_board(db_session, "alice")
    result = create_card(db_session, 99999, "X", "", board)
    assert result is None


def test_update_card_success(db_session):
    board = get_board(db_session, "alice")
    col = board.columns[0]
    card = create_card(db_session, col.id, "Original", "", board)
    updated = update_card(db_session, card.id, "Updated", "New details", board)
    assert updated.title == "Updated"
    assert updated.details == "New details"


def test_update_card_not_found(db_session):
    board = get_board(db_session, "alice")
    result = update_card(db_session, 99999, "X", "", board)
    assert result is None


def test_delete_card_success(db_session):
    board = get_board(db_session, "alice")
    col = board.columns[0]
    card = create_card(db_session, col.id, "Delete me", "", board)
    result = delete_card(db_session, card.id, board)
    assert result is True


def test_delete_card_not_found(db_session):
    board = get_board(db_session, "alice")
    result = delete_card(db_session, 99999, board)
    assert result is False


def test_move_card_success(db_session):
    board = get_board(db_session, "alice")
    src = board.columns[0]
    dst = board.columns[1]
    card = create_card(db_session, src.id, "Move me", "", board)
    result = move_card(db_session, card.id, dst.id, 0, board)
    assert result is not None
    assert result.column_id == dst.id
    assert result.position == 0


def test_move_card_not_found(db_session):
    board = get_board(db_session, "alice")
    result = move_card(db_session, 99999, board.columns[0].id, 0, board)
    assert result is None
