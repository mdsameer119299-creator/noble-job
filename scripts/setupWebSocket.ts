/**
 * setupWebSocket.ts — WebSocket polyfill for Supabase on Node < 22.
 *
 * @supabase/supabase-js's createClient always constructs a RealtimeClient
 * (@supabase/realtime-js), whose constructor requires a global WebSocket. Node
 * 20 has none (it landed unflagged in Node 22), so on GitHub Actions' Node 20
 * runner createClient throws "Node.js 20 detected without native WebSocket
 * support" before any query runs.
 *
 * We never use Realtime (no .channel()/.subscribe() anywhere) — all DB access is
 * REST/PostgREST. This polyfill only satisfies the constructor's WebSocket
 * lookup; no socket is ever opened. Import it FIRST, before any module that
 * (transitively) imports supabase-js.
 */
import { WebSocket as NodeWebSocket } from "ws"

const g = globalThis as { WebSocket?: unknown }
if (typeof g.WebSocket === "undefined") {
  g.WebSocket = NodeWebSocket
}
