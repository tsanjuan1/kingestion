import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";

import "@/app/globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Kingestion",
  description: "Plataforma para ordenar operacion, seguimiento comercial y control de gestion."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
