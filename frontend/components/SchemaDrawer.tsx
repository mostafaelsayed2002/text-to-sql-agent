"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SchemaResponse } from "@/lib/types";
import { SchemaViewer } from "./SchemaViewer";

export const MIN_DRAWER_WIDTH = 360;
export const MAX_DRAWER_WIDTH = 960;
export const DEFAULT_DRAWER_WIDTH = 576;
export const DRAWER_WIDTH_STORAGE_KEY = "schemaDrawerWidth";
/** Pixels the panel grows/shrinks per arrow-key press on the resize handle. */
const KEYBOARD_STEP = 32;

/** Strip of page kept visible beside the panel on screens too narrow to shift. */
const MIN_PAGE_GUTTER = 48;

/**
 * Keeps the panel inside the viewport and always leaves a sliver of the page
 * showing, so the page never disappears behind it on a phone.
 */
export function clampDrawerWidth(width: number) {
  const viewport =
    typeof window === "undefined" ? MAX_DRAWER_WIDTH : window.innerWidth;
  const max = Math.min(MAX_DRAWER_WIDTH, viewport - MIN_PAGE_GUTTER);
  // max wins when the viewport is narrower than the minimum.
  return Math.min(Math.max(width, MIN_DRAWER_WIDTH), max);
}

function storeWidth(width: number) {
  try {
    window.localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Blocked storage: the width just won't outlive the session.
  }
}

/**
 * Side panel holding the schema.
 *
 * Deliberately NOT a modal: no backdrop, no scroll lock, no focus trap, and it
 * does not steal focus on open. The page behind stays fully interactive, and on
 * wide screens the caller shifts the content over rather than letting the panel
 * cover it. Kept mounted while closed (translated off-screen, `invisible`) so it
 * animates and nothing inside stays focusable.
 */
export function SchemaDrawer({
  schema,
  open,
  width,
  onWidthChange,
  onClose,
}: {
  schema: SchemaResponse;
  open: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
}) {
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const dragging = useRef(false);

  // Escape closes it, but only that — the panel never captures the keyboard.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Dragging left widens the panel, so ArrowLeft should too.
      const step =
        e.key === "ArrowLeft"
          ? KEYBOARD_STEP
          : e.key === "ArrowRight"
            ? -KEYBOARD_STEP
            : 0;
      if (step === 0) return;
      e.preventDefault();
      const next = clampDrawerWidth(width + step);
      onWidthChange(next);
      storeWidth(next);
    },
    [width, onWidthChange],
  );

  return (
    <aside
      aria-label="Database schema"
      aria-hidden={!open}
      style={{ width }}
      className={`fixed right-0 top-0 z-40 flex h-full max-w-full flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-950 ${
        open ? "translate-x-0" : "invisible translate-x-full"
      }`}
    >
      {/* Resizing only makes sense where the panel is not already full-width. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize schema panel"
        aria-valuenow={width}
        aria-valuemin={MIN_DRAWER_WIDTH}
        aria-valuemax={MAX_DRAWER_WIDTH}
        tabIndex={open ? 0 : -1}
        onKeyDown={onHandleKeyDown}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragStart.current = { x: e.clientX, width };
          dragging.current = true;
          document.body.classList.add("select-none");
        }}
        onPointerMove={(e) => {
          if (!dragStart.current) return;
          // Moving left increases the width.
          onWidthChange(
            clampDrawerWidth(dragStart.current.width + (dragStart.current.x - e.clientX)),
          );
        }}
        onPointerUp={(e) => {
          if (!dragStart.current) return;
          e.currentTarget.releasePointerCapture(e.pointerId);
          dragStart.current = null;
          dragging.current = false;
          document.body.classList.remove("select-none");
          storeWidth(width);
        }}
        className="absolute left-0 top-0 hidden h-full w-2 -translate-x-1/2 cursor-col-resize touch-none outline-none transition-colors hover:bg-slate-300/60 focus-visible:bg-slate-400 lg:block dark:hover:bg-slate-700/60 dark:focus-visible:bg-slate-600"
      />

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 dark:border-slate-800">
        <h2 className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
          Database schema{" "}
          <span className="font-normal text-slate-400 dark:text-slate-500">
            ({schema.tables.length} tables)
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close schema"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        <SchemaViewer schema={schema} />
      </div>
    </aside>
  );
}
