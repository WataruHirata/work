"use client";

import { Children, useId, useState, type ReactNode } from "react";
import Button from "@mui/material/Button";

export const COLLAPSED_ROW_COUNT = 3;

export function visibleTableRows(rows: ReactNode, expanded: boolean) {
  const items = Children.toArray(rows);
  return expanded ? items : items.slice(0, COLLAPSED_ROW_COUNT);
}

export function CollapsibleTable({
  caption,
  head,
  children,
  className = "data-table",
  containerClassName = "workspace-table",
  defaultExpanded = false,
}: {
  caption?: ReactNode;
  head: ReactNode;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rowGroupId = useId();
  const rows = Children.toArray(children);
  const canExpand = rows.length > COLLAPSED_ROW_COUNT;

  return (
    <div className={containerClassName}>
      <table className={className}>
        {caption && <caption>{caption}</caption>}
        <thead>{head}</thead>
        <tbody id={rowGroupId}>{visibleTableRows(rows, expanded)}</tbody>
      </table>
      {canExpand && (
        <div className="table-expand-actions">
          <Button
            type="button"
            variant="outlined"
            size="small"
            className="table-expand-button"
            aria-controls={rowGroupId}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "閉じる" : "全件表示"}
            <span className="sr-only">（全{rows.length}件）</span>
          </Button>
        </div>
      )}
    </div>
  );
}
