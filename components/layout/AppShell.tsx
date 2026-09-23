"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useActivePlan, usePlanStore } from "@/store/planStore";
import { Sidebar } from "./Sidebar";
import { SummaryStrip } from "./SummaryStrip";
import { TopBar } from "./TopBar";

const PAGES_WITHOUT_SUMMARY = ["/results", "/compare"];

function Notice() {
  const notice = usePlanStore((s) => s.notice);
  const setNotice = usePlanStore((s) => s.setNotice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);
  if (!notice) return null;
  return (
    <div className="no-print fixed bottom-4 left-4 right-4 z-50 flex items-start gap-3 rounded-md border border-slate-200 bg-slate-900 px-4 py-3 text-sm text-white shadow-lg sm:left-auto sm:max-w-sm">
      <span className="min-w-0 flex-1">{notice}</span>
      <button type="button" onClick={() => setNotice(null)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-white sm:h-auto sm:w-auto" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = usePlanStore((s) => s.hydrated);
  const hydrate = usePlanStore((s) => s.hydrate);
  const plan = useActivePlan();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {hydrated && plan ? (
          <>
            <TopBar plan={plan} onOpenSidebar={() => setSidebarOpen(true)} />
            {!PAGES_WITHOUT_SUMMARY.includes(pathname) && <SummaryStrip plan={plan} />}
            <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Loading plans…</div>
        )}
      </div>
      <Notice />
    </div>
  );
}
