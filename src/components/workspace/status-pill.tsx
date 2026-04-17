import { getSlaTone, getStatusTone } from "@/lib/kingston/helpers";
import type { ExternalStatus } from "@/lib/kingston/types";

type StatusPillProps =
  | {
      kind: "status";
      value: ExternalStatus;
    }
  | {
      kind: "sla";
      value: string;
      label: string;
    };

function getToneClasses(tone: "neutral" | "accent" | "danger" | "warning" | "success") {
  switch (tone) {
    case "accent":
      return "border-[rgba(56,189,248,0.28)] bg-[rgba(56,189,248,0.14)] text-[#bae6fd]";
    case "danger":
      return "border-[rgba(251,113,133,0.28)] bg-[rgba(251,113,133,0.14)] text-[#fecdd3]";
    case "warning":
      return "border-[rgba(251,191,36,0.28)] bg-[rgba(251,191,36,0.14)] text-[#fde68a]";
    case "success":
      return "border-[rgba(74,222,128,0.28)] bg-[rgba(74,222,128,0.14)] text-[#bbf7d0]";
    default:
      return "border-white/12 bg-white/6 text-white";
  }
}

export function StatusPill(props: StatusPillProps) {
  const tone = props.kind === "status" ? getStatusTone(props.value) : getSlaTone(props.value);
  const label = props.kind === "status" ? props.value : props.label;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${getToneClasses(
        tone
      )}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
