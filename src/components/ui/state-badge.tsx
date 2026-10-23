"use client";

import { stateLabels, stateTone, type StateTone } from "@/config/ui";
import Chip from "@mui/material/Chip";

export function StateBadge({
  state,
  label,
  tone,
}: {
  state: string;
  label?: string;
  tone?: StateTone;
}) {
  const resolvedTone = tone ?? stateTone(state);
  const color = resolvedTone === "neutral" ? "default" : resolvedTone;
  return (
    <Chip
      className={`status ui-badge ui-badge-${resolvedTone}`}
      data-state={state}
      color={color}
      size="small"
      label={label ?? stateLabels[state] ?? state}
    />
  );
}
