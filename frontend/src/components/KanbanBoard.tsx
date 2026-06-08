"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { moveCard, type BoardData } from "@/lib/kanban";
import * as api from "@/lib/api";

function colKey(id: number) {
  return `col-${id}`;
}
function cardKey(id: number) {
  return `card-${id}`;
}
function parseColId(key: string) {
  return parseInt(key.slice(4));
}
function parseCardId(key: string) {
  return parseInt(key.slice(5));
}

function apiBoardToLocal(apiBoard: api.ApiBoard): BoardData {
  const cards: BoardData["cards"] = {};
  const columns = apiBoard.columns.map((col) => {
    const sorted = [...col.cards].sort((a, b) => a.position - b.position);
    const cardIds = sorted.map((card) => {
      const id = cardKey(card.id);
      cards[id] = { id, title: card.title, details: card.details };
      return id;
    });
    return { id: colKey(col.id), title: col.title, cardIds };
  });
  return { columns, cards };
}

type KanbanBoardProps = {
  onLogout: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardTitle, setBoardTitle] = useState<string>("");
  const [boards, setBoards] = useState<api.ApiBoardSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [editingBoardTitle, setEditingBoardTitle] = useState(false);
  const [editBoardValue, setEditBoardValue] = useState("");

  const loadBoards = useCallback(async () => {
    try {
      const list = await api.listBoards();
      setBoards(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const loadBoard = useCallback(
    (id?: number) => {
      api
        .getBoard(id)
        .then((data) => {
          setBoard(apiBoardToLocal(data));
          setBoardId(data.id);
          setBoardTitle(data.title);
        })
        .catch(() => setError("Failed to load board"));
    },
    []
  );

  useEffect(() => {
    loadBoards().then((list) => {
      if (list.length > 0) {
        loadBoard(list[0].id);
      } else {
        loadBoard();
      }
    });
  }, [loadBoards, loadBoard]);

  const switchBoard = (id: number) => {
    setBoard(null);
    setShowBoardMenu(false);
    loadBoard(id);
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newBoardTitle.trim();
    if (!title) return;
    setCreatingBoard(true);
    try {
      const created = await api.createBoard(title);
      setNewBoardTitle("");
      await loadBoards();
      switchBoard(created.id);
    } catch {
      setError("Failed to create board");
    } finally {
      setCreatingBoard(false);
    }
  };

  const handleDeleteBoard = async (id: number) => {
    if (!confirm("Delete this board and all its cards?")) return;
    try {
      await api.deleteBoard(id);
      const list = await loadBoards();
      if (list.length > 0) {
        switchBoard(list[0].id);
      } else {
        loadBoard();
      }
    } catch {
      setError("Failed to delete board");
    }
  };

  const handleRenameBoardCommit = async () => {
    if (!boardId || !editBoardValue.trim()) return;
    setEditingBoardTitle(false);
    try {
      await api.renameBoard(boardId, editBoardValue.trim());
      setBoardTitle(editBoardValue.trim());
      await loadBoards();
    } catch {
      setError("Failed to rename board");
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCorners(args);
  }, []);

  const cardsById = useMemo(() => board?.cards ?? {}, [board]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id || !board) return;

    const cardId = active.id as string;
    const prevColumns = board.columns;
    const newColumns = moveCard(prevColumns, cardId, over.id as string);
    setBoard((prev) => (prev ? { ...prev, columns: newColumns } : prev));

    const newColumn = newColumns.find((col) => col.cardIds.includes(cardId));
    if (newColumn) {
      const position = newColumn.cardIds.indexOf(cardId);
      api
        .moveCard(parseCardId(cardId), parseColId(newColumn.id), position)
        .catch(() => {
          setBoard((prev) => (prev ? { ...prev, columns: prevColumns } : prev));
        });
    }
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map((col) =>
              col.id === columnId ? { ...col, title } : col
            ),
          }
        : prev
    );
  };

  const handleRenameColumnCommit = (columnId: string, title: string) => {
    api.renameColumn(parseColId(columnId), title).catch(() => loadBoard(boardId ?? undefined));
  };

  const handleAddCard = async (
    columnId: string,
    title: string,
    details: string
  ) => {
    try {
      const card = await api.createCard(parseColId(columnId), title, details);
      const id = cardKey(card.id);
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: {
                ...prev.cards,
                [id]: { id, title: card.title, details: card.details },
              },
              columns: prev.columns.map((col) =>
                col.id === columnId
                  ? { ...col, cardIds: [...col.cardIds, id] }
                  : col
              ),
            }
          : prev
      );
    } catch {
      setError("Failed to add card");
    }
  };

  const handleDeleteCard = async (columnId: string, cardId: string) => {
    try {
      await api.deleteCard(parseCardId(cardId));
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: Object.fromEntries(
                Object.entries(prev.cards).filter(([id]) => id !== cardId)
              ),
              columns: prev.columns.map((col) =>
                col.id === columnId
                  ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) }
                  : col
              ),
            }
          : prev
      );
    } catch {
      setError("Failed to delete card");
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--gray-text)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

        <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
          <header className="flex flex-col gap-6 rounded-[32px] border-2 border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                  Project Management
                </p>
                {editingBoardTitle ? (
                  <input
                    autoFocus
                    value={editBoardValue}
                    onChange={(e) => setEditBoardValue(e.target.value)}
                    onBlur={handleRenameBoardCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameBoardCommit();
                      if (e.key === "Escape") setEditingBoardTitle(false);
                    }}
                    className="mt-3 w-full max-w-md bg-transparent font-display text-4xl font-semibold text-[var(--navy-dark)] outline-none border-b-2 border-[var(--primary-blue)]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditBoardValue(boardTitle);
                      setEditingBoardTitle(true);
                    }}
                    className="mt-3 block text-left font-display text-4xl font-semibold text-[var(--navy-dark)] hover:text-[var(--primary-blue)] transition"
                    title="Click to rename board"
                  >
                    {boardTitle || "Kanban Studio"}
                  </button>
                )}
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                  Rename columns, drag cards between stages, and use AI to manage your board.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Board switcher */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowBoardMenu((v) => !v)}
                    className="flex items-center gap-2 rounded-xl border-2 border-[var(--stroke)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--primary-blue)]">
                      <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2zM2 9a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1v-1a1 1 0 00-1-1H2zM1 15a1 1 0 011-1h16a1 1 0 011 1v1a1 1 0 01-1 1H2a1 1 0 01-1-1v-1z" />
                    </svg>
                    Boards
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[var(--gray-text)]">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {showBoardMenu && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border-2 border-[var(--stroke)] bg-white p-3 shadow-[var(--shadow)]">
                      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                        Your boards
                      </p>
                      <div className="space-y-1">
                        {boards.map((b) => (
                          <div
                            key={b.id}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                              b.id === boardId
                                ? "bg-[var(--surface)] font-semibold text-[var(--navy-dark)]"
                                : "text-[var(--gray-text)] hover:bg-[var(--surface)]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => switchBoard(b.id)}
                              className="flex-1 text-left text-sm"
                            >
                              {b.title}
                            </button>
                            {boards.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteBoard(b.id)}
                                className="ml-2 rounded-full p-1 text-[var(--gray-text)] hover:bg-red-50 hover:text-red-500 transition"
                                aria-label={`Delete ${b.title}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                        {boards.length === 0 && (
                          <p className="px-3 py-2 text-sm text-[var(--gray-text)]">No boards yet</p>
                        )}
                      </div>
                      <form onSubmit={handleCreateBoard} className="mt-3 flex gap-2 border-t-2 border-[var(--stroke)] pt-3">
                        <input
                          value={newBoardTitle}
                          onChange={(e) => setNewBoardTitle(e.target.value)}
                          placeholder="New board name..."
                          className="flex-1 rounded-lg border-2 border-[var(--stroke)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                        />
                        <button
                          type="submit"
                          disabled={creatingBoard || !newBoardTitle.trim()}
                          className="rounded-lg bg-[var(--secondary-purple)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                        >
                          Create
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-2 rounded-xl bg-[var(--navy-dark)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-blue)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-1.073a.75.75 0 10-1.004-1.114l-2.5 2.5a.75.75 0 000 1.114l2.5 2.5a.75.75 0 101.004-1.114L8.704 10.75H18.25A.75.75 0 0019 10z" clipRule="evenodd" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>

            {board && (
              <div className="flex flex-wrap items-center gap-4">
                {board.columns.map((column) => (
                  <div
                    key={column.id}
                    className="flex items-center gap-2 rounded-full border-2 border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
                  >
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                    {column.title}
                  </div>
                ))}
              </div>
            )}
          </header>

          {!board ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <p className="text-sm text-[var(--gray-text)]">Loading board...</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <section className="grid gap-6 lg:grid-cols-5">
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId])}
                    onRename={handleRenameColumn}
                    onRenameCommit={handleRenameColumnCommit}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                  />
                ))}
              </section>
              <DragOverlay>
                {activeCard ? (
                  <div className="w-[260px]">
                    <KanbanCardPreview card={activeCard} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </main>
      </div>
      <AIChatSidebar onBoardUpdate={() => loadBoard(boardId ?? undefined)} boardId={boardId ?? undefined} />

      {/* Backdrop for board menu */}
      {showBoardMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowBoardMenu(false)}
        />
      )}
    </div>
  );
};
