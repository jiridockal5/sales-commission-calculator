"use client";

import { AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn, Switch } from "./controls";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("avoid-break rounded-lg border border-slate-200 bg-white shadow-xs", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children !== undefined && <div className={cn("p-4", bodyClassName)}>{children}</div>}
    </section>
  );
}

/** Progressive disclosure: a feature card whose settings only show when enabled. */
export function FeatureCard({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: ReactNode;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border bg-white shadow-xs", enabled ? "border-brand-100" : "border-slate-200")}>
      <div className="px-4 py-3">
        <Switch checked={enabled} onChange={onToggle} label={title} description={description} />
      </div>
      {enabled && children && <div className="border-t border-slate-100 p-4">{children}</div>}
    </section>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warning" | "error"; children: ReactNode }) {
  const styles = {
    info: "border-brand-100 bg-brand-50 text-brand-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-700",
  }[tone];
  return (
    <div className={cn("flex gap-2 rounded-md border px-3 py-2 text-xs", styles)}>
      {tone === "info" ? <Info className="mt-px h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "brand" | "green" | "amber" | "red" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-600",
    brand: "bg-brand-50 text-brand-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  }[tone];
  return <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium", styles)}>{children}</span>;
}

export function KpiCard({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("avoid-break rounded-lg border bg-white px-4 py-3 shadow-xs", emphasis ? "border-brand-100 ring-1 ring-brand-100" : "border-slate-200")}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cn("num mt-1 truncate font-semibold tracking-tight", emphasis ? "text-xl text-brand-700" : "text-xl text-slate-900")}>{value}</div>
      {sub && <div className="num mt-0.5 truncate text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string }[];
}) {
  return (
    <div className="no-print flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            value === t.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{children}</div>;
}

/** Table primitives with consistent finance-table styling. */
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, align = "left", className }: { children?: ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-slate-100 px-3 py-2",
        align === "right" ? "num text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}
