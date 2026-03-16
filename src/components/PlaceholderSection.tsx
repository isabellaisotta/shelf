interface Props {
  title: string;
  description: string;
}

export default function PlaceholderSection({ title, description }: Props) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="bg-surface rounded-xl border border-border p-10">
        <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted text-sm">{description}</p>
        <div className="mt-4 text-xs text-muted-light">Coming soon</div>
      </div>
    </div>
  );
}
