import { ETIQUETA_ESTADO, type Asiento, type Estado } from "@/tipos/entrada";
import { NOMBRE_SECTOR } from "@/lib/sectores";
import { formatoDireccion, formatoTokenId } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

import { EstadoBadge } from "./EstadoBadge";

/**
 * TarjetaEntrada — el objeto coleccionable del sitio.
 *
 * - Top: nombre del evento + numeración grande (`#042`).
 * - Centro: sector / fila / asiento con tipografía mixta (mono).
 * - Bottom: dueño + estado (chip).
 *
 * Sin SVG, sin elementos decorativos, sin emojis. La "marca" del ticket
 * la da el corte diagonal central (dos superficies que se diferencian
 * por un `divide-x` interno) y la numeración grande — eso lo hace leer
 * como un boleto físico sin caer en skeuomorfismo barato.
 */
interface Props {
    tokenId: bigint;
    estado: Estado;
    dueno?: `0x${string}`;
    asiento: Asiento;
    /** Clases adicionales; usado por grids Bento. */
    className?: string;
}

export function TarjetaEntrada({ tokenId, estado, dueno, asiento, className }: Props) {
    return (
        <article
            className={cn(
                "relative grid grid-cols-1 overflow-hidden rounded-[2rem] border border-ink-800/60 bg-ink-900",
                "shadow-diffusion md:grid-cols-2",
                className,
            )}
        >
            {/* Lado izquierdo — superficie con borde de perforación */}
            <div className="relative flex flex-col justify-between gap-6 border-b border-ink-800/60 p-8 md:border-b-0 md:border-r md:border-dashed md:border-ink-700/60">
                <header className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                        Puerta 7 · NFT
                    </span>
                    <span className="font-mono text-xs text-ink-500">
                        {formatoTokenId(tokenId)}
                    </span>
                </header>

                <div className="space-y-2">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-400">
                        Tu asiento
                    </p>
                    <p className="font-sans text-5xl font-semibold tracking-tighter text-ink-50">
                        {NOMBRE_SECTOR[asiento.sector] ?? "—"}
                    </p>
                    <p className="font-mono text-base text-ink-300">
                        Fila <span className="text-ink-50">{asiento.fila}</span> · Asiento{" "}
                        <span className="text-ink-50">{asiento.asiento}</span>
                    </p>
                </div>

                <footer className="flex items-end justify-between">
                    <div className="space-y-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                            Estado
                        </p>
                        <EstadoBadge estado={estado} />
                    </div>
                    <p className="font-mono text-[10px] text-ink-500">
                        EVM · ERC-721
                    </p>
                </footer>
            </div>

            {/* Lado derecho — numeración grande + meta del dueño */}
            <div className="flex flex-col justify-between gap-6 bg-ink-950 p-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    {ETIQUETA_ESTADO[estado]}
                </p>

                <p className="font-sans text-[8rem] font-bold leading-none tracking-tighter text-ink-700/60 md:text-[10rem]">
                    #{tokenId.toString().padStart(3, "0")}
                </p>

                <div className="space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                        En poder de
                    </p>
                    <p className="font-mono text-sm text-ink-200">
                        {dueno ? formatoDireccion(dueno) : "—"}
                    </p>
                </div>
            </div>
        </article>
    );
}
