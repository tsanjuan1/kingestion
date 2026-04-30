import type { Metadata } from "next";
import { Outfit, Sora } from "next/font/google";

import "@/app/globals.css";

const brandMarkIcon = "/kingestion-mark.png?v=20260422";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Kingestion",
    template: "%s | Kingestion"
  },
  description: "Gestion interna de casos Kingston para ANYX, con seguimiento operativo, tareas, historial y reportes.",
  icons: {
    icon: brandMarkIcon,
    shortcut: brandMarkIcon,
    apple: brandMarkIcon
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sora.variable} ${outfit.variable}`} data-theme="light">
      <body>{children}</body>
    </html>
  );
}
