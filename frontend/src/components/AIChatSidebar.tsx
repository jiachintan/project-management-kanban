"use client";

import { useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";

type Message = { id: string; role: "user" | "assistant"; content: string };

type Props = {
  onBoardUpdate: () => void;
};

export const AIChatSidebar = ({ onBoardUpdate }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const history: api.ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await api.sendChat(text, history);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: result.reply || "Done." },
      ]);
      if (result.board_updated) {
        onBoardUpdate();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-80 shrink-0 flex-col border-l border-[var(--stroke)] bg-white sticky top-0">
      <div className="border-b border-[var(--stroke)] px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]">
          AI Assistant
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-[var(--gray-text)] text-center mt-8">
            Ask me to create, move, or edit cards on your board.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                msg.role === "user"
                  ? "bg-[var(--secondary-purple)] text-white"
                  : "bg-[var(--surface)] text-[var(--navy-dark)]"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[var(--surface)] px-3 py-2 text-xs text-[var(--gray-text)]">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-[var(--stroke)] px-4 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the AI..."
          disabled={loading}
          aria-label="Chat input"
          className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--navy-dark)] placeholder-[var(--gray-text)] outline-none focus:border-[var(--primary-blue)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
};
