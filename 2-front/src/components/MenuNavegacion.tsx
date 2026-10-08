"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utilidades";

import { ConectarBilletera } from "./ConectarBilletera";

/**
 * Barra superior sticky, semi-transparente. En mobile, debajo de `md`
 * colapsa a un nav horizontal con scroll-snap.
 *
 * El logo es solo tipografía ("Puerta 7") en tracking tight — sin
 * íconos emoji. El "7" lleva el accent para anclar visualmente.
 */

const ITEMS: Array<{ href: string; etiqueta: string }> = [
    { href: "/", etiqueta: "Inicio" },
    { href: "/comprar", etiqueta: "Comprar" },
    { href: "/mis-entradas", etiqueta: "Mis entradas" },
    { href: "/portero", etiqueta: "Portero" },
    { href: "/organizador", etiqueta: "Organizador" },
];

export function MenuNavegacion() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-40 border-b border-ink-800/60 bg-ink-950/70 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
                <Link
                    href="/"
                    className="tactil group flex items-baseline gap-1 font-sans text-base font-semibold tracking-tighter text-ink-50"
                >
                    <span>Puerta</span>
                    <span className="text-accent">7</span>
                </Link>

                {/* En desktop: nav horizontal clásico */}
                <nav className="hidden md:flex md:items-center md:gap-7">
                    {ITEMS.map((item) => {
                        const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "tactil text-sm tracking-tight transition-colors duration-300 ease-premium",
                                    activo
                                        ? "text-ink-50"
                                        : "text-ink-400 hover:text-ink-50",
                                )}
                            >
                                {item.etiqueta}
                            </Link>
                        );
                    })}
                </nav>

                {/* En mobile: scroll horizontal sin links en bloque */}
                <nav className="flex flex-1 justify-end gap-5 overflow-x-auto md:hidden">
                    {ITEMS.map((item) => {
                        const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "tactil shrink-0 text-sm tracking-tight",
                                    activo ? "text-ink-50" : "text-ink-400",
                                )}
                            >
                                {item.etiqueta}
                            </Link>
                        );
                    })}
                </nav>

                <ConectarBilletera className="shrink-0" />
            </div>
        </header>
    );
}
