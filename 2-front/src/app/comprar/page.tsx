"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { SECTORES_ORDENADOS, NOMBRE_SECTOR } from "@/lib/sectores";
import { direccionEntrada, ENTRADA_ABI } from "@/lib/contrato";
import { formatoPrecio } from "@/lib/formato";
import { estadoTx } from "@/lib/estadoTx";

/**
 * Página Comprador.
 *
 * - Si no hay wallet conectada, prompt a conectar.
 * - Lee `precio()` y muestra el monto.
 * - Botón "Comprar" arma la tx `comprar()` payable con `precio`.
 *
 * Limitación actual: el contrato `Entrada.sol` aún no implementa
 * `comprar()` ni `emitidas()` / `disponibles()`. Si el read de precio
 * falla, lo mostramos como "—" pero dejamos la CTA igual: al hacer
 * click, la tx devolverá revertido con un mensaje legible.
 */
export default function ComprarPage() {
    const { isConnected } = useAccount();
    const [cantidad, setCantidad] = useState(1);

    const { data: precioWei } = useReadContract({
        address: direccionEntrada(),
        abi: ENTRADA_ABI,
        functionName: "precio",
    });

    const { data: disponibles } = useReadContract({
        address: direccionEntrada(),
        abi: ENTRADA_ABI,
        functionName: "disponibles",
    });

    const {
        writeContract,
        data: hash,
        isPending,
        error,
        reset,
    } = useWriteContract();
    const { isLoading: esperando, isSuccess: confirmado } = useWaitForTransactionReceipt({
        hash,
    });

    // Reset tx exitosa después de 6s para que el usuario pueda comprar otra
    useEffect(() => {
        if (!confirmado) return;
        const t = setTimeout(() => reset(), 6000);
        return () => clearTimeout(t);
    }, [confirmado, reset]);

    const totalWei = useMemo(
        () =>
            precioWei !== undefined ? precioWei * BigInt(Math.max(1, cantidad)) : undefined,
        [precioWei, cantidad],
    );

    const agotado = disponibles === 0n;
    const precioCargado = precioWei !== undefined;

    if (!isConnected) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <Header />
                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Conectá tu billetera</Etiqueta>
                    <p className="max-w-[55ch] text-base text-ink-300">
                        Necesitamos tu wallet para mandarte el NFT una vez que el
                        Ether llegue al contrato.
                    </p>
                    <ConectarBilletera />
                </Tarjeta>
            </section>
        );
    }

    return (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <Header />

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-2">
                {/* Columna izquierda — selección */}
                <div className="space-y-8 bg-ink-900 p-10">
                    <div>
                        <p className="etiqueta">Precio por entrada</p>
                        <p className="mt-3 font-mono text-4xl font-semibold tracking-tight text-ink-50">
                            {formatoPrecio(precioWei)}
                        </p>
                    </div>

                    <div>
                        <p className="etiqueta">Sectores disponibles</p>
                        <ul className="mt-3 space-y-2 text-sm text-ink-300">
                            {SECTORES_ORDENADOS.map((s) => (
                                <li
                                    key={s}
                                    className="flex items-center justify-between border-b border-ink-800/60 py-2"
                                >
                                    <span>
                                        <span className="font-mono text-ink-500">{s}</span> ·{" "}
                                        {NOMBRE_SECTOR[s]}
                                    </span>
                                    <span className="font-mono text-xs text-ink-500">al azar</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {disponibles !== undefined && (
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
                            Quedan{" "}
                            <span className="text-ink-50">{disponibles.toString()}</span>{" "}
                            entradas a la venta
                        </p>
                    )}
                </div>

                {/* Columna derecha — acción */}
                <div className="space-y-8 bg-ink-950 p-10">
                    <Cantidad value={cantidad} onChange={setCantidad} />

                    <Separador />

                    <div className="space-y-2">
                        <p className="etiqueta">Total a pagar</p>
                        <p className="font-mono text-3xl font-semibold tracking-tight text-ink-50">
                            {formatoPrecio(totalWei)}
                        </p>
                        <p className="text-xs text-ink-500">
                            Pago exacto. Si mandás de más o de menos, el contrato rechaza.
                        </p>
                    </div>

                    <Boton
                        bloque
                        tamano="lg"
                        variante="primario"
                        cargando={isPending || esperando}
                        disabled={!precioCargado || agotado}
                        onClick={() => {
                            if (!precioWei) return;
                            writeContract({
                                address: direccionEntrada(),
                                abi: ENTRADA_ABI,
                                functionName: "comprar",
                                value: precioWei * BigInt(cantidad),
                            });
                        }}
                    >
                        Comprar {cantidad > 1 ? `${cantidad} entradas` : "entrada"}
                    </Boton>

                    {hash && (
                        <p className="font-mono text-xs text-ink-400">
                            Tx: {hash.slice(0, 10)}…{hash.slice(-4)} ·{" "}
                            {estadoTx(esperando, confirmado)}
                        </p>
                    )}
                    {error && (
                        <p className="text-xs text-red-400">{error.message.split("\n")[0]}</p>
                    )}
                    {confirmado && (
                        <p className="text-xs text-emerald-400">
                            Listo — revisá{" "}
                            <Link href="/mis-entradas" className="underline underline-offset-4">
                                Mis entradas
                            </Link>
                            .
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}

function Header() {
    return (
        <header className="mb-12 max-w-[55ch]">
            <Etiqueta>Comprar entrada</Etiqueta>
            <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                Pagás, recibís, entrás.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-300">
                El precio es exacto — sin vuelto, sin sorpresas. La butaca se asigna al
                azar entre las disponibles; no se puede elegir.
            </p>
        </header>
    );
}

interface CantidadProps {
    readonly value: number;
    readonly onChange: (next: number) => void;
}

function Cantidad({ value, onChange }: CantidadProps) {
    return (
        <div>
            <p className="etiqueta">Cantidad</p>
            <div className="mt-3 inline-flex items-center rounded-2xl border border-ink-800/60">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(1, value - 1))}
                    className="tactil foco-anello h-10 w-10 text-ink-300 hover:text-ink-50"
                    aria-label="Restar una entrada"
                >
                    −
                </button>
                <span className="min-w-[40px] text-center font-mono text-lg text-ink-50">
                    {value}
                </span>
                <button
                    type="button"
                    onClick={() => onChange(Math.min(8, value + 1))}
                    className="tactil foco-anello h-10 w-10 text-ink-300 hover:text-ink-50"
                    aria-label="Sumar una entrada"
                >
                    +
                </button>
            </div>
        </div>
    );
}
