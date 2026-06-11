from sqlalchemy.orm import Session, selectinload

from auth import hash_password, verify_password
from models import Board, Card, Column, User

SEED_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def register_user(db: Session, username: str, password: str) -> User | None:
    if db.query(User).filter(User.username == username).first():
        return None
    user = User(username=username, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def get_user(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def _board_query(db: Session):
    return db.query(Board).options(
        selectinload(Board.columns).selectinload(Column.cards)
    )


def _seed_board(db: Session, board: Board) -> Board:
    for i, title in enumerate(SEED_COLUMNS):
        db.add(Column(board_id=board.id, title=title, position=i))
    db.commit()
    return _board_query(db).filter(Board.id == board.id).first()


def list_boards(db: Session, username: str) -> list[Board]:
    user = get_user(db, username)
    if not user:
        return []
    return _board_query(db).filter(Board.user_id == user.id).order_by(Board.id).all()


def create_board(db: Session, username: str, title: str) -> Board | None:
    user = get_user(db, username)
    if not user:
        return None
    board = Board(user_id=user.id, title=title)
    db.add(board)
    db.flush()
    return _seed_board(db, board)


def rename_board(db: Session, board_id: int, title: str, username: str) -> Board | None:
    user = get_user(db, username)
    if not user:
        return None
    board = db.query(Board).filter(Board.id == board_id, Board.user_id == user.id).first()
    if not board:
        return None
    board.title = title
    db.commit()
    db.refresh(board)
    return board


def delete_board(db: Session, board_id: int, username: str) -> bool:
    user = get_user(db, username)
    if not user:
        return False
    board = db.query(Board).filter(Board.id == board_id, Board.user_id == user.id).first()
    if not board:
        return False
    db.delete(board)
    db.commit()
    return True


def get_board(db: Session, username: str, board_id: int | None = None) -> Board | None:
    user = get_user(db, username)
    if not user:
        return None
    if board_id is not None:
        return _board_query(db).filter(Board.id == board_id, Board.user_id == user.id).first()
    # Return the first board, creating one if none exist
    board = _board_query(db).filter(Board.user_id == user.id).order_by(Board.id).first()
    if not board:
        board = Board(user_id=user.id, title="My Board")
        db.add(board)
        db.flush()
        board = _seed_board(db, board)
    return board


def board_to_dict(board: Board) -> dict:
    return {
        "id": board.id,
        "title": board.title,
        "columns": [
            {
                "id": col.id,
                "title": col.title,
                "position": col.position,
                "cards": [
                    {"id": c.id, "title": c.title, "details": c.details, "position": c.position}
                    for c in col.cards
                ],
            }
            for col in board.columns
        ],
    }


def rename_column(db: Session, column_id: int, title: str, board: Board) -> Column | None:
    col = db.query(Column).filter(Column.id == column_id, Column.board_id == board.id).first()
    if not col:
        return None
    col.title = title
    db.commit()
    db.refresh(col)
    return col


def create_card(db: Session, column_id: int, title: str, details: str, board: Board) -> Card | None:
    col = db.query(Column).filter(Column.id == column_id, Column.board_id == board.id).first()
    if not col:
        return None
    position = len(col.cards)
    card = Card(column_id=column_id, title=title, details=details, position=position)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def update_card(db: Session, card_id: int, title: str, details: str, board: Board) -> Card | None:
    card = (
        db.query(Card)
        .join(Column)
        .filter(Card.id == card_id, Column.board_id == board.id)
        .first()
    )
    if not card:
        return None
    card.title = title
    card.details = details
    db.commit()
    db.refresh(card)
    return card


def delete_card(db: Session, card_id: int, board: Board) -> bool:
    card = (
        db.query(Card)
        .join(Column)
        .filter(Card.id == card_id, Column.board_id == board.id)
        .first()
    )
    if not card:
        return False
    db.delete(card)
    db.commit()
    return True


def move_card(db: Session, card_id: int, column_id: int, position: int, board: Board) -> Card | None:
    card = (
        db.query(Card)
        .join(Column)
        .filter(Card.id == card_id, Column.board_id == board.id)
        .first()
    )
    target_col = db.query(Column).filter(Column.id == column_id, Column.board_id == board.id).first()
    if not card or not target_col:
        return None

    card.column_id = column_id
    card.position = position
    db.commit()
    db.refresh(card)
    return card
