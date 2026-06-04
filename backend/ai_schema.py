from typing import Literal

from pydantic import BaseModel


class CreateCardOp(BaseModel):
    op: Literal["create_card"]
    column_id: int
    title: str
    details: str = ""


class UpdateCardOp(BaseModel):
    op: Literal["update_card"]
    card_id: int
    title: str
    details: str = ""


class DeleteCardOp(BaseModel):
    op: Literal["delete_card"]
    card_id: int


class MoveCardOp(BaseModel):
    op: Literal["move_card"]
    card_id: int
    column_id: int
    position: int


BoardOperation = CreateCardOp | UpdateCardOp | DeleteCardOp | MoveCardOp


class BoardUpdate(BaseModel):
    operations: list[BoardOperation]


class ChatResponse(BaseModel):
    reply: str
    board_update: BoardUpdate | None = None
