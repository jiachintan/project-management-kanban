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
  const [error, setError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const loadBoard = useCallback(() => {
    api
      .getBoard()
      .then((data) => setBoard(apiBoardToLocal(data)))
      .catch(() => setError("Failed to load board"));
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

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
    api.renameColumn(parseColId(columnId), title).catch(() => loadBoard());
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

  if (!board) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--gray-text)]">Loading...</p>
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
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between
                stages, and capture quick notes without getting buried in
                settings.
              </p>
            </div>
            <div className="flex items-center gap-3">
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
        </header>

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
      </main>
      </div>
      <AIChatSidebar onBoardUpdate={loadBoard} />
    </div>
  );
};
