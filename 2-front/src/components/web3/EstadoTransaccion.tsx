"use client";

import type { Transaccion, FaseTx } from "@/lib/estadoTx";
import { formatoHash } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

/**
 * Renglón de estado de una escritura, debajo del botón que la dispara.
 *
 * Muestra la fase ("esperando firma…", "minando…") y el hash una vez
 * emitido. El error va aparte y en rojo: mezclar un revert con el estado
 * normal hace que el usuario no sepa si la operación está corriendo o si
 * ya terminó mal.
 */
export function EstadoTransaccion({
    transaccion,
    className,
}: {
    readonly transaccion: Transaccion;
    readonly className?: string;
}) {
    const { fase, hash, error, etiqueta } = transaccion;

    if (error !== undefined) {
        return (
            <p className={cn("text-xs leading-relaxed text-red-400", className)}>{error}</p>
        );
    }

    if (fase === "inactiva") return null;

    return (
        <div className={cn("space-y-1", className)}>
            <p className={cn("text-xs", COLOR_FASE[fase])}>
                {fase === "confirmada" ? etiqueta : `${etiqueta}…`}
            </p>
            {hash !== undefined && (
                <p className="font-mono text-xs text-ink-400">
                    Tx: {formatoHash(hash)}
                </p>
            )}
        </div>
    );
}

const COLOR_FASE: Record<FaseTx, string> = {
    inactiva: "text-ink-400",
    preparando: "text-ink-300",
    esperandoFirma: "text-ink-300",
    minando: "text-ink-300",
    confirmada: "text-emerald-400",
    fallida: "text-red-400",
};