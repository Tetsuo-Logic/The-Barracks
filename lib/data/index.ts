// The data layer: server-side reads (queries) and, alongside, the write
// commands (`./commands`). This is the UI-agnostic surface both mobile and a
// future web client call. Import reads from `@/lib/data`; import command
// modules directly, e.g. `@/lib/data/commands/radar`.
export * from "./queries";
