import type { ReactNode } from "react";

export function Section({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line py-16">
      <header className="mb-10 grid gap-3">
        <p className="font-mono text-caption text-fg-tertiary">{index}</p>
        <h2 id={`${id}-title`} className="text-h2">
          {title}
        </h2>
        {description ? <p className="max-w-prose text-body-lg text-fg-secondary">{description}</p> : null}
      </header>
      {/* One column that never grows past the page: a wide specimen scrolls inside itself instead. */}
      <div className="grid grid-cols-1 gap-12">{children}</div>
    </section>
  );
}

export function SubSection({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <div className="grid gap-1">
        <h3 className="text-body font-semibold">{title}</h3>
        {note ? <p className="max-w-prose text-small text-fg-secondary">{note}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Specimen({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex min-h-24 flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-5">{children}</div>
      {label ? <p className="mt-2 font-mono text-caption text-fg-tertiary">{label}</p> : null}
    </div>
  );
}
