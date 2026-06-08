import pytest
from crud import (
    SEED_COLUMNS,
    authenticate_user,
    board_to_dict,
    create_board,
    create_card,
    delete_card,
    get_board,
    list_boards,
    move_card,
    register_user,
    rename_board,
    rename_column,
    update_card,
)
from models import Board, Column


@pytest.fixture
def alice(db_session):
    return register_user(db_session, "alice", "password123")


def test_register_user_creates(db_session):
    user = register_user(db_session, "alice", "pass123")
    assert user is not None
    assert user.username == "alice"
    assert user.password_hash is not None


def test_register_user_duplicate_returns_none(db_session):
    register_user(db_session, "alice", "pass123")
    result = register_user(db_session, "alice", "other")
    assert result is None


def test_authenticate_user_correct_password(db_session):
    register_user(db_session, "alice", "pass123")
    user = authenticate_user(db_session, "alice", "pass123")
    assert user is not None
    assert user.username == "alice"


def test_authenticate_user_wrong_password(db_session):
    register_user(db_session, "alice", "pass123")
    result = authenticate_user(db_session, "alice", "wrong")
    assert result is None


def test_authenticate_user_unknown(db_session):
    result = authenticate_user(db_session, "nobody", "pass")
    assert result is None


def test_get_board_creates_default(db_session, alice):
    board = get_board(db_session, "alice")
    assert board is not None
    assert len(board.columns) == 5
    assert [c.title for c in board.columns] == SEED_COLUMNS


def test_get_board_idempotent(db_session, alice):
    b1 = get_board(db_session, "alice")
    b2 = get_board(db_session, "alice")
    assert b1.id == b2.id


def test_get_board_unknown_user_returns_none(db_session):
    result = get_board(db_session, "nobody")
    assert result is None


def test_board_to_dict(db_session, alice):
    board = get_board(db_session, "alice")
    d = board_to_dict(board)
    assert "id" in d
    assert "title" in d
    assert len(d["columns"]) == 5
    assert "cards" in d["columns"][0]


def test_list_boards(db_session, alice):
    create_board(db_session, "alice", "Board A")
    create_board(db_session, "alice", "Board B")
    boards = list_boards(db_session, "alice")
    assert len(boards) == 2
    titles = [b.title for b in boards]
    assert "Board A" in titles
    assert "Board B" in titles


def test_create_board(db_session, alice):
    get_board(db_session, "alice")  # create default
    board = create_board(db_session, "alice", "Project X")
    assert board is not None
    assert board.title == "Project X"
    assert len(board.columns) == 5


def test_rename_board(db_session, alice):
    board = get_board(db_session, "alice")
    result = rename_board(db_session, board.id, "Renamed", "alice")
    assert result is not None
    assert result.title == "Renamed"


def test_rename_board_wrong_user(db_session, alice):
    board = get_board(db_session, "alice")
    register_user(db_session, "bob", "pass123")
    result = rename_board(db_session, board.id, "Hacked", "bob")
    assert result is None


def test_rename_column_success(db_session, alice):
    board = get_board(db_session, "alice")
    col = board.columns[0]
    result = rename_column(db_session, col.id, "New Title", board)
    assert result is not None
    assert result.title == "New Title"


def test_rename_column_wrong_board(db_session, alice):
    board = get_board(db_session, "alice")
    other_board = Board(user_id=board.user_id, title="Other")
    db_session.add(other_board)
    db_session.flush()
    other_col = Column(board_id=other_board.id, title="X", position=0)
    db_session.add(other_col)
    db_session.commit()
    result = rename_column(db_session, other_col.id, "Hacked", board)
    assert result is None


def test_create_card_success(db_session, alice):
    board = get_board(db_session, "alice")
    col = board.columns[0]
    card = create_card(db_session, col.id, "My card", "Details", board)
    assert card is not None
    assert card.title == "My card"
    assert card.position == 0


def test_create_card_invalid_column(db_session, alice):
    board = get_board(db_session, "alice")
    result = create_card(db_session, 99999, "X", "", board)
    assert result is None


def test_update_card_success(db_session, alice):
    board = get_board(db_session, "alice")
    col = board.columns[0]
    card = create_card(db_session, col.id, "Original", "", board)
    updated = update_card(db_session, card.id, "Updated", "New details", board)
    assert updated.title == "Updated"
    assert updated.details == "New details"


def test_update_card_not_found(db_session, alice):
    board = get_board(db_session, "alice")
    result = update_card(db_session, 99999, "X", "", board)
    assert result is None


def test_delete_card_success(db_session, alice):
    board = get_board(db_session, "alice")
    col = board.columns[0]
    card = create_card(db_session, col.id, "Delete me", "", board)
    result = delete_card(db_session, card.id, board)
    assert result is True


def test_delete_card_not_found(db_session, alice):
    board = get_board(db_session, "alice")
    result = delete_card(db_session, 99999, board)
    assert result is False


def test_move_card_success(db_session, alice):
    board = get_board(db_session, "alice")
    src = board.columns[0]
    dst = board.columns[1]
    card = create_card(db_session, src.id, "Move me", "", board)
    result = move_card(db_session, card.id, dst.id, 0, board)
    assert result is not None
    assert result.column_id == dst.id
    assert result.position == 0


def test_move_card_not_found(db_session, alice):
    board = get_board(db_session, "alice")
    result = move_card(db_session, 99999, board.columns[0].id, 0, board)
    assert result is None
