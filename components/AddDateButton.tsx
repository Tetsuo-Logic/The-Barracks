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
      className={`inline-block rounded-[3px] border border-ink px-6 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-ink ${className}`}
    >
      + Add a date
    </Link>
  );
}
