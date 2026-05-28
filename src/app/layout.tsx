import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { InventoryProvider } from "@/hooks/use-inventory-store";
import "./globals.css";

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
        <InventoryProvider>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </InventoryProvider>
      </body>
    </html>
  );
}
