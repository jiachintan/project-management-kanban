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

export async function getBoard(): Promise<ApiBoard> {
  const res = await fetch("/api/board");
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
  history: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}
