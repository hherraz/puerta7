"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { useEffect } from "react";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { AvisoRed } from "@/components/web3/AvisoRed";
import { EstadoTransaccion } from "@/components/web3/EstadoTransaccion";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { SECTORES_ORDENADOS, NOMBRE_SECTOR } from "@/lib/sectores";
import { direccionEntrada, ENTRADA_ABI } from "@/lib/contrato";
import { formatoPrecio } from "@/lib/formato";
import { useTransaccion } from "@/lib/estadoTx";

/**
 * Página Comprador.
 *
 * `Entrada.comprar()` no recibe argumentos y exige `msg.value == precio`
 * exacto. Eso significa que una compra es UNA entrada por transacción: no
 * hay forma de comprar tres en una sola tx sin que el contrato la rechace.
 *
 * Antes esta página tenía un selector de 1 a 8 que mandaba
 * `precio × cantidad`, así que comprar dos o más fallaba siempre con
 * "Pago incorrecto". Se sacó el selector en vez de agregar un Carrito: el
 * contrato no lo soporta y prometerlo sería una mentira.
 */
export default function ComprarPage() {
    const { isConnected, chainId } = useAccount();
    const direccion = direccionEntrada(chainId);

    const { data: precioWei } = useReadContract({
        address: direccion,
        abi: ENTRADA_ABI,
        functionName: "precio",
    });

    const { data: disponibles } = useReadContract({
        address: direccion,
        abi: ENTRADA_ABI,
        functionName: "disponibles",
    });

    const compra = useTransaccion(
        precioWei !== undefined && precioWei > 0n
            ? {
                  address: direccion,
                  abi: ENTRADA_ABI,
                  functionName: "comprar",
                  value: precioWei,
              }
            : undefined,
    );

    // Tras confirmar, se vuelve al estado inicial para que el comprador
    // pueda seguir comprando sin recargar la página.
    useEffect(() => {
        if (compra.fase !== "confirmada") return;
        const t = setTimeout(() => compra.reiniciar(), 6000);
        return () => clearTimeout(t);
    }, [compra]);

    const agotado = disponibles === 0n;

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
            <AvisoRed />

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-2">
                {/* Columna izquierda — qué estás comprando */}
                <div className="space-y-8 bg-ink-900 p-10">
                    <div>
                        <p className="etiqueta">Precio por entrada</p>
                        <p className="mt-3 font-mono text-4xl font-semibold tracking-tight text-ink-50">
                            {formatoPrecio(precioWei)}
                        </p>
                    </div>

                    <div>
                        <p className="etiqueta">Sectores posibles</p>
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
                    <div className="space-y-2">
                        <p className="etiqueta">Total a pagar</p>
                        <p className="font-mono text-3xl font-semibold tracking-tight text-ink-50">
                            {formatoPrecio(precioWei)}
                        </p>
                        <p className="text-xs text-ink-500">
                            Pago exacto. Si mandás de más o de menos, el contrato rechaza.
                            Una compra es una entrada: para varias, repetí la operación.
                        </p>
                    </div>

                    <Separador />

                    <Boton
                        bloque
                        tamano="lg"
                        variante="primario"
                        cargando={compra.ocupada}
                        disabled={precioWei === undefined || agotado}
                        onClick={compra.ejecutar}
                    >
                        {agotado ? "No quedan entradas" : "Comprar entrada"}
                    </Boton>

                    <EstadoTransaccion transaccion={compra} />

                    {compra.fase === "confirmada" && (
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