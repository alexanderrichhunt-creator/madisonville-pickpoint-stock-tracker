import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/auth/session-provider";
import { InventoryProvider } from "@/hooks/use-inventory-store";
import { DegradedModeBanner } from "@/components/layout/degraded-mode-banner";
import "./globals.css";

export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Madisonville PickPoint Stock Tracker",
  description:
    "Internal inventory tracker for Madisonville Family Medicine PickPoint pharmacy vending machine.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <InventoryProvider>
            <DegradedModeBanner />
            {children}
            <Toaster richColors closeButton position="top-right" />
          </InventoryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
