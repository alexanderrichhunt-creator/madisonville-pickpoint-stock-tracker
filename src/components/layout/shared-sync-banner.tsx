"use client";

import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventoryStore } from "@/hooks/use-inventory-store";
import { isLocalMode } from "@/lib/runtime-mode";

export function SharedSyncBanner() {
  const { sharedConnected, sharedError, refreshFromServer, isRefreshing } =
    useInventoryStore();

  if (isLocalMode) {
    return (
      <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-900">
        <strong>Local mode</strong> — changes stay on this computer only. Other
        staff will not see your updates until you deploy online (
        <code>DEPLOY-ONLINE.md</code>).
      </div>
    );
  }

  if (sharedConnected === null) {
    return (
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm text-slate-700">
        Connecting to shared clinic inventory…
      </div>
    );
  }

  if (!sharedConnected) {
    return (
      <div className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <div className="flex items-start gap-2">
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Shared inventory is NOT connected</p>
              <p className="mt-0.5">
                {sharedError ||
                  "Changes you make here will not appear for other users."}
              </p>
              <p className="mt-1 text-xs">
                On Render: set <code>DATABASE_URL</code> to your Neon connection
                string (same as Branch Secretary Tool), redeploy, then visit{" "}
                <code>/api/bootstrap-admin</code> once.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshFromServer()}
            disabled={isRefreshing}
            className="shrink-0 border-red-300 bg-white"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-900">
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-2">
        <Cloud className="h-4 w-4" aria-hidden="true" />
        <span>
          <strong>Shared clinic inventory</strong> — changes sync for everyone.
          Auto-refreshes every 30 seconds.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshFromServer()}
          disabled={isRefreshing}
          className="h-7 px-2 text-emerald-900 hover:bg-emerald-100"
          aria-label="Refresh inventory now"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </Button>
      </div>
    </div>
  );
}
