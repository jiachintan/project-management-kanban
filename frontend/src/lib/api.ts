export type ApiCard = {
  id: number;
  title: string;
  details: string;
  position: number;
};

export type ApiColumn = {
  id: number;
  title: string;
  cards: ApiCard[];
};

export type ApiBoard = {
  id: number;
  title: string;
  columns: ApiColumn[];
};

export type ApiBoardSummary = {
  id: number;
  title: string;
};

export async function register(username: string, password: string): Promise<{ username: string }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 409) throw new Error("Username already taken");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Registration failed");
  }
  return res.json();
}

export async function listBoards(): Promise<ApiBoardSummary[]> {
  const res = await fetch("/api/boards");
  if (!res.ok) throw new Error("Failed to list boards");
  return res.json();
}

export async function createBoard(title: string): Promise<ApiBoardSummary> {
  const res = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create board");
  return res.json();
}

export async function renameBoard(boardId: number, title: string): Promise<ApiBoardSummary> {
  const res = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to rename board");
  return res.json();
}

export async function deleteBoard(boardId: number): Promise<void> {
  const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete board");
}

export async function getBoard(boardId?: number): Promise<ApiBoard> {
  const url = boardId != null ? `/api/board?board_id=${boardId}` : "/api/board";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load board");
  return res.json();
}

export async function renameColumn(columnId: number, title: string): Promise<void> {
  const res = await fetch(`/api/board/columns/${columnId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to rename column");
}

export async function createCard(
  columnId: number,
  title: string,
  details: string
): Promise<ApiCard> {
  const res = await fetch("/api/board/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column_id: columnId, title, details }),
  });
  if (!res.ok) throw new Error("Failed to create card");
  return res.json();
}

export async function deleteCard(cardId: number): Promise<void> {
  const res = await fetch(`/api/board/cards/${cardId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete card");
}

export async function moveCard(
  cardId: number,
  columnId: number,
  position: number
): Promise<void> {
  const res = await fetch(`/api/board/cards/${cardId}/move`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column_id: columnId, position }),
  });
  if (!res.ok) throw new Error("Failed to move card");
}

export type ChatMessage = { role: string; content: string };
export type ChatResponse = { reply: string; board_updated: boolean };

export async function sendChat(
  message: string,
  history: ChatMessage[],
  boardId?: number
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, board_id: boardId ?? null }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}
