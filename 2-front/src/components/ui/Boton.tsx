import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utilidades";

/**
 * Botón tipográfico y táctil del sistema. Sin emoji, sin icon libs —
 * los íconos se pasan como children SVG inline cuando hacen falta.
 *
 * Variantes:
 *  - `primario`  → filled con accent (un solo color de CTA en todo el sitio)
 *  - `secundario` → outline 1px hairline
 *  - `fantasma`  → link inline con flecha (lo más "editorial" del sitio)
 *
 * Reglas duras:
 *  - Sin glassmorphism apilado.
 *  - Sin gradiente.
 *  - Tap-target >= 40px en móvil.
 */

type Variante = "primario" | "secundario" | "fantasma";
type Tamano = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    variante?: Variante;
    tamano?: Tamano;
    cargando?: boolean;
    bloque?: boolean;
    children: ReactNode;
}

const VARIANTES: Record<Variante, string> = {
    primario:
        "bg-accent text-accent-fg hover:bg-accent/90 border border-accent/0",
    secundario:
        "bg-transparent text-ink-50 border border-ink-700 hover:border-ink-500",
    fantasma:
        "bg-transparent text-ink-50 border-b border-ink-700 hover:border-accent px-0 py-1 rounded-none",
};

const TAMANOS: Record<Tamano, string> = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-14 px-7 text-base",
};

export const Boton = forwardRef<HTMLButtonElement, Props>(function Boton(
    {
        variante = "primario",
        tamano = "md",
        cargando = false,
        bloque = false,
        className,
        disabled,
        children,
        ...rest
    },
    ref,
) {
    return (
        <button
            ref={ref}
            disabled={disabled || cargando}
            className={cn(
                "tactil foco-anello inline-flex items-center justify-center gap-2 font-medium",
                "tracking-tight whitespace-nowrap select-none",
                "rounded-2xl transition-colors duration-300 ease-premium",
                VARIANTES[variante],
                TAMANOS[tamano],
                bloque && "w-full",
                (disabled || cargando) && "opacity-50 cursor-not-allowed",
                className,
            )}
            {...rest}
        >
            {cargando ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {children}
        </button>
    );
});
