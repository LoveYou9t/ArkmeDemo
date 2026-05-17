import { cn } from "@/lib/utils";

export type MetaPillTone = "primary" | "muted" | "danger";

export default function MetaPill({
  label,
  tone = "muted",
  className,
}: {
  label: string;
  tone?: MetaPillTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-4",
        tone === "primary" && "bg-primary-soft text-primary",
        tone === "muted" && "bg-fill-3 text-text-tertiary",
        tone === "danger" && "bg-[rgba(255,77,79,0.10)] text-danger",
        className
      )}
    >
      {label}
    </span>
  );
}
