import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { MenuNavegacion } from "@/components/MenuNavegacion";
import { PieDePagina } from "@/components/PieDePagina";

import { Providers } from "./providers";

import "./globals.css";

/**
 * Tipografías: Geist como sans del sistema, Geist Mono para numerics.
 * next/font/google las sirve como CSS variables (`--font-geist-sans`)
 * que `tailwind.config.ts` ya referencia con `fontFamily.sans`.
 */
const geistSans = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
    display: "swap",
});
const geistMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-geist-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Puerta 7 — Entradas NFT on-chain",
    description:
        "Una entrada, un asiento, un bloque. Comprá tu entrada NFT para el evento en Ether; el portero la valida on-chain.",
    metadataBase: new URL("http://localhost:3000"),
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: "#0c0a09",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es-AR" className={`${geistSans.variable} ${geistMono.variable}`}>
            <body className="min-h-[100dvh] bg-ink-950 font-sans text-ink-50 antialiased">
                <Providers>
                    <MenuNavegacion />
                    <main className="relative">{children}</main>
                    <PieDePagina />
                </Providers>
            </body>
        </html>
    );
}
