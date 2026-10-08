import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utilidades";

/**
 * Tarjeta de superficie elevada. Tres tamaños:
 *  - `sm`  → cards de evidencia en grids
 *  - `md`  → uso general
 *  - `lg`  → contenedores hero / modales
 *
 * Aplica un borde hairline y la sombra diffusion ya definida en el theme.
 * Evita gradientes y glassmorphism.
 */
type Tamano = "sm" | "md" | "lg";

interface Props extends HTMLAttributes<HTMLDivElement> {
    tamano?: Tamano;
}

const RADIO: Record<Tamano, string> = {
    sm: "rounded-xl",
    md: "rounded-2xl",
    lg: "rounded-[2.5rem]",
};

export function Tarjeta({ tamano = "md", className, ...rest }: Props) {
    return (
        <div
            className={cn(
                "border border-ink-800/60 bg-ink-900 shadow-diffusion",
                RADIO[tamano],
                className,
            )}
            {...rest}
        />
    );
}
