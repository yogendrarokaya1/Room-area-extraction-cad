"use client";

import { useState } from "react";
import type { FloorGroup, Room } from "@/lib/api";
import { SQFT_TO_SQM, round2, round4, formatMeters } from "@/lib/units";
import { AreaInput, FeetInput } from "./FieldInputs";

const ROOM_NAMES = [
  "Bedroom", "Master Bedroom", "Living Room", "Kitchen", "Kitchen+Dining", "Dining",
  "Foyer", "Lobby", "Open Lobby", "Corridor", "Water Closet", "Attached W/C",
  "Common W/C", "Walk In Closet", "Balcony", "Shop", "Lift", "Staircase",
  "Electrical Room", "Void Shaft", "Parking", "Parking Area", "Store", "Hall",
];

const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number) => nf.format(n);
const sqm = (ft2: number) => ft2 * SQFT_TO_SQM;
const sumArea = (rooms: Room[]) => rooms.reduce((s, r) => s + r.areaFt2, 0);
const roomsLabel = (n: number) => `${n} ${n === 1 ? "room" : "rooms"}`;

const th = "px-4 py-3 text-xs font-semibold text-muted";

export function RoomTable({
  groups,
  onChange,
}: {
  groups: FloorGroup[];
  onChange: (next: FloorGroup[]) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const patchGroup = (gid: string, patch: Partial<FloorGroup>) =>
    onChange(groups.map((g) => (g.id === gid ? { ...g, ...patch } : g)));

  const patchRoom = (gid: string, rid: string, patch: Partial<Room>) =>
    onChange(
      groups.map((g) =>
        g.id !== gid ? g : { ...g, rooms: g.rooms.map((r) => (r.id === rid ? { ...r, ...patch } : r)) },
      ),
    );

  // Changing a size recalculates the area and drops any typed area / sum
  const setSize = (g: FloorGroup, r: Room, key: "length" | "breadth", feet: number) => {
    const length = key === "length" ? feet : r.length;
    const breadth = key === "breadth" ? feet : r.breadth;
    patchRoom(g.id, r.id, {
      [key]: round4(feet),
      areaFt2: round2(length * breadth),
      areaOverridden: false,
      areaExpr: undefined,
    });
  };

  const addRoom = (gid: string) =>
    onChange(
      groups.map((g) =>
        g.id !== gid
          ? g
          : {
              ...g,
              rooms: [
                ...g.rooms,
                { id: crypto.randomUUID(), name: "New room", length: 0, breadth: 0, areaFt2: 0, areaOverridden: false, source: "label" },
              ],
            },
      ),
    );

  const removeRoom = (gid: string, rid: string) =>
    onChange(groups.map((g) => (g.id !== gid ? g : { ...g, rooms: g.rooms.filter((r) => r.id !== rid) })));

  const grand = groups.reduce((s, g) => s + sumArea(g.rooms), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <datalist id="room-names">
        {ROOM_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className={`${th} w-16 text-left`}>S.N.</th>
            <th className={`${th} text-left`}>Room</th>
            <th className={`${th} w-36 text-right`}>Length (ft-in)</th>
            <th className={`${th} w-36 text-right`}>Breadth (ft-in)</th>
            <th className={`${th} w-40 text-right`}>Area (ft²)</th>
            <th className={`${th} w-32 text-right`}>Area (m²)</th>
            <th className="w-12" />
          </tr>
        </thead>

        {groups.map((g) => {
          const open = !collapsed[g.id];
          const sub = sumArea(g.rooms);
          return (
            <tbody key={g.id} className="border-b border-line">
              <tr className="bg-band">
                <td colSpan={7} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [g.id]: open }))}
                      aria-expanded={open}
                      aria-label={open ? `Collapse ${g.name}` : `Expand ${g.name}`}
                      className="rounded px-1 text-muted hover:text-fg"
                    >
                      <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
                    </button>
                    <span className="font-semibold">Floor:</span>
                    <input
                      aria-label="Floor name"
                      value={g.name}
                      onChange={(e) => patchGroup(g.id, { name: e.target.value })}
                      className="min-w-[16rem] rounded border border-transparent bg-transparent px-2 py-1 font-semibold text-fg hover:border-line focus:border-accent"
                    />
                    <span className="text-xs text-muted">({roomsLabel(g.rooms.length)})</span>
                    <button
                      type="button"
                      aria-pressed={g.merged}
                      onClick={() => patchGroup(g.id, { merged: !g.merged })}
                      title="A merged group is drawn once but stands for several floors"
                      className={`rounded border px-2 py-0.5 text-xs ${
                        g.merged
                          ? "border-amber/50 bg-amber/10 text-amber"
                          : "border-line text-muted hover:text-fg"
                      }`}
                    >
                      {g.merged ? "Merged Group" : "Mark as merged"}
                    </button>
                    {g.info && <span className="hidden text-xs text-muted lg:inline">{g.info}</span>}
                  </div>
                </td>
              </tr>

              {open &&
                g.rooms.map((r, i) => {
                  const sn = i + 1; // S.N. restarts on every floor, like the client's sheet
                  return (
                    <tr key={r.id} className="border-t border-line/60">
                      <td className="px-4 py-2 text-muted">{sn}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            aria-label={`Room name, ${g.name} ${sn}`}
                            list="room-names"
                            value={r.name}
                            onChange={(e) => patchRoom(g.id, r.id, { name: e.target.value })}
                            className="w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-fg"
                          />
                          {r.source === "measured" && (
                            <span
                              className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                              title="Auto-measured from CAD boundary geometry"
                            >
                              Measured
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <FeetInput label={`Length, ${g.name} ${sn}`} value={r.length} onCommit={(f) => setSize(g, r, "length", f)} />
                        {r.length > 0 && (
                          <div className="mt-0.5 text-right font-mono text-[10px] text-muted">{formatMeters(r.length)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <FeetInput label={`Breadth, ${g.name} ${sn}`} value={r.breadth} onCommit={(f) => setSize(g, r, "breadth", f)} />
                        {r.breadth > 0 && (
                          <div className="mt-0.5 text-right font-mono text-[10px] text-muted">{formatMeters(r.breadth)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <AreaInput
                          label={`Area, ${g.name} ${sn}`}
                          value={r.areaFt2}
                          expr={r.areaExpr}
                          overridden={r.areaOverridden}
                          onCommit={(a, expr) =>
                            patchRoom(g.id, r.id, { areaFt2: round2(a), areaOverridden: true, areaExpr: expr })
                          }
                          onReset={() =>
                            patchRoom(g.id, r.id, {
                              areaFt2: round2(r.length * r.breadth),
                              areaOverridden: false,
                              areaExpr: undefined,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-fg">{fmt(sqm(r.areaFt2))}</td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRoom(g.id, r.id)}
                          aria-label={`Remove room ${sn} from ${g.name}`}
                          title="Remove room"
                          className="rounded px-2 py-1 text-muted hover:bg-band hover:text-danger"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {open && (
                <tr>
                  <td />
                  <td colSpan={6} className="px-4 pb-3 pt-1">
                    <button type="button" onClick={() => addRoom(g.id)} className="text-xs text-accent hover:underline">
                      + Add room to {g.name.toLowerCase()}
                    </button>
                  </td>
                </tr>
              )}

              <tr className="bg-band/60 font-semibold">
                <td className="px-4 py-3 text-muted">Σ</td>
                <td colSpan={3} className="px-4 py-3 text-xs text-muted">
                  SUBTOTAL – {g.name} ({roomsLabel(g.rooms.length)})
                </td>
                <td className="px-4 py-3 text-right font-mono">{fmt(sub)}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(sqm(sub))}</td>
                <td />
              </tr>
            </tbody>
          );
        })}

        <tfoot>
          <tr className="bg-band">
            <td className="px-4 py-4 text-accent">Σ</td>
            <td colSpan={3} className="px-4 py-4 font-semibold">
              TOTAL – ALL FLOORS
            </td>
            <td className="px-4 py-4 text-right font-mono font-semibold">{fmt(grand)}</td>
            <td className="px-4 py-4 text-right font-mono font-semibold">{fmt(sqm(grand))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
