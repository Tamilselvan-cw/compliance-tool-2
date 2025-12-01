// src/components/rbac/Can.tsx
import * as React from "react";

type Mode = "disable" | "hide";

type CanProps<T extends Record<string, any>> = {
  ok: boolean;                 // permission result
  mode?: Mode;                 // "disable" (default) or "hide"
  fallback?: React.ReactNode;  // shown when mode="hide" and !ok
  children: React.ReactElement<T>;
};

export default function Can<T extends Record<string, any>>({
  ok,
  mode = "disable",
  fallback = null,
  children,
}: CanProps<T>) {
  if (ok) return children;

  if (mode === "hide") {
    return <>{fallback}</>;
  }

  // mode === "disable"
  // Build extra props safely; only set `disabled` if child already supports it.
  const extras: Partial<T> & React.AriaAttributes & { style?: React.CSSProperties } = {} as any;

  if ("disabled" in (children.props as any)) {
    (extras as any).disabled = true;
  }

  // Always make it visually non-interactive
  (extras as any)["aria-disabled"] = true;
  const style: React.CSSProperties = {
    ...(children.props as any).style,
    pointerEvents: "none",
    opacity: 0.5,
    cursor: "not-allowed",
  };
  (extras as any).style = style;

  // Nuke click handler if present
  if ("onClick" in (children.props as any)) {
    (extras as any).onClick = undefined;
  }

  return React.cloneElement(children, extras);
}
