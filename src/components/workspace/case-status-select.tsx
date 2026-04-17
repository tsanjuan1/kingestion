import { workflowStates } from "@/lib/kingston/data";
import { getStatusTone } from "@/lib/kingston/helpers";
import type { ExternalStatus } from "@/lib/kingston/types";

type CaseStatusSelectProps = {
  value: ExternalStatus;
  onChange: (status: ExternalStatus) => void;
};

function getToneClass(status: ExternalStatus) {
  switch (getStatusTone(status)) {
    case "danger":
      return "workspace-status-select-danger";
    case "success":
      return "workspace-status-select-success";
    case "warning":
      return "workspace-status-select-warning";
    case "accent":
      return "workspace-status-select-accent";
    default:
      return "workspace-status-select-neutral";
  }
}

export function CaseStatusSelect({ value, onChange }: CaseStatusSelectProps) {
  return (
    <select
      className={`workspace-status-select ${getToneClass(value)}`}
      value={value}
      onChange={(event) => onChange(event.target.value as ExternalStatus)}
      aria-label="Cambiar estado del caso"
    >
      {workflowStates.map((state) => (
        <option key={state.status} value={state.status}>
          {state.status}
        </option>
      ))}
    </select>
  );
}
