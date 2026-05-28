"use client";

import { Lock, LockOpen, Pill } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInventoryStore } from "@/hooks/use-inventory-store";
import { PinDialog } from "@/components/admin/pin-dialog";
import { AdminMenu } from "@/components/admin/admin-menu";

export function Header() {
  const { isAdmin, dataAsOfLabel, logoutAdmin } = useInventoryStore();

  return (
    <header className="border-b bg-card shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Pill className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Madisonville PickPoint Stock Tracker
            </h1>
            <p className="text-sm text-muted-foreground">
              Data as of {dataAsOfLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Badge variant="secondary" className="gap-1">
              <LockOpen className="h-3 w-3" aria-hidden="true" />
              Admin Mode
            </Badge>
          )}
          {isAdmin ? (
            <>
              <AdminMenu />
              <Button
                variant="outline"
                size="sm"
                onClick={logoutAdmin}
                aria-label="Exit admin mode"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                Exit Admin
              </Button>
            </>
          ) : (
            <PinDialog />
          )}
        </div>
      </div>
    </header>
  );
}
