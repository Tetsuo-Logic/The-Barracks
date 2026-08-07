// Empty states invite, they don't apologise (§11).
export function EmptyState({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="max-w-[28ch] text-ink-soft">{children}</p>
      {action}
    </div>
  );
}
