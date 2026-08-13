"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { HqScope } from "@/lib/hq/role";

// ── DEV ONLY — role preview ────────────────────────────────────────────────
// Renders the page as another role would see it so each screen can be designed
// against all three permission sets. It is a *view* filter and nothing more:
// it writes to the URL (?as=), never to the database, and never grants
// authority — every server action still checks the caller's real role. You can
// only ever preview downward from what you actually are.

const ROLES: { key: HqScope; label: string }[] = [
  { key: "president", label: "President" },
  { key: "captain", label: "Captain" },
  { key: "member", label: "Member" },
];

/** Lives in the shell, so it's on every HQ page. Reads its own value from the
 *  URL; each page resolves the same `?as=` server-side via lib/hq/role. */
export function RoleSwitch({ real }: { real: HqScope }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const allowed: HqScope[] =
    real === "president" ? ["president", "captain", "member"] : real === "captain" ? ["captain", "member"] : ["member"];
  const askedRaw = params.get("as") as HqScope | null;
  const value: HqScope = askedRaw && allowed.includes(askedRaw) ? askedRaw : real;

  function pick(role: HqScope) {
    const next = new URLSearchParams(params.toString());
    if (role === real) next.delete("as");
    else next.set("as", role);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setOpen(false);
  }

  const active = ROLES.find((r) => r.key === value) ?? ROLES[0];
  const previewing = value !== real;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="hq-mono flex items-center gap-2 rounded-[3px] border border-dashed px-2.5 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors"
        style={{
          borderColor: previewing ? "var(--color-flag)" : "#4b5a52",
          color: previewing ? "var(--color-flag)" : "#6d8076",
        }}
        title="Development only — previews this page as another role. Does not change your real role."
      >
        View as: {active.label}
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-label="Close" />
          {/* top-full + margin, not an arbitrary calc: CSS requires whitespace
              around `+` inside calc(), so `top-[calc(100%+6px)]` is invalid and
              Tailwind emits no rule at all — the menu then falls back to
              `top: auto` and lands over the top bar, out of reach. */}
          <div className="hq-panel absolute right-0 top-full z-20 mt-1.5 w-[220px] p-1.5">
            <p className="hq-label px-2.5 py-1.5 opacity-70">Preview role · dev</p>
            {ROLES.filter((r) => allowed.includes(r.key)).map((r) => (
              <button
                key={r.key}
                onClick={() => pick(r.key)}
                className="flex w-full items-center justify-between rounded-[3px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                style={{ color: r.key === value ? "var(--color-ink)" : "var(--color-ink-soft)" }}
              >
                {r.label}
                {r.key === real && <span className="hq-label opacity-60">actual</span>}
              </button>
            ))}
            <p className="hq-label px-2.5 pb-1.5 pt-2 leading-relaxed opacity-50">
              View filter only. Your real role and the database are untouched.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
