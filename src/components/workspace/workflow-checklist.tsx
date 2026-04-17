"use client";

import { workflowStates } from "@/lib/kingston/data";
import type { ExternalStatus } from "@/lib/kingston/types";

type WorkflowChecklistProps = {
  value: ExternalStatus;
  onChange: (status: ExternalStatus) => void;
};

export function WorkflowChecklist({ value, onChange }: WorkflowChecklistProps) {
  const currentIndex = workflowStates.findIndex((entry) => entry.status === value);

  return (
    <div className="workflow-checklist" aria-label="Checklist de estados">
      {workflowStates.map((state, index) => {
        const isCurrent = state.status === value;
        const isCompleted = currentIndex > -1 && index < currentIndex;
        const itemClassName = [
          "workflow-checklist-item",
          isCompleted ? "workflow-checklist-item-completed" : "",
          isCurrent ? "workflow-checklist-item-current" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={state.status}
            type="button"
            className={itemClassName}
            onClick={() => onChange(state.status)}
            aria-pressed={isCurrent}
          >
            <span className="workflow-checklist-dot">{isCompleted ? "✓" : index + 1}</span>
            <span className="workflow-checklist-label">{state.status}</span>
          </button>
        );
      })}
    </div>
  );
}
