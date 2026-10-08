"use client";

import { SECTORES_ORDENADOS } from "@/lib/sectores";
import { NOMBRE_SECTOR } from "@/lib/sectores";

/**
 * Marquee horizontal infinito con los sectores del recinto.
 * No usa libs: lo anima `transform` puro en CSS — barato y suave.
 *
 * Por cada sector se imprime un bloque grande con tamaño "display-md"
 * y un hairline vertical como separador. La animación es `linear`
 * porque es decorativa (no interactiva).
 */
export function MarqueeSectores() {
    // Duplicamos el contenido para que el loop CSS sea invisible
    const items = [...SECTORES_ORDENADOS, ...SECTORES_ORDENADOS];

    return (
        <div
            aria-hidden
            className="relative w-full overflow-hidden border-y border-ink-800/60 bg-ink-950 py-10"
        >
            {/* gradient edges: fade a los costados para que el loop no cante */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink-950 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink-950 to-transparent" />

            <div
                className="flex w-max gap-12 whitespace-nowrap"
                style={{
                    animation: "marquee 32s linear infinite",
                }}
            >
                {items.map((s, idx) => (
                    <div key={`${s}-${idx}`} className="flex items-baseline gap-12 px-6">
                        <span className="font-mono text-sm uppercase tracking-[0.18em] text-ink-500">
                            Sector {s}
                        </span>
                        <span className="text-display-md font-semibold tracking-tighter text-ink-50">
                            {NOMBRE_SECTOR[s]}
                        </span>
                        <span className="text-3xl text-ink-700">●</span>
                    </div>
                ))}
            </div>

            {/* keyframes locales — encapsulados para no contaminar globals.css */}
            <style jsx>{`
                @keyframes marquee {
                    from {
                        transform: translateX(0);
                    }
                    to {
                        transform: translateX(-50%);
                    }
                }
            `}</style>
        </div>
    );
}
