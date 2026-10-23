"use client";

import { Children, useId, useState, type ReactNode } from "react";
import Button from "@mui/material/Button";

export const COLLAPSED_LIST_COUNT = 3;

export function visibleListItems(items: ReactNode, expanded: boolean) {
  const children = Children.toArray(items);
  return expanded ? children : children.slice(0, COLLAPSED_LIST_COUNT);
}

export function CollapsibleList({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const items = Children.toArray(children);
  const canExpand = items.length > COLLAPSED_LIST_COUNT;

  return (
    <div className="collapsible-list-container">
      <div className={className} id={listId}>
        {visibleListItems(items, expanded)}
      </div>
      {canExpand && (
        <div className="list-expand-actions">
          <Button
            type="button"
            variant="outlined"
            size="small"
            aria-controls={listId}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "閉じる" : "全件表示"}
            <span className="sr-only">（全{items.length}件）</span>
          </Button>
        </div>
      )}
    </div>
  );
}
