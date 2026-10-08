import { cn } from "@/lib/utilidades";

/** Línea horizontal hairline. 1px de borde sobre ink-800/60. */
export function Separador({ className }: { className?: string }) {
    return <div role="separator" className={cn("hairline w-full", className)} />;
}
