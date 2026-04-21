import { getAllowedStatusesForZone, getStatusTone } from "@/lib/kingston/helpers";
import type { ExternalStatus, Zone } from "@/lib/kingston/types";

type CaseStatusSelectProps = {
  value: ExternalStatus;
  zone: Zone;
  onChange: (status: ExternalStatus) => void;
  disabled?: boolean;
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

export function CaseStatusSelect({ value, zone, onChange, disabled = false }: CaseStatusSelectProps) {
  const statusOptions = getAllowedStatusesForZone(zone);

  return (
    <select
      className={`workspace-status-select ${getToneClass(value)}`}
      value={value}
      onChange={(event) => onChange(event.target.value as ExternalStatus)}
      aria-label="Cambiar estado del caso"
      disabled={disabled}
    >
      {statusOptions.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}
