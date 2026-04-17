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
  title: {
    default: "Kingestion",
    template: "%s | Kingestion"
  },
  description: "Gestion interna de casos Kingston para ANYX, con seguimiento operativo, tareas, historial y reportes."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
