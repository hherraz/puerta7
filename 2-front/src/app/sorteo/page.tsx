"use client";

import { useAccount, useReadContracts } from "wagmi";
import { useEffect, useState } from "react";
import { encodePacked, keccak256, toHex } from "viem";

import { Boton } from "@/components/ui/Boton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Separador } from "@/components/ui/Separador";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { AvisoRed } from "@/components/web3/AvisoRed";
import { EstadoTransaccion } from "@/components/web3/EstadoTransaccion";
import { ConectarBilletera } from "@/components/ConectarBilletera";
import { useEventos } from "@/hooks/useEventos";
import { direccionSorteo, SORTEO_ABI } from "@/lib/contrato";
import { formatoPrecio } from "@/lib/formato";
import { useTransaccion } from "@/lib/estadoTx";

/**
 * Sorteo por commit-reveal.
 *
 * El compromiso se calcula acá, en el cliente, tal como lo espera el
 * contrato:
 *
 *     compromiso = keccak256(abi.encodePacked(valor, salt, msg.sender))
 *
 * Incluir `msg.sender` es lo que impide copiar el compromiso de otro
 * postulante: sin la dirección, el hash de alguien le sirve a cualquiera.
 *
 * `Sorteo._postulacion` es `private` sin getter, así que el estado del
 * postulante se reconstruye leyendo sus propios eventos.
 */
export default function SorteoPage() {
    const { isConnected, chainId } = useAccount();
    const sorteo = direccionSorteo(chainId);

    const { data: estado } = useReadContracts({
        contracts: [
            { address: sorteo, abi: SORTEO_ABI, functionName: "abierto" },
            { address: sorteo, abi: SORTEO_ABI, functionName: "cerrado" },
            { address: sorteo, abi: SORTEO_ABI, functionName: "finCompromiso" },
            { address: sorteo, abi: SORTEO_ABI, functionName: "finRevelacion" },
            { address: sorteo, abi: SORTEO_ABI, functionName: "cantidadEntradas" },
            { address: sorteo, abi: SORTEO_ABI, functionName: "deposito" },
            { address: sorteo, abi: SORTEO_ABI, functionName: "bloqueSorteo" },
        ],
    });

    const abierto = estado?.[0]?.result as boolean | undefined;
    const cerrado = estado?.[1]?.result as boolean | undefined;
    const finCompromiso = estado?.[2]?.result as bigint | undefined;
    const finRevelacion = estado?.[3]?.result as bigint | undefined;
    const entradasEnJuego = estado?.[4]?.result as bigint | undefined;
    const deposito = estado?.[5]?.result as bigint | undefined;
    const bloqueSorteo = estado?.[6]?.result as bigint | undefined;

    if (!isConnected) {
        return (
            <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <Header />
                <Tarjeta className="flex flex-col items-start gap-6 p-10 md:p-12">
                    <Etiqueta>Conectá tu billetera</Etiqueta>
                    <p className="max-w-[55ch] text-base text-ink-300">
                        Postular es comprometer un valor secreto y firmarlo.
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

            <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-4">
                <Stat
                    titulo="Estado"
                    valor={cerrado === true ? "Cerrado" : abierto === true ? "Abierto" : "Sin sorteo"}
                />
                <Stat titulo="Entradas en juego" valor={entradasEnJuego?.toString() ?? "—"} />
                <Stat titulo="Depósito" valor={formatoPrecio(deposito)} />
                <Stat titulo="Cierra revelación" valor={aFecha(finRevelacion)} />
            </div>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-ink-800/60 md:grid-cols-2">
                <div className="space-y-8 bg-ink-900 p-10">
                    <PanelAbrir />
                    <Separador />
                    <PanelCerrar bloqueSorteo={bloqueSorteo} />
                    <Separador />
                    <PanelRetirar />
                </div>

                <div className="space-y-8 bg-ink-950 p-10">
                    <PanelPostular
                        abierto={abierto === true}
                        cerrado={cerrado === true}
                        finCompromiso={finCompromiso}
                        deposito={deposito}
                    />
                    <Separador />
                    <PanelReclamar cerrado={cerrado === true} />
                </div>
            </div>
        </section>
    );
}

/** Solo el organizador abre el sorteo. */
function PanelAbrir() {
    const { chainId } = useAccount();
    const sorteo = direccionSorteo(chainId);

    const [cantidad, setCantidad] = useState("1");
    const [plazoCompromiso, setPlazoCompromiso] = useState("3600");
    const [plazoRevelacion, setPlazoRevelacion] = useState("3600");

    const habilitado = /^\d+$/.test(cantidad) && /^\d+$/.test(plazoCompromiso) && /^\d+$/.test(plazoRevelacion);

    const abrir = useTransaccion(
        habilitado
            ? {
                  address: sorteo,
                  abi: SORTEO_ABI,
                  functionName: "abrirSorteo",
                  args: [BigInt(cantidad), BigInt(plazoCompromiso), BigInt(plazoRevelacion)],
              }
            : undefined,
    );

    return (
        <>
            <Etiqueta>Abrir sorteo</Etiqueta>
            <p className="text-xs text-ink-500">Solo el organizador.</p>

            <Campo
                etiqueta="Cantidad de entradas"
                valor={cantidad}
                onChange={setCantidad}
                placeholder="1"
            />
            <Campo
                etiqueta="Plazo de compromiso (seg)"
                valor={plazoCompromiso}
                onChange={setPlazoCompromiso}
                placeholder="3600"
            />
            <Campo
                etiqueta="Plazo de revelación (seg)"
                valor={plazoRevelacion}
                onChange={setPlazoRevelacion}
                placeholder="3600"
            />

            <Boton
                bloque
                variante="primario"
                tamano="md"
                disabled={!habilitado}
                cargando={abrir.ocupada}
                onClick={abrir.ejecutar}
            >
                Abrir sorteo
            </Boton>

            <EstadoTransaccion transaccion={abrir} />
        </>
    );
}

/**
 * `cerrar()` no es del organizador: cualquiera puede gatillarlo. Va en dos
 * llamadas: la primera fija un bloque futuro y la segunda, minado ese
 * bloque, suma su hash a la entropía y sortea. Así el último en revelar no
 * puede calcular el resultado antes de decidir si revela.
 */
function PanelCerrar({ bloqueSorteo }: { readonly bloqueSorteo: bigint | undefined }) {
    const { chainId } = useAccount();
    const sorteo = direccionSorteo(chainId);

    const cerrar = useTransaccion({
        address: sorteo,
        abi: SORTEO_ABI,
        functionName: "cerrar",
    });

    const pidioBloque = bloqueSorteo !== undefined && bloqueSorteo > 0n;

    return (
        <>
            <Etiqueta>Cerrar el sorteo</Etiqueta>
            <p className="text-xs text-ink-500">
                {pidioBloque
                    ? `Bloque del sorteo: ${bloqueSorteo.toString()}. Cuando se mine, su hash se suma a la entropía y salen los ganadores. Si no pasa nada, ese bloque todavía no existe: volvé a tocar en unos segundos.`
                    : "Cualquiera puede llamarlo, después de que venza el plazo de revelación. Primero se fija un bloque futuro; después su hash se combina con lo revelado para calcular los ganadores."}
            </p>
            <Boton
                bloque
                variante="secundario"
                tamano="md"
                cargando={cerrar.ocupada}
                onClick={cerrar.ejecutar}
            >
                {pidioBloque ? "Calcular ganadores" : "Fijar el bloque del sorteo"}
            </Boton>
            <EstadoTransaccion transaccion={cerrar} />
        </>
    );
}

/** Solo el organizador: lo que no se devuelve (ganadores y quienes no revelaron). */
function PanelRetirar() {
    const { chainId } = useAccount();
    const sorteo = direccionSorteo(chainId);

    const retirar = useTransaccion({
        address: sorteo,
        abi: SORTEO_ABI,
        functionName: "retirar",
    });

    return (
        <>
            <Etiqueta>Retirar lo recaudado</Etiqueta>
            <p className="text-xs text-ink-500">
                Solo el organizador, después del cierre. Retira los depósitos de los
                ganadores y de quienes no revelaron; lo que se les debe a los
                perdedores queda reservado hasta que lo reclamen.
            </p>
            <Boton
                bloque
                variante="secundario"
                tamano="md"
                cargando={retirar.ocupada}
                onClick={retirar.ejecutar}
            >
                Retirar
            </Boton>
            <EstadoTransaccion transaccion={retirar} />
        </>
    );
}

/**
 * Comprometer y revelar. Son dos pasos separados en el tiempo, y el valor
 * secreto vive solo en este navegador hasta que se revela.
 */
function PanelPostular({
    abierto,
    cerrado,
    finCompromiso,
    deposito,
}: {
    readonly abierto: boolean;
    readonly cerrado: boolean;
    readonly finCompromiso: bigint | undefined;
    readonly deposito: bigint | undefined;
}) {
    const { address, chainId } = useAccount();
    const sorteo = direccionSorteo(chainId);

    const [valor, setValor] = useState("");
    const [salt, setSalt] = useState("");

    // Valor y salt se guardan en este navegador hasta revelar: si se
    // perdieran (por ejemplo, al recargar), no se podría revelar y se
    // perdería el depósito.
    const clave = address !== undefined ? `puerta7:sorteo:${sorteo}:${address}` : undefined;
    useEffect(() => {
        if (clave === undefined) return;
        try {
            const guardado = localStorage.getItem(clave);
            if (guardado === null) return;
            const datos = JSON.parse(guardado) as { valor?: string; salt?: string };
            setValor(datos.valor ?? "");
            setSalt(datos.salt ?? "");
        } catch {
            // Sin almacenamiento disponible: se sigue sin recordar.
        }
    }, [clave]);
    useEffect(() => {
        if (clave === undefined || (valor === "" && salt === "")) return;
        try {
            localStorage.setItem(clave, JSON.stringify({ valor, salt }));
        } catch {
            // Sin almacenamiento disponible: se sigue sin recordar.
        }
    }, [clave, valor, salt]);

    // Azar del navegador (criptográfico), no algo tipeado a mano: un salt
    // fácil de adivinar dejaría descubrir el valor antes de tiempo.
    function generarAlAzar() {
        const [valorAzar = 0n] = crypto.getRandomValues(new BigUint64Array(1));
        setValor(valorAzar.toString());
        setSalt(toHex(crypto.getRandomValues(new Uint8Array(32))));
    }

    const { eventos: comprometidos } = useEventos(sorteo, SORTEO_ABI, "PostulacionComprometida");
    const { eventos: revelados } = useEventos(sorteo, SORTEO_ABI, "PostulacionRevelada");

    const propio = address?.toLowerCase() ?? "";
    const yaComprometio = comprometidos.some((e) => esMio(e, propio));
    const yaRevelo = revelados.some((e) => esMio(e, propio));

    const valorOk = /^\d+$/.test(valor);
    const saltOk = /^0x[0-9a-fA-F]{64}$/.test(salt);

    // El compromiso se calcula en el cliente. Solo se arma si el salt es
    // un bytes32 válido: codificar algo inválido tiraría al escribir.
    const compromiso =
        address !== undefined && valorOk && saltOk
            ? keccak256(
                  encodePacked(["uint256", "bytes32", "address"], [
                      BigInt(valor),
                      salt as `0x${string}`,
                      address,
                  ]),
              )
            : undefined;

    const comprometer = useTransaccion(
        abierto && !cerrado && !yaComprometio && compromiso !== undefined && deposito !== undefined
            ? {
                  address: sorteo,
                  abi: SORTEO_ABI,
                  functionName: "comprometer",
                  args: [compromiso],
                  value: deposito,
              }
            : undefined,
    );

    const revelar = useTransaccion(
        abierto && yaComprometio && !yaRevelo && valorOk && saltOk
            ? {
                  address: sorteo,
                  abi: SORTEO_ABI,
                  functionName: "revelar",
                  args: [BigInt(valor), salt as `0x${string}`],
              }
            : undefined,
    );

    const activa = yaComprometio ? revelar : comprometer;

    const explicacion = yaRevelo
        ? "Ya revelaste tu valor."
        : yaComprometio
          ? "Comprometiste. Ahora revelá el valor antes de que venza el plazo."
          : "Elegí un valor secreto y un salt. El compromiso viaja a la cadena; el valor, no.";

    return (
        <>
            <Etiqueta>Tu postulación</Etiqueta>
            <p className="text-xs text-ink-500">{explicacion}</p>

            <Campo etiqueta="Valor secreto" valor={valor} onChange={setValor} placeholder="42" />
            <Campo
                etiqueta="Salt (32 bytes hex)"
                valor={salt}
                onChange={setSalt}
                placeholder="0x…"
            />
            {!yaComprometio && (
                <Boton bloque variante="secundario" tamano="md" onClick={generarAlAzar}>
                    Generar valor y salt al azar
                </Boton>
            )}
            <p className="text-xs text-ink-600">
                Se guardan en este navegador hasta que revelás. Sin ellos no podés
                revelar y perdés el depósito.
            </p>

            <Boton
                bloque
                variante="primario"
                tamano="md"
                disabled={yaRevelo || cerrado || !valorOk || !saltOk}
                cargando={activa.ocupada}
                onClick={activa.ejecutar}
            >
                {yaComprometio ? "Revelar valor" : `Comprometer (${formatoPrecio(deposito)})`}
            </Boton>

            <EstadoTransaccion transaccion={activa} />

            {finCompromiso !== undefined && (
                <p className="font-mono text-xs text-ink-600">
                    Cierra el compromiso: {aFecha(finCompromiso)}
                </p>
            )}
        </>
    );
}

/** Reclamar: entrega la entrada si ganaste, o devuelve el depósito. */
function PanelReclamar({ cerrado }: { readonly cerrado: boolean }) {
    const { chainId } = useAccount();
    const sorteo = direccionSorteo(chainId);

    const reclamar = useTransaccion({
        address: sorteo,
        abi: SORTEO_ABI,
        functionName: "reclamar",
    });

    return (
        <>
            <Etiqueta>Reclamar</Etiqueta>
            <p className="text-xs text-ink-500">
                Después del cierre: si ganaste recibís la entrada, si perdés recuperás
                el depósito. Una sola vez por persona.
            </p>
            <Boton
                bloque
                variante="primario"
                tamano="md"
                disabled={!cerrado}
                cargando={reclamar.ocupada}
                onClick={reclamar.ejecutar}
            >
                Reclamar resultado
            </Boton>
            <EstadoTransaccion transaccion={reclamar} />
        </>
    );
}

interface CampoProps {
    readonly etiqueta: string;
    readonly valor: string;
    readonly onChange: (next: string) => void;
    readonly placeholder: string;
}

function Campo({ etiqueta, valor, onChange, placeholder }: CampoProps) {
    return (
        <label className="block">
            <p className="etiqueta">{etiqueta}</p>
            <input
                value={valor}
                onChange={(e) => onChange(e.target.value.trim())}
                placeholder={placeholder}
                className="tactil foco-anello mt-2 h-12 w-full rounded-2xl border border-ink-800/60 bg-ink-950 px-5 font-mono text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-accent"
            />
        </label>
    );
}

/** ¿Este evento de postulación es de la wallet conectada? */
function esMio(evento: unknown, propio: string): boolean {
    if (propio === "") return false;
    const postulante = argumentos(evento)[0];
    return String(postulante).toLowerCase() === propio;
}

function argumentos(evento: unknown): readonly unknown[] {
    if (typeof evento === "object" && evento !== null && "args" in evento) {
        const args = (evento as { args: unknown }).args;
        return Array.isArray(args) ? args : [];
    }
    return [];
}

function aFecha(timestamp: bigint | undefined): string {
    if (timestamp === undefined || timestamp === 0n) return "—";
    return new Date(Number(timestamp) * 1000).toLocaleString("es-AR");
}

function Header() {
    return (
        <header className="mb-12 max-w-[55ch]">
            <Etiqueta>Sorteo</Etiqueta>
            <h1 className="mt-6 text-display-lg font-semibold tracking-tighter text-ink-50">
                Sorteo por commit-reveal.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-300">
                Primero comprometés un valor secreto; después lo revelás. Mientras
                tanto nadie —tampoco vos— puede saber el resultado.
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