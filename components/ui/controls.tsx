"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 border-transparent shadow-sm",
    secondary: "bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-sm",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
    danger: "bg-white text-red-600 hover:bg-red-50 border-red-200",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  group,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Render as a group instead of a <label> (for button groups such as Segmented). */
  group?: boolean;
}) {
  const content = (
    <>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </>
  );
  if (group) {
    return (
      <div role="group" className={cn("flex w-full min-w-0 flex-col gap-1", className)}>
        {content}
      </div>
    );
  }
  return <label className={cn("flex w-full min-w-0 flex-col gap-1", className)}>{content}</label>;
}

const inputBase =
  "h-8 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-xs outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400";

function formatForDisplay(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  allowNull = false,
  min,
  max,
  placeholder,
  className,
  disabled,
  ariaLabel,
  invalid,
  commitOnBlur = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  prefix?: string;
  suffix?: string;
  allowNull?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  invalid?: boolean;
  /** Keep keystrokes local and write the value only when the field loses focus. */
  commitOnBlur?: boolean;
}) {
  const [text, setText] = useState(formatForDisplay(value));
  const focused = useRef(false);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (!focused.current) setText(formatForDisplay(value));
  }, [value]);

  const commit = (raw: string): number | null => {
    const cleaned = raw.replace(/[,\s]/g, "");
    if (cleaned === "" || cleaned === "-") {
      onChange(allowNull ? null : 0);
      return allowNull ? null : 0;
    }
    let n = Number(cleaned);
    if (!Number.isFinite(n)) return value;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n);
    return n;
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      {prefix && <span className="pointer-events-none absolute left-2.5 text-xs text-slate-400">{prefix}</span>}
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(inputBase, "num w-full text-right", prefix && "pl-7", suffix && "pr-7", invalid && "border-red-400 focus:border-red-500 focus:ring-red-100")}
        value={text}
        placeholder={placeholder ?? (allowNull ? "None" : "0")}
        onFocus={(e) => {
          focused.current = true;
          setText(value === null ? "" : String(value));
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => {
          focused.current = false;
          if (commitOnBlur) setText(formatForDisplay(commit(textRef.current)));
          else setText(formatForDisplay(value));
        }}
        onChange={(e) => {
          textRef.current = e.target.value;
          setText(e.target.value);
          if (!commitOnBlur) commit(e.target.value);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 text-xs text-slate-400">{suffix}</span>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className={cn(inputBase, className ?? "w-full")}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className={cn(inputBase, "pr-7", className ?? "w-full")}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="flex w-fit max-w-full flex-wrap gap-1 self-start rounded-md border border-slate-300 bg-slate-100 p-1 lg:gap-0 lg:p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "max-w-full min-w-0 rounded px-3 text-left font-medium whitespace-normal transition-colors disabled:opacity-40 lg:whitespace-nowrap lg:px-2.5 lg:text-center",
            size === "sm" ? "text-xs lg:h-6" : "text-sm lg:h-7",
            value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors before:absolute before:-inset-3 before:content-[''] disabled:opacity-50 lg:before:hidden",
          checked ? "bg-brand-600" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer select-none">
          {label && <div className="text-sm font-medium text-slate-800">{label}</div>}
          {description && <div className="text-xs text-slate-500">{description}</div>}
        </label>
      )}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 py-1 text-sm text-slate-700 lg:min-h-0 lg:py-0">
      <input
        type="checkbox"
        className="h-5 w-5 rounded border-slate-300 accent-brand-600 lg:h-4 lg:w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function Menu({
  trigger,
  children,
  align = "right",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            "absolute z-40 mt-1 max-w-[calc(100vw-1rem)] min-w-52 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  icon,
  danger,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-center gap-2 px-3 py-1.5 text-left text-sm disabled:opacity-40",
        danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50",
      )}
    >
      {icon && <span className="text-slate-400">{icon}</span>}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 border-t border-slate-100" />;
}
