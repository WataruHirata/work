import { stateLabels, stateTone, type StateTone } from "@/config/ui";

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
  return (
    <span className={`status ui-badge ui-badge-${resolvedTone}`} data-state={state}>
      {label ?? stateLabels[state] ?? state}
    </span>
  );
}
