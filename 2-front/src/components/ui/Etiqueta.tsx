import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utilidades";

/**
 * Etiqueta mono pequeña. Se usa encima de cada bloque de sección
 * (los "kicker" del editorial) o como badge de estado (Emitida/Vendida/…).
 */
type Tamano = "sm" | "md";

interface Props extends HTMLAttributes<HTMLSpanElement> {
    tamano?: Tamano;
    tono?: "neutral" | "acento" | "positivo";
}

const CLASES: Record<NonNullable<Props["tono"]>, string> = {
    neutral:
        "border border-ink-800/60 bg-ink-900/40 text-ink-300",
    acento:
        "border border-accent/40 bg-accent-soft/40 text-accent-fg",
    positivo:
        "border border-emerald-700/40 bg-emerald-950/50 text-emerald-300",
};

export function Etiqueta({
    tamano = "md",
    tono = "neutral",
    className,
    children,
    ...rest
}: Props) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 font-mono uppercase tracking-[0.18em] rounded-xl",
                tamano === "sm" ? "text-[10px] px-2 py-1" : "text-xs px-3 py-1.5",
                CLASES[tono],
                className,
            )}
            {...rest}
        >
            {children}
        </span>
    );
}
