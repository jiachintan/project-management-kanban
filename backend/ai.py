import json
import os

import anthropic
from dotenv import load_dotenv

from ai_schema import (
    BoardUpdate,
    ChatResponse,
    CreateCardOp,
    DeleteCardOp,
    MoveCardOp,
    UpdateCardOp,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client: anthropic.Anthropic | None = None

_UPDATE_BOARD_TOOL = {
    "name": "update_board",
    "description": "Apply one or more operations to the Kanban board",
    "input_schema": {
        "type": "object",
        "properties": {
            "operations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "op": {
                            "type": "string",
                            "enum": ["create_card", "update_card", "delete_card", "move_card"],
                        },
                        "column_id": {"type": "integer"},
                        "card_id": {"type": "integer"},
                        "title": {"type": "string"},
                        "details": {"type": "string"},
                        "position": {"type": "integer"},
                    },
                    "required": ["op"],
                },
            }
        },
        "required": ["operations"],
    },
}


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("CLAUDE_API_KEY")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def ask(prompt: str) -> str:
    client = get_client()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def chat(message: str, history: list[dict], board: dict) -> ChatResponse:
    client = get_client()

    system = (
        "You are a helpful assistant for a Kanban project management board.\n"
        "The current board state is:\n"
        f"{json.dumps(board, indent=2)}\n\n"
        "Use the update_board tool when the user asks you to create, edit, move, or delete cards. "
        "Reference column IDs and card IDs from the board state above."
    )

    messages = list(history) + [{"role": "user", "content": message}]

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system,
        messages=messages,
        tools=[_UPDATE_BOARD_TOOL],
    )

    reply = ""
    board_update = None

    for block in response.content:
        if block.type == "text":
            reply += block.text
        elif block.type == "tool_use" and block.name == "update_board":
            ops = []
            for op_data in block.input.get("operations", []):
                op_type = op_data.get("op")
                if op_type == "create_card":
                    ops.append(CreateCardOp(**op_data))
                elif op_type == "update_card":
                    ops.append(UpdateCardOp(**op_data))
                elif op_type == "delete_card":
                    ops.append(DeleteCardOp(**op_data))
                elif op_type == "move_card":
                    ops.append(MoveCardOp(**op_data))
            if ops:
                board_update = BoardUpdate(operations=ops)

    return ChatResponse(reply=reply, board_update=board_update)
