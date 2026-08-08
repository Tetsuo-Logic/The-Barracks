import Link from "next/link";

export function AddDateButton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <Link
      href="/?sheet=new"
      scroll={false}
      className={`inline-block rounded-[4px] border border-sand/60 px-6 py-3 font-mono text-sm font-medium uppercase tracking-[0.12em] text-sand transition-colors hover:border-sand hover:[box-shadow:0_0_16px_-4px_var(--color-sand)] ${className}`}
    >
      + New game
    </Link>
  );
}
