// Transitional re-export. The domain types now live in `@/lib/domain`; this
// shim keeps existing `@/lib/types` imports working. New code should import
// from `@/lib/domain`. Safe to delete once imports are migrated.
export * from "./domain";
