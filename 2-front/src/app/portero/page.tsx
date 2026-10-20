"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { AvisoRed } from "@/components/web3/AvisoRed";
import { EstadoTransaccion } from "@/components/web3/EstadoTransaccion";
import { EstadoBadge } from "@/components/EstadoBadge";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { direccionEntrada, ENTRADA_ABI } from "@/lib/contrato";
import { decodeEstado } from "@/lib/estados";
import { formatoDireccion, formatoTokenId } from "@/lib/formato";
import { useTransaccion } from "@/lib/estadoTx";
import { ESTADO } from "@/tipos/entrada";

/**
 * Vista del Portero. Layout 60/40: a la izquierda el formulario
 * "pegar tokenId, validar"; a la derecha un visor grande.
 *
 * El portero es la única dirección autorizada (inmutable en el contrato).
 * La UI lo lee y lo compara con la wallet conectada; si no coinciden,
 * bloquea la acción.
 *
 * El `tokenId` vive acá arriba y baja a los dos paneles: antes cada uno
 * tenía su propio `useState`, así que el visor mostraba siempre "pegá un
 * tokenId" aunque el input tuviera algo escrito.
 */
export default function PorteroPage() {
    const { address, isConnected, chainId } = useAccount();
    const [tokenId, setTokenId] = useState("");

    const direccion = direccionEntrada(chainId);

    const { data: porteroAddress } = useReadContract({
        address: direccion,
        abi: ENTRADA_ABI,
        functionName: "portero",
    });

    const esPortero = mismaDireccion(address, porteroAddress);

    return (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <Header />

            {!isConnected ? (
                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Conectá la billetera del portero</Etiqueta>
                    <p className="max-w-[55ch] text-base text-ink-300">
                        El portero es una dirección fija en el contrato. Solo esa
                        billetera puede llamar a <span className="font-mmono">usar()</span>.
                    </p>
                    <ConectarBilletera />
                </Tarjeta>
            ) : (
                <>
                    <AvisoRed />
                    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-12">
                        <div className="space-y-8 bg-ink-900 p-10 md:col-span-7">
                            {esPortero ? (
                                <PanelPortero
                                    tokenId={tokenId}
                                    onTokenId={setTokenId}
                                    direccion={direccion}
                                />
                            ) : (
                                <PanelPorteroIncorrecto porteroAddress={porteroAddress} />
                            )}
                        </div>
                        <VisorPortero tokenId={tokenId} direccion={direccion} />
                    </div>
                </>
            )}
        </section>
    );
}

function Header() {
    return (
        <header className="mb-12 max-w-[55ch]">
            <Etiqueta>Portero</Etiqueta>
            <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                Validar la entrada en la puerta.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-300">
                Pegás el tokenId que te muestra el comprador, la billetera del portero
                llama a <span className="font-mono text-ink-100">usar()</span>, y la
                entrada pasa a <span className="text-ink-50">Utilizada</span> para
                siempre.
            </p>
        </header>
    );
}

interface PanelPorteroProps {
    readonly tokenId: string;
    readonly onTokenId: (next: string) => void;
    readonly direccion: `0x${string}`;
}

function PanelPortero({ tokenId, onTokenId, direccion }: PanelPorteroProps) {
    const id = aBigInt(tokenId);

    const { data: estadoActual } = useReadContract({
        address: direccion,
        abi: ENTRADA_ABI,
        functionName: "estado",
        args: id !== undefined ? [id] : undefined,
    });

    const estado = decodeEstado(
        typeof estadoActual === "number" ? estadoActual : undefined,
    );
    const puedeMarcar = id !== undefined && estado === ESTADO.Vendida;

    const marcar = useTransaccion(
        id !== undefined
            ? {
                  address: direccion,
                  abi: ENTRADA_ABI,
                  functionName: "usar",
                  args: [id],
              }
            : undefined,
    );

    return (
        <>
            <div>
                <p className="etiqueta">Token ID</p>
                <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder="Ej. 42"
                    value={tokenId}
                    onChange={(e) => onTokenId(e.target.value.trim())}
                    className="tactil foco-anello mt-3 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-5 font-mono text-lg text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
                />
            </div>

            <Boton
                bloque
                tamano="lg"
                variante="primario"
                disabled={!puedeMarcar}
                cargando={marcar.ocupada}
                onClick={marcar.ejecutar}
            >
                Marcar como Usada
            </Boton>

            {id !== undefined && !puedeMarcar && (
                <p className="text-xs text-ink-500">
                    {estado === ESTADO.Utilizada
                        ? "Esta entrada ya fue usada."
                        : "La entrada tiene que estar Vendida para poder validarla."}
                </p>
            )}

            <EstadoTransaccion transaccion={marcar} />
        </>
    );
}

function PanelPorteroIncorrecto({
    porteroAddress,
}: {
    readonly porteroAddress: `0x${string}` | undefined;
}) {
    return (
        <>
            <Etiqueta>Esta no es la billetera del portero</Etiqueta>
            <p className="max-w-[55ch] text-sm text-ink-300">
                El portero es{" "}
                <span className="font-mono text-ink-100">
                    {formatoDireccion(porteroAddress)}
                </span>
                {" "}
                . Conectá esa billetera para poder validar.
            </p>
        </>
    );
}

/**
 * Visor paralelo. Lee el mismo `tokenId` del input y pinta el resultado.
 */
function VisorPortero({
    tokenId,
    direccion,
}: {
    readonly tokenId: string;
    readonly direccion: `0x${string}`;
}) {
    const id = aBigInt(tokenId);

    const { data: estadoActual } = useReadContract({
        address: direccion,
        abi: ENTRADA_ABI,
        functionName: "estado",
        args: id !== undefined ? [id] : undefined,
    });

    return (
        <div className="bg-ink-950 p-10 md:col-span-5">
            <p className="etiqueta">Visor</p>
            {id === undefined ? (
                <Tarjeta className="mt-4 flex min-h-[260px] items-center justify-center p-6 text-center">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-500">
                        Pegá un tokenId a la izquierda
                    </p>
                </Tarjeta>
            ) : (
                <div className="mt-4 space-y-6 rounded-[2rem] border border-ink-800/60 bg-ink-900 p-8">
                    <p className="font-sans text-[6rem] font-bold leading-none tracking-tighter text-ink-700/60 md:text-[8rem]">
                        {formatoTokenId(id)}
                    </p>
                    <Separador />
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
                            Estado
                        </span>
                        <EstadoBadge
                            estado={decodeEstado(
                                typeof estadoActual === "number" ? estadoActual : undefined,
                            )}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Helpers
// ============================================================

/** El input es texto: si no parsea a entero positivo, no hay tokenId. */
function aBigInt(texto: string): bigint | undefined {
    if (!/^\d+$/.test(texto)) return undefined;
    const valor = BigInt(texto);
    return valor > 0n ? valor : undefined;
}

/** Comparación case-insensitive entre dos addresses (hex). */
function mismaDireccion(
    a: `0x${string}` | undefined,
    b: `0x${string}` | undefined,
): boolean {
    if (!a || !b) return false;
    return a.toLowerCase() === b.toLowerCase();
}