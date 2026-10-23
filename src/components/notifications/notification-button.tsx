"use client";

import { useRef, type ReactNode } from "react";
import { Bell, X } from "@/components/ui/icons";

export function NotificationButton({
  unread,
  children,
  label = "通知",
  dialogTitle = "通知一覧",
  countLabel = "未読",
}: {
  unread: number;
  children: ReactNode;
  label?: string;
  dialogTitle?: string;
  countLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="ghost-button notification-trigger"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <Bell size={18} aria-hidden="true" />
        {label}
        {unread > 0 && (
          <span className="notification-count">
            {countLabel} {unread}件
          </span>
        )}
      </button>
      <dialog
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]"))
            dialog.current?.close();
        }}
        className="notification-dialog"
        ref={dialog}
        aria-labelledby="notification-dialog-title"
      >
        <header className="notification-dialog-header">
          <h2 id="notification-dialog-title">{dialogTitle}</h2>
          <button type="button" className="ghost-button" onClick={() => dialog.current?.close()}>
            <X size={16} aria-hidden="true" /> 閉じる
          </button>
        </header>
        {children}
      </dialog>
    </>
  );
}
