export type Room = {
  id: string;
  name: string;
  length: number; // decimal feet
  breadth: number; // decimal feet
  areaFt2: number;
  areaOverridden: boolean;
  areaExpr?: string; // multi-part area such as "214.5+891.87"
  source: "label" | "measured";
};

export type FloorGroup = {
  id: string;
  name: string;
  merged: boolean;
  info: string;
  rooms: Room[];
};

export type Drawing = {
  id: string;
  originalName: string;
  uploadedAt: string;
  stats: {
    entities: number;
    layers: number;
    insUnits: number | null;
    textEntities: number;
    roomLabels: number;
    floorTitles: number;
  };
  groups: FloorGroup[];
};

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

type ApiResponse<T> = { success: boolean; data?: T; message: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error("Cannot reach the backend. Check that it is running on " + API_BASE);
  }
  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return body.data;
}

export async function uploadDrawing(file: File): Promise<Drawing> {
  const form = new FormData();
  form.append("file", file);
  return request<Drawing>("/api/drawings", { method: "POST", body: form });
}

export const getDrawing = (id: string) => request<Drawing>(`/api/drawings/${id}`);

export async function saveDrawing(id: string, groups: FloorGroup[]): Promise<void> {
  await request<{ saved: boolean }>(`/api/drawings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groups }),
  });
}

export const csvUrl = (id: string) => `${API_BASE}/api/drawings/${id}/export.csv`;
export const xlsxUrl = (id: string) => `${API_BASE}/api/drawings/${id}/export.xlsx`;
