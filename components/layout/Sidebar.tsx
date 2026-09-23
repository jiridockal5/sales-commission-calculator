"use client";

import {
  BarChart3,
  Calculator,
  GitCompareArrows,
  Layers,
  Settings2,
  SlidersHorizontal,
  Tags,
  Target,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/controls";

export const NAV_ITEMS = [
  { href: "/setup", label: "Plan setup", icon: Settings2 },
  { href: "/quota", label: "Quota & performance", icon: Target },
  { href: "/rules", label: "Commission rules", icon: Layers },
  { href: "/revenue", label: "Revenue types", icon: Tags },
  { href: "/advanced", label: "Advanced rules", icon: SlidersHorizontal },
  { href: "/compensation", label: "Compensation", icon: Wallet },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/compare", label: "Compare plans", icon: GitCompareArrows },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
              <Calculator className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">Commission</div>
              <div className="text-[11px] text-slate-500">Plan simulator</div>
            </div>
          </div>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV_ITEMS.map((item, i) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <div key={item.href}>
                {i === 6 && <div className="mx-2 my-2 border-t border-slate-100" />}
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm font-medium transition-colors lg:min-h-0 lg:py-2",
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-brand-600" : "text-slate-400")} />
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
          Runs entirely in your browser. Plans are stored locally.
        </div>
      </aside>
    </>
  );
}
