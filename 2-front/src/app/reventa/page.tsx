"use client";

import { useAccount, useReadContract } from "wagmi";
import { useMemo, useState } from "react";
import type { Address } from "viem";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { AvisoRed } from "@/components/web3/AvisoRed";
import { EstadoTransaccion } from "@/components/web3/EstadoTransaccion";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { useEntradasMias } from "@/hooks/useEntradasMias";
import { useEventos } from "@/hooks/useEventos";
import {
    direccionReventa,
    direccionEntrada,
    REVENTA_ABI,
    ENTRADA_ABI,
} from "@/lib/contrato";
import { formatoPrecio, formatoTokenId } from "@/lib/formato";
import { useTransaccion } from "@/lib/estadoTx";
import { ESTADO } from "@/tipos/entrada";

/**
 * Mercado secundario.
 *
 * `Reventa._listados` es `private` sin getter, así que la lista de
 * publicaciones se RECONSTRUYE leyendo los logs: `Listado` abre, `Comprado`
 * y `Cancelado` cierran. Es el mismo estado que el contrato tiene en
 * storage, con la ventaja de que no depende de que alguien suba el mapping
 * a `public` después.
 */
interface Listado {
    readonly id: bigint;
    readonly tokenId: bigint;
    readonly vendedor: Address;
    readonly precio: bigint;
    readonly activo: boolean;
}

export default function ReventaPage() {
    const { address, isConnected, chainId } = useAccount();
    const reventa = direccionReventa(chainId);
    const entrada = direccionEntrada(chainId);

    const { eventos: listados } = useEventos(reventa, REVENTA_ABI, "Listado");
    const { eventos: comprados } = useEventos(reventa, REVENTA_ABI, "Comprado");
    const { eventos: cancelados } = useEventos(reventa, REVENTA_ABI, "Cancelado");

    const { data: techo } = useReadContract({
        address: reventa,
        abi: REVENTA_ABI,
        functionName: "techoPorcentaje",
    });
    const { data: comision } = useReadContract({
        address: reventa,
        abi: REVENTA_ABI,
        functionName: "comisionPorcentaje",
    });
    const { data: precioEntrada } = useReadContract({
        address: entrada,
        abi: ENTRADA_ABI,
        functionName: "precio",
    });

    const publicaciones = useMemo(
        () => reconstruir(listados, comprados, cancelados),
        [listados, comprados, cancelados],
    );

    const activas = publicaciones.filter((p) => p.activo);

    if (!isConnected) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <Header />
                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Conectá tu billetera</Etiqueta>
                    <p className="max-w-[55ch] text-base text-ink-300">
                        Para comprar un listado necesitás una billetera; para listar la
                        tuya, ser su titular.
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

            <div className="mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60">
                <Stat titulo="Techo" valor={techo !== undefined ? `${techo.toString()}%` : "—"} />
                <Stat
                    titulo="Comisión"
                    valor={comision !== undefined ? `${comision.toString()}%` : "—"}
                />
                <Stat titulo="Precio original" valor={formatoPrecio(precioEntrada)} />
            </div>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-2">
                <div className="space-y-6 bg-ink-950 p-10">
                    <Etiqueta>Publicaciones activas</Etiqueta>
                    {activas.length === 0 ? (
                        <p className="text-sm text-ink-500">
                            Nadie publicó nada todavía.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {activas.map((p) => (
                                <FilaListado
                                    key={p.id.toString()}
                                    listado={p}
                                    esVendedor={
                                        address !== undefined &&
                                        p.vendedor.toLowerCase() === address.toLowerCase()
                                    }
                                />
                            ))}
                        </ul>
                    )}
                    {publicaciones.length > 0 && (
                        <>
                            <Separador />
                            <p className="text-xs text-ink-600">
                                {publicaciones.length - activas.length} publicaciones
                                cerradas (vendidas o canceladas).
                            </p>
                        </>
                    )}
                </div>

                <div className="space-y-6 bg-ink-900 p-10">
                    <PanelConfigurar />
                    <Separador />
                    <PanelPublicar />
                    <Separador />
                    <PanelRetirar />
                </div>
            </div>
        </section>
    );
}

/**
 * `configurar(techo, comision)`. Solo el organizador.
 *
 * Sin esto el techo queda en 0 y `precioMaximo` da 0, así que NINGUNA
 * publicación pasa el control de precio: el mercado queda inusable. Por
 * eso está en la UI y no solo en la spec.
 */
function PanelConfigurar() {
    const { chainId } = useAccount();
    const reventa = direccionReventa(chainId);

    const [techo, setTecho] = useState("");
    const [comision, setComision] = useState("");

    const habilitado = /^\d+$/.test(techo) && /^\d+$/.test(comision);

    const configurar = useTransaccion(
        habilitado
            ? {
                  address: reventa,
                  abi: REVENTA_ABI,
                  functionName: "configurar",
                  args: [BigInt(techo), BigInt(comision)],
              }
            : undefined,
    );

    return (
        <>
            <Etiqueta>Configurar el mercado</Etiqueta>
            <p className="text-xs text-ink-500">
                Solo el organizador. El techo es un porcentaje sobre el precio de
                lista: 110 permite un 10% de recargo. La comisión se descuenta de cada
                venta y queda para el organizador.
            </p>

            <div className="grid grid-cols-2 gap-3">
                <label className="block">
                    <p className="etiqueta">Techo (%)</p>
                    <input
                        value={techo}
                        onChange={(e) => setTecho(e.target.value.trim())}
                        placeholder="110"
                        inputMode="numeric"
                        className="tactil foco-anello mt-2 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-4 font-mono text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
                    />
                </label>
                <label className="block">
                    <p className="etiqueta">Comisión (%)</p>
                    <input
                        value={comision}
                        onChange={(e) => setComision(e.target.value.trim())}
                        placeholder="5"
                        inputMode="numeric"
                        className="tactil foco-anello mt-2 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-4 font-mono text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
                    />
                </label>
            </div>

            <Boton
                bloque
                variante="secundario"
                tamano="md"
                disabled={!habilitado}
                cargando={configurar.ocupada}
                onClick={configurar.ejecutar}
            >
                Guardar configuración
            </Boton>

            <EstadoTransaccion transaccion={configurar} />
        </>
    );
}

/** Publicar una entrada propia: approve al mercado y después `listar`. */
function PanelPublicar() {
    const { chainId } = useAccount();
    const reventa = direccionReventa(chainId);
    const entrada = direccionEntrada(chainId);
    const { entradas } = useEntradasMias();

    const [tokenId, setTokenId] = useState("");
    const [precio, setPrecio] = useState("");

    const propias = entradas.filter((e) => e.estado === ESTADO.Vendida);

    const id = /^\d+$/.test(tokenId) ? BigInt(tokenId) : undefined;
    const monto = /^\d+(\.\d+)?$/.test(precio) ? aWei(precio) : undefined;

    const { data: precioEntrada } = useReadContract({
        address: entrada,
        abi: ENTRADA_ABI,
        functionName: "precio",
    });
    const { data: techo } = useReadContract({
        address: reventa,
        abi: REVENTA_ABI,
        functionName: "techoPorcentaje",
    });

    // El techo se calcula como precio × techo% / 100, igual que el contrato.
    const techoWei =
        precioEntrada !== undefined && techo !== undefined
            ? (precioEntrada * techo) / 100n
            : undefined;

    const dentroDeTecho = techoWei !== undefined && monto !== undefined && monto <= techoWei;
    const habilitado = id !== undefined && monto !== undefined && monto > 0n && dentroDeTecho;

    const aprobar = useTransaccion(
        habilitado
            ? {
                  address: entrada,
                  abi: ENTRADA_ABI,
                  functionName: "approve",
                  args: [reventa, id as bigint],
              }
            : undefined,
    );

    const listar = useTransaccion(
        habilitado && aprobar.fase === "confirmada"
            ? {
                  address: reventa,
                  abi: REVENTA_ABI,
                  functionName: "listar",
                  args: [id as bigint, monto as bigint],
              }
            : undefined,
    );

    const activa = aprobar.fase === "confirmada" ? listar : aprobar;

    if (propias.length === 0) {
        return (
            <>
                <Etiqueta>Publicar una entrada</Etiqueta>
                <p className="text-sm text-ink-500">
                    No tenés entradas vendidas para publicar. Solo se revenden entradas
                    sin usar.
                </p>
            </>
        );
    }

    return (
        <>
            <Etiqueta>Publicar una entrada</Etiqueta>

            <div className="space-y-2">
                {propias.map((e) => (
                    <button
                        key={e.tokenId.toString()}
                        type="button"
                        onClick={() => setTokenId(e.tokenId.toString())}
                        className="tactil foco-anello flex w-full items-center justify-between rounded-xl border border-ink-800/60 bg-ink-950 px-4 py-3 text-left transition-colors duration-300 ease-premium hover:border-ink-700"
                    >
                        <span className="font-mono text-sm text-ink-50">
                            {formatoTokenId(e.tokenId)}
                        </span>
                        <span className="text-xs text-ink-400">
                            {e.asiento.fila}-{e.asiento.asiento}
                        </span>
                        {tokenId === e.tokenId.toString() && (
                            <span className="text-xs text-accent-fg">elegida</span>
                        )}
                    </button>
                ))}
            </div>

            <label className="block">
                <p className="etiqueta">Precio en ETH</p>
                <input
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value.trim())}
                    placeholder={techoWei !== undefined ? (Number(techoWei) / 1e18).toFixed(4) : "0.05"}
                    inputMode="decimal"
                    className="tactil foco-anello mt-2 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-5 font-mono text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
                />
            </label>

            {techoWei !== undefined && (
                <p className="text-xs text-ink-500">
                    Techo: {formatoPrecio(techoWei)} sobre el precio de lista.
                </p>
            )}
            {monto !== undefined && !dentroDeTecho && techoWei !== undefined && (
                <p className="text-xs text-red-400">
                    Estás por encima del techo. El contrato rechaza el listado.
                </p>
            )}

            <Boton
                bloque
                variante="primario"
                tamano="md"
                disabled={!habilitado}
                cargando={activa.ocupada}
                onClick={activa.ejecutar}
            >
                {aprobar.fase === "confirmada" ? "Publicar" : "1. Autorizar al mercado"}
            </Boton>

            <EstadoTransaccion transaccion={activa} />
        </>
    );
}

/**
 * Retirar lo pendiente.
 *
 * `Reventa._retirable` es `private` sin getter, así que la UI no puede
 * mostrar el monto. Se ofrece el botón y deja que el contrato decida: si
 * no hay nada, revierte con `SinFondosParaRetirar`, que el decodificador
 * traduce a un mensaje entendible.
 */
function PanelRetirar() {
    const { chainId } = useAccount();
    const reventa = direccionReventa(chainId);

    const retiro = useTransaccion({
        address: reventa,
        abi: REVENTA_ABI,
        functionName: "retirar",
    });

    return (
        <>
            <Etiqueta>Retirar fondos</Etiqueta>
            <p className="text-xs text-ink-500">
                El comprador y el vendedor acuminan su saldo por separado y lo
                retiran cuando quieren. El contrato no expone el monto pendiente.
            </p>
            <Boton
                bloque
                variante="secundario"
                tamano="md"
                cargando={retiro.ocupada}
                onClick={retiro.ejecutar}
            >
                Retirar lo que me corresponde
            </Boton>
            <EstadoTransaccion transaccion={retiro} />
        </>
    );
}

/** Comprar o cancelar un listado ajeno / propio. */
function FilaListado({
    listado,
    esVendedor,
}: {
    readonly listado: Listado;
    readonly esVendedor: boolean;
}) {
    const { address: conectado, chainId } = useAccount();
    const reventa = direccionReventa(chainId);

    const comprar = useTransaccion(
        !esVendedor && conectado !== undefined
            ? {
                  address: reventa,
                  abi: REVENTA_ABI,
                  functionName: "comprar",
                  args: [listado.id],
                  value: listado.precio,
              }
            : undefined,
    );

    const cancelar = useTransaccion(
        esVendedor
            ? {
                  address: reventa,
                  abi: REVENTA_ABI,
                  functionName: "cancelar",
                  args: [listado.id],
              }
            : undefined,
    );

    const activa = esVendedor ? cancelar : comprar;

    return (
        <li className="space-y-3 rounded-2xl border border-ink-800/60 bg-ink-900 p-5">
            <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-ink-50">
                    {formatoTokenId(listado.tokenId)}
                </span>
                <span className="font-mono text-lg text-ink-50">
                    {formatoPrecio(listado.precio)}
                </span>
            </div>

            <Boton
                bloque
                variante={esVendedor ? "secundario" : "primario"}
                tamano="sm"
                cargando={activa.ocupada}
                onClick={activa.ejecutar}
            >
                {esVendedor ? "Cancelar publicación" : "Comprar"}
            </Boton>

            <EstadoTransaccion transaccion={activa} />
        </li>
    );
}

/**
 * `Listado` abre una publicación; `Comprado` y `Cancelado` la cierran.
 * Lo que queda activo es lo que se puede comprar.
 */
function reconstruir(
    listados: readonly unknown[],
    comprados: readonly unknown[],
    cancelados: readonly unknown[],
): Listado[] {
    const cerrados = new Set<string>([
        ...comprados.map((e) => idListado(e)),
        ...cancelados.map((e) => idListado(e)),
    ]);

    return listados.map((evento) => {
        const args = argumentos(evento);
        const id = bigintDe(args[0]);
        return {
            id,
            tokenId: bigintDe(args[1]),
            vendedor: String(args[2]) as Address,
            precio: bigintDe(args[3]),
            activo: !cerrados.has(id.toString()),
        };
    });
}

function argumentos(evento: unknown): readonly unknown[] {
    if (typeof evento === "object" && evento !== null && "args" in evento) {
        const args = (evento as { args: unknown }).args;
        return Array.isArray(args) ? args : [];
    }
    return [];
}

function bigintDe(valor: unknown): bigint {
    return typeof valor === "bigint" ? valor : BigInt(String(valor ?? 0));
}

function idListado(evento: unknown): string {
    return bigintDe(argumentos(evento)[0]).toString();
}

/** "0.055" → wei. Sin esto, los decimales del input se pierden. */
function aWei(eth: string): bigint {
    const [entero, decimal = ""] = eth.split(".");
    const completo = `${entero}${decimal.padEnd(18, "0").slice(0, 18)}`;
    return BigInt(completo);
}

function Header() {
    return (
        <header className="mb-12 max-w-[55ch]">
            <Etiqueta>Reventa</Etiqueta>
            <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                Mercado secundario, con techo y comisión.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-300">
                Prohibir la reventa no funciona: se hace igual, pero por fuera y sin
                garantías. Acá se permite, con un límite de precio y una comisión que
                vuelve al organizador.
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
            <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-ink-50">
                {valor}
            </p>
        </div>
    );
}