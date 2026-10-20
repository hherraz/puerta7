"use client";

import Link from "next/link";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useEffect, useMemo } from "react";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { AvisoRed } from "@/components/web3/AvisoRed";
import { EstadoTransaccion } from "@/components/web3/EstadoTransaccion";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { direccionEntrada, ENTRADA_ABI } from "@/lib/contrato";
import { formatoDireccion, formatoPrecio } from "@/lib/formato";
import { useTransaccion } from "@/lib/estadoTx";

/**
 * Panel del Organizador.
 *
 * El owner es una dirección real del contrato (`Ownable.owner()`), así que
 * se puede comparar contra la wallet conectada y habilitar "Retirar"
 * solo para quien corresponde. Antes esta página lo dejaba en `undefined`
 * por un comentario que decía que el ABI no exponía `owner()`, y el botón
 * quedaba deshabilitado para siempre.
 */
export default function OrganizadorPage() {
    const { address, isConnected, chainId } = useAccount();
    const direccion = direccionEntrada(chainId);

    const { data: precio } = useReadContract({
        address: direccion,
        abi: ENTRADA_ABI,
        functionName: "precio",
    });

    const { data: portero } = useReadContract({
        address: direccion,
        abi: ENTRADA_ABI,
        functionName: "portero",
    });

    const { data: owner } = useReadContract({
        address: direccion,
        abi: ENTRADA_ABI,
        functionName: "owner",
    });

    const { data: contadores } = useReadContracts({
        contracts: [
            { address: direccion, abi: ENTRADA_ABI, functionName: "emitidas" },
            { address: direccion, abi: ENTRADA_ABI, functionName: "disponibles" },
        ],
    });

    const emitidas = contadores?.[0]?.result as bigint | undefined;
    const disponibles = contadores?.[1]?.result as bigint | undefined;

    const vendidas =
        emitidas !== undefined && disponibles !== undefined
            ? emitidas - disponibles
            : undefined;

    const esOrganizador = useMemo(
        () => Boolean(address && owner && address.toLowerCase() === owner.toLowerCase()),
        [address, owner],
    );

    const retiro = useTransaccion(
        esOrganizador
            ? {
                  address: direccion,
                  abi: ENTRADA_ABI,
                  functionName: "retirar",
              }
            : undefined,
    );

    // Volvemos al estado inicial unos segundos después de confirmar, para
    // que el botón vuelva a estar disponible sin recargar.
    useEffect(() => {
        if (retiro.fase !== "confirmada") return;
        const t = setTimeout(() => retiro.reiniciar(), 5000);
        return () => clearTimeout(t);
    }, [retiro]);

    if (!isConnected) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <Header />
                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Conectá la billetera del organizador</Etiqueta>
                    <p className="max-w-[55ch] text-base text-ink-300">
                        El owner del contrato es el único que puede emitir y retirar.
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

            {/* Stats */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-4">
                <Stat titulo="Emitidas" valor={emitidas?.toString() ?? "—"} />
                <Stat titulo="Disponibles" valor={disponibles?.toString() ?? "—"} />
                <Stat titulo="Vendidas" valor={vendidas?.toString() ?? "—"} />
                <Stat titulo="Precio" valor={formatoPrecio(precio)} />
            </div>

            {/* Acciones */}
            <div className="mt-px grid grid-cols-1 gap-px overflow-hidden rounded-b-[2rem] border border-t-0 border-ink-800/60 md:grid-cols-2">
                <div className="space-y-6 bg-ink-900 p-10">
                    <Etiqueta>Emitir entradas</Etiqueta>
                    <p className="max-w-[40ch] text-sm text-ink-300">
                        Subí un lote por (sector, fila, asiento). El contrato las
                        marca como <span className="text-ink-50">Emitida</span> y
                        quedan en su propia billetera hasta la venta.
                    </p>
                    <Link href="/organizador/emitir">
                        <Boton bloque variante="primario" tamano="md">
                            Ir a emitir
                        </Boton>
                    </Link>
                </div>

                <div className="space-y-6 bg-ink-950 p-10">
                    <Etiqueta>Retirar recaudación</Etiqueta>
                    <p className="max-w-[40ch] text-sm text-ink-300">
                        Transfiere todo el Ether acumulado al organizador en
                        una sola tx. Solo el owner puede.
                    </p>
                    <Boton
                        bloque
                        variante="primario"
                        tamano="md"
                        disabled={!esOrganizador}
                        cargando={retiro.ocupada}
                        onClick={retiro.ejecutar}
                    >
                        Retirar ahora
                    </Boton>

                    {!esOrganizador && (
                        <p className="text-xs text-ink-500">
                            Esta billetera no es el owner del contrato.
                        </p>
                    )}
                    <EstadoTransaccion transaccion={retiro} />
                </div>
            </div>

            {/* Meta */}
            <div className="mt-10">
                <Separador />
            </div>
            <dl className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Dato titulo="Owner" valor={formatoDireccion(owner)} />
                <Dato titulo="Portero" valor={formatoDireccion(portero)} />
                <Dato titulo="Contrato" valor={formatoDireccion(direccion)} />
            </dl>
        </section>
    );
}

function Header() {
    return (
        <header className="mb-12 max-w-[60ch]">
            <Etiqueta>Organizador</Etiqueta>
            <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                Tu panel sobre el contrato.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-300">
                Emitís, definís los costos del canje, configurás el mercado de
                reventa y retirás lo recauda.
            </p>
        </header>
    );
}

interface StatProps {
    readonly titulo: string;
    readonly valor: string;
}

function Stat({ titulo, valor }: StatProps) {
    return (
        <div className="bg-ink-900 p-6">
            <p className="etiqueta">{titulo}</p>
            <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-ink-50">
                {valor}
            </p>
        </div>
    );
}

interface DatoProps {
    readonly titulo: string;
    readonly valor: string;
}

function Dato({ titulo, valor }: DatoProps) {
    return (
        <div className="rounded-2xl border border-ink-800/60 bg-ink-900 p-5">
            <dt className="etiqueta">{titulo}</dt>
            <dd className="mt-2 font-mono text-sm text-ink-50">{valor}</dd>
        </div>
    );
}