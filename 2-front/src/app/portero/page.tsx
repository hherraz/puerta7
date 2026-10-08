"use client";

import { useState } from "react";
import {
    useAccount,
    useReadContract,
    useWriteContract,
    useWaitForTransactionReceipt,
} from "wagmi";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { EstadoBadge } from "@/components/EstadoBadge";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { direccionEntrada, ENTRADA_ABI } from "@/lib/contrato";
import { decodeEstado } from "@/lib/estados";
import { estadoTx } from "@/lib/estadoTx";
import { formatoDireccion, formatoTokenId } from "@/lib/formato";
import { ESTADO, type Estado } from "@/tipos/entrada";

/**
 * Vista del Portero. Layout 60/40: a la izquierda el formulario
 * "pegar tokenId, validar"; a la derecha un visor grande.
 *
 * El portero es la única dirección autorizada (almacenada inmutable
 * en el contrato). El frontend lo lee y lo compara con la wallet
 * conectada; si no coinciden, la UI bloquea la acción.
 */
export default function PorteroPage() {
    const { address } = useAccount();

    const { data: porteroAddress } = useReadContract({
        address: direccionEntrada(),
        abi: ENTRADA_ABI,
        functionName: "portero",
    });

    const esPortero = mismaDireccion(address, porteroAddress);

    return (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <Header />
            <BilleteraConectada esPortero={esPortero} porteroAddress={porteroAddress} />
        </section>
    );
}

// ============================================================
// Layout / subcomponentes
// ============================================================

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

interface BilleteraConectadaProps {
    readonly esPortero: boolean;
    readonly porteroAddress: `0x${string}` | undefined;
}

/**
 * Pinta el layout 60/40 con las tres rutas posibles:
 *  - wallet no conectada
 *  - billetera equivocada (no es la del portero)
 *  - billetera correcta → formulario + visor
 */
function BilleteraConectada({ esPortero, porteroAddress }: BilleteraConectadaProps) {
    const { isConnected } = useAccount();

    let formPanel: React.ReactNode;
    if (!isConnected) {
        formPanel = <PanelConectar />;
    } else if (!esPortero) {
        formPanel = <PanelPorteroIncorrecto porteroAddress={porteroAddress} />;
    } else {
        formPanel = <PanelPortero />;
    }

    return (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-12">
            <div className="space-y-8 bg-ink-900 p-10 md:col-span-7">{formPanel}</div>
            <VisorPortero />
        </div>
    );
}

function PanelConectar() {
    return (
        <>
            <Etiqueta>Conectá la billetera del portero</Etiqueta>
            <p className="max-w-[55ch] text-sm text-ink-300">
                El portero es una dirección fija en el contrato. Solo esa billetera
                puede llamar a <span className="font-mono">usar()</span>.
            </p>
            <ConectarBilletera />
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
                    {formatoDireccion(porteroAddress?.toString())}
                </span>
                .{" "}Conectá esa billetera para poder validar.
            </p>
        </>
    );
}

function PanelPortero() {
    const [tokenId, setTokenId] = useState("");

    const { writeContract, data: hash, isPending, error } = useWriteContract();
    const { isLoading: esperando, isSuccess: confirmado } = useWaitForTransactionReceipt({
        hash,
    });

    const id = tokenId ? BigInt(tokenId) : undefined;

    const { data: estadoActual } = useReadContract({
        address: direccionEntrada(),
        abi: ENTRADA_ABI,
        functionName: "estado",
        args: id !== undefined ? [id] : undefined,
    });

    const estado = decodeEstado(estadoActual as number | undefined);
    const puedeMarcar = id !== undefined && estado === ESTADO.Vendida;

    return (
        <>
            <div>
                <p className="etiqueta">Token ID</p>
                <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder="Ej. 042"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value.trim())}
                    className="tactil foco-anello mt-3 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-5 font-mono text-lg text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
                />
            </div>

            <Boton
                bloque
                tamano="lg"
                variante="primario"
                disabled={!puedeMarcar}
                cargando={isPending || esperando}
                onClick={() => {
                    if (!id) return;
                    writeContract({
                        address: direccionEntrada(),
                        abi: ENTRADA_ABI,
                        functionName: "usar",
                        args: [id],
                    });
                }}
            >
                Marcar como Usada
            </Boton>

            {error && <p className="text-xs text-red-400">{error.message.split("\n")[0]}</p>}
            {hash && (
                <p className="font-mono text-xs text-ink-400">
                    Tx: {hash.slice(0, 10)}…{hash.slice(-4)} ·{" "}
                    {estadoTx(esperando, confirmado)}
                </p>
            )}

            <Separador />

            <UltimaValidacion id={id} estado={estado} confirmado={confirmado} />
        </>
    );
}

interface UltimaValidacionProps {
    readonly id: bigint | undefined;
    readonly estado: Estado;
    readonly confirmado: boolean;
}

function UltimaValidacion({ id, estado, confirmado }: UltimaValidacionProps) {
    if (id === undefined) {
        return (
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
                Esperando tokenId…
            </p>
        );
    }

    return (
        <div className="space-y-4 rounded-2xl border border-ink-800/60 bg-ink-950 p-6">
            <p className="font-sans text-5xl font-bold tracking-tighter text-ink-700/60">
                {formatoTokenId(id)}
            </p>
            <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
                    Estado
                </span>
                <EstadoBadge estado={estado} />
            </div>
            {confirmado && (
                <p className="text-xs text-emerald-400">Entrada marcada como Usada.</p>
            )}
        </div>
    );
}

/**
 * Visor paralelo. Lee el estado del tokenId que el usuario va
 * escribiendo y pinta el resultado a la derecha.
 */
function VisorPortero() {
    const [tokenId] = useStateLocalToken();
    const id = tokenId ? BigInt(tokenId) : undefined;

    const { data: estadoActual } = useReadContract({
        address: direccionEntrada(),
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
                        <EstadoBadge estado={decodeEstado(estadoActual as number | undefined)} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Helpers
// ============================================================

/** Estado compartido entre PanelPortero (input) y VisorPortero (read). */
function useStateLocalToken(): [string, (next: string) => void] {
    return useState("");
}

/** Comparación case-insensitive entre dos addresses (hex). */
function mismaDireccion(
    a: `0x${string}` | undefined,
    b: `0x${string}` | undefined,
): boolean {
    if (!a || !b) return false;
    return a.toLowerCase() === b.toLowerCase();
}
