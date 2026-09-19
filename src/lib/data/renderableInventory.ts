/**
 * renderableInventory.ts — the local (seeded) inventories with every incomplete /
 * non-renderable record removed, computed ONCE per process and shared.
 *
 * Every local read path (lists, detail-by-id, counts, featured, hero/category
 * counters) goes through these instead of the raw `*_INVENTORY` constants, so a
 * malformed generated row can never surface as a job and counts always describe
 * exactly the rows that can be displayed. The underlying constants are untouched.
 *
 * The implementation lives beside the inventories in jobInventory.ts (so the count
 * helpers there can use it without an import cycle); this module is the stable,
 * intention-revealing import path for services.
 */
export { renderablePrivateInventory, renderableWfhInventory, renderableAbroadInventory } from "@/lib/data/jobInventory"
