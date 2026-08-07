import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/LoginForm";
import { GolfScene } from "@/components/GolfScene";

// /login — single field, magic link. No password, no social, no signup (§5).
export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-[100dvh] flex-col justify-center bg-paper px-6">
      <div className="mx-auto w-full max-w-[520px]">
        <GolfScene className="mb-6 w-44" />
        <p className="label mb-3">The Threeball ⛳</p>
        <h1 className="font-sans text-[32px] font-extrabold leading-tight text-ink">
          A private league.
        </h1>
        <p className="mt-2 font-narrow text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
          Three players. One president. No appeals.
        </p>
        <p className="mt-4 text-ink-soft">
          Email and a password. That&apos;s it.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
