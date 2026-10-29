"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { csvUrl, getDrawing, saveDrawing, xlsxUrl, type Drawing, type FloorGroup } from "@/lib/api";
import { SQFT_TO_SQM } from "@/lib/units";
import { RoomTable } from "./RoomTable";

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

export function ResultsView({ id }: { id: string }) {
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [groups, setGroups] = useState<FloorGroup[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDrawing(id)
      .then((d) => {
        if (cancelled) return;
        setDrawing(d);
        setGroups(d.groups);
        setStatus({ kind: "ready" });
      })
      .catch((e: Error) => !cancelled && setStatus({ kind: "error", message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save(): Promise<boolean> {
    setSaving(true);
    setNotice(null);
    try {
      await saveDrawing(id, groups);
      setDirty(false);
      setNotice("Changes saved");
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Exports are built from the saved copy, so save first
  async function download(url: string) {
    if (dirty && !(await save())) return;
    window.location.assign(url);
  }

  if (status.kind === "loading") return <p className="p-10 text-muted">Loading drawing…</p>;
  if (status.kind === "error")
    return (
      <div className="p-10">
        <p role="alert" className="text-danger">{status.message}</p>
        <Link href="/" className="mt-4 inline-block text-accent hover:underline">Upload another drawing</Link>
      </div>
    );

  const roomCount = groups.reduce((n, g) => n + g.rooms.length, 0);
  const total = groups.reduce((s, g) => s + g.rooms.reduce((a, r) => a + r.areaFt2, 0), 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-accent hover:underline">← Upload another drawing</Link>
          <h1 className="mt-2 text-2xl font-semibold">{drawing?.originalName}</h1>
          <p className="mt-1 text-sm text-muted">
            {groups.length} {groups.length === 1 ? "floor" : "floors"} · {roomCount} {roomCount === 1 ? "room" : "rooms"} · {total.toLocaleString("en-US", { maximumFractionDigits: 2 })} ft² (
            {(total * SQFT_TO_SQM).toLocaleString("en-US", { maximumFractionDigits: 2 })} m²)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {notice && <span role="status" className="text-sm text-ok">{notice}</span>}
          <button
            type="button"
            onClick={() => download(csvUrl(id))}
            className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:bg-band hover:text-fg"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => download(xlsxUrl(id))}
            className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-band"
          >
            Export Excel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      <p className="mb-5 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-muted">
        Sizes come from the room labels written on the drawing, and area is length × breadth. Edit any
        size to recalculate. Type an area directly to override it, or add parts together the way
        the client’s sheet does (214.5+891.87). Rooms without a written size, such as parking, are
        not listed: use “Add room” and type their measured area. Floor names can be renamed.
      </p>

      <RoomTable
        groups={groups}
        onChange={(next) => {
          setGroups(next);
          setDirty(true);
          setNotice(null);
        }}
      />
    </main>
  );
}
