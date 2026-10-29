"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDrawing } from "@/lib/api";

const MAX_MB = 50;

export function UploadBox() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!file.name.toLowerCase().endsWith(".dwg")) {
      setError("Choose an AutoCAD .dwg file.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`This file is larger than ${MAX_MB} MB.`);
      return;
    }

    setBusy(true);
    try {
      const drawing = await uploadDrawing(file);
      router.push(`/drawings/${drawing.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files[0]);
        }}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-accent bg-band" : "border-line bg-panel"
        }`}
      >
        <p className="text-lg font-semibold">{busy ? "Reading your drawing…" : "Drop a .dwg file here"}</p>
        <p className="mt-2 text-sm text-muted">
          {busy ? "Large drawings can take up to a minute." : `AutoCAD drawing, up to ${MAX_MB} MB`}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".dwg"
          className="sr-only"
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Processing" : "Choose file"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
