// Transitional re-export. The read layer now lives in `@/lib/data` (see
// `./data/queries`); this shim keeps existing `@/lib/queries` imports working.
// New code should import from `@/lib/data`. Safe to delete once migrated.
export * from "./data/queries";
