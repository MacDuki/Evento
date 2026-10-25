export type QueuedRequest = { path: string; options: RequestInit };
const KEY = "abstinencia-offline-queue";

function readQueue(): QueuedRequest[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as QueuedRequest[]; }
  catch { return []; }
}

export function enqueue(request: QueuedRequest): void {
  localStorage.setItem(KEY, JSON.stringify([...readQueue(), request]));
}

export async function flush(send: (request: QueuedRequest) => Promise<void>): Promise<void> {
  const queue = readQueue();
  const remaining: QueuedRequest[] = [];
  for (const request of queue) {
    try { await send(request); } catch { remaining.push(request); }
  }
  localStorage.setItem(KEY, JSON.stringify(remaining));
}
