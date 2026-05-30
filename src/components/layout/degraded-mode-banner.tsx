"use client";

import { isLocalMode } from "@/lib/runtime-mode";

export function DegradedModeBanner() {
  if (isLocalMode) {
    return (
      <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-900">
        <strong>Local mode</strong> — data saves in this browser only. For shared clinic access,
        deploy online (see <code>DEPLOY-ONLINE.md</code>).
      </div>
    );
  }

  return null;
}
