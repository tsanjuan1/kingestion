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
      return "border-[rgba(90,186,173,0.28)] bg-[rgba(90,186,173,0.12)] text-[#b7fbf2]";
    case "danger":
      return "border-[rgba(255,120,104,0.28)] bg-[rgba(255,120,104,0.12)] text-[#ffcdc6]";
    case "warning":
      return "border-[rgba(255,193,90,0.28)] bg-[rgba(255,193,90,0.12)] text-[#ffe0ad]";
    case "success":
      return "border-[rgba(123,214,145,0.28)] bg-[rgba(123,214,145,0.12)] text-[#d6ffe0]";
    default:
      return "border-[rgba(237,233,223,0.14)] bg-[rgba(255,255,255,0.06)] text-[#ede9df]";
  }
}

export function StatusPill(props: StatusPillProps) {
  const tone = props.kind === "status" ? getStatusTone(props.value) : getSlaTone(props.value);
  const label = props.kind === "status" ? props.value : props.label;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${getToneClasses(
        tone
      )}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
