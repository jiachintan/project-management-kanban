"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/KanbanBoard";

export default function Home() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) router.replace("/login");
        else setAuthed(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (!authed) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-[#888888]">Loading...</p>
    </div>
  );
  return <KanbanBoard onLogout={handleLogout} />;
}
