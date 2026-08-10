import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/LoginForm";

// /login — email + password. No social, no magic link (works inside the PWA).
export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-[100dvh] flex-col justify-center bg-paper px-6">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="mb-6 text-[72px] leading-none">🪖</div>
        <p className="label mb-3" style={{ color: "var(--color-sand)" }}>The Barracks</p>
        <h1 className="display text-[36px] font-bold uppercase leading-[0.95] tracking-[0.01em] text-ink [text-shadow:0_0_22px_rgba(245,182,61,0.2)]">
          Report for duty.
        </h1>
        <p className="mt-2 font-narrow text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
          Games-night ops for the squad. No appeals.
        </p>
        <p className="mt-4 text-ink-soft">
          Email and a password. That&apos;s it. 📡
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
