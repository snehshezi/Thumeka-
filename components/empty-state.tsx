type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div
      className="rounded-lg border border-dashed border-black/20 bg-white p-6 text-center"
      data-testid="empty-state"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-black/60">{body}</p>
    </div>
  );
}
