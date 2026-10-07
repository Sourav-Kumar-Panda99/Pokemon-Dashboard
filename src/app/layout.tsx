import type { Metadata, Viewport } from "next";
import { Fredoka, Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "GO Account Manager", template: "%s · GO Account Manager" },
  description: "Pokémon GO account inventory management — review, organise and sell your account inventory.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#040a1c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fredoka.variable} h-full`}>
      <body className="min-h-full font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
