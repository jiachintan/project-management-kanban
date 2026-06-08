from sqlalchemy.orm import Session, selectinload

from models import Board, Card, Column, User

SEED_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def get_or_create_user(db: Session, username: str) -> User:
    # NOTE: creates a new user row on first call for a given username.
    # Any valid JWT for an unknown username will silently produce a new user.
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _board_query(db: Session):
    return db.query(Board).options(
        selectinload(Board.columns).selectinload(Column.cards)
    )


def get_or_create_board(db: Session, user: User) -> Board:
    board = _board_query(db).filter(Board.user_id == user.id).first()
    if not board:
        board = Board(user_id=user.id, title="My Board")
        db.add(board)
        db.flush()
        for i, title in enumerate(SEED_COLUMNS):
            db.add(Column(board_id=board.id, title=title, position=i))
        db.commit()
        board = _board_query(db).filter(Board.id == board.id).first()
    return board


def get_board(db: Session, username: str) -> Board:
    user = get_or_create_user(db, username)
    return get_or_create_board(db, user)


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
