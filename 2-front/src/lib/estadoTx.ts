"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    useSimulateContract,
    useWaitForTransactionReceipt,
    useWriteContract,
} from "wagmi";
import type { Abi, Address, ContractFunctionArgs, ContractFunctionName } from "viem";

import { explicarError, esRechazoUsuario } from "@/lib/errores";

/**
 * Ciclo de vida de una escritura, con los estados que de verdad existen.
 *
 * El hook primero SIMULA y recién después pide firma. No es un detalle de
 * UI: simular primero convierte la mayoría de los reverts —"no hay entradas
 * disponibles", "no sos el portero", "te faltan puntos"— en un mensaje
 * antes de que aparezca el cartel de la wallet, sin gastar gas y sin que
 * el usuario firme algo que va a fallar.
 *
 *   inactiva ──preparando──▶ (simulación ok) ──▶ esperandoFirma
 *      ▲                         │                        │
 *      │                         ▼                        ▼
 *      └─── fallo de simulación ┘                      minando
 *                                                    │      │
 *                                    confirmada ◀───┘      └──▶ fallida
 */
export type FaseTx =
    | "inactiva"
    | "preparando"
    | "esperandoFirma"
    | "minando"
    | "confirmada"
    | "fallida";

/** Copy de cada fase, para el renglón de estado debajo del botón. */
const ETIQUETAS: Record<FaseTx, string> = {
    inactiva: "",
    preparando: "Simulando…",
    esperandoFirma: "Esperando firma en la billetera…",
    minando: "Minando…",
    confirmada: "Confirmada",
    fallida: "Falló",
};

/**
 * Qué escribir.
 *
 * Es un tipo propio y no el `UseSimulateContractParameters` de wagmi: aquel
 * resuelve su `functionName` con un condicional que TypeScript no reduce
 * cuando el ABI es genérico, y termina en "type instantiation is
 * excessively deep". Acá los `args` siguen quedando contra el
 * `functionName` del ABI, que es el control que importa: el error aparece
 * en el punto de llamada, en la página.
 */
export interface ParametrosEscritura<
    TAbi extends Abi,
    TFn extends ContractFunctionName<TAbi, "payable" | "nonpayable">,
> {
    readonly address: Address;
    readonly abi: TAbi;
    readonly functionName: TFn;
    readonly args?: ContractFunctionArgs<TAbi, "payable" | "nonpayable", TFn>;
    readonly value?: bigint;
}

/**
 * Estado de una escritura. No lleva genéricos: los tipos del contrato solo
 * aparecen en la entrada de `useTransaccion`, nunca en el retorno, así que
 * los componentes que lo consumen no los necesitan.
 */
export interface Transaccion {
    readonly fase: FaseTx;
    readonly etiqueta: string;
    readonly hash: `0x${string}` | undefined;
    readonly error: string | undefined;
    /** Hay una operación en vuelo: la UI deshabilita el botón. */
    readonly ocupada: boolean;
    /** El usuario rechazó la firma. No es un error de la app. */
    readonly rechazada: boolean;
    /** Lanza la transacción. */
    readonly ejecutar: () => void;
    /** Vuelve al estado inicial. */
    readonly reiniciar: () => void;
}

/** La parte de la simulación que este hook consume, ya desacoplada. */
interface ResultadoSimulacion<TAbi extends Abi, TFn extends ContractFunctionName<TAbi, "payable" | "nonpayable">> {
    readonly request: ParametrosEscritura<TAbi, TFn> | undefined;
    readonly error: unknown;
    readonly isFetching: boolean;
}

export function useTransaccion<
    const TAbi extends Abi,
    TFn extends ContractFunctionName<TAbi, "payable" | "nonpayable">,
>(parametros: ParametrosEscritura<TAbi, TFn> | undefined): Transaccion {
    // La simulación solo corre cuando el usuario apretó el botón. Antes de
    // eso no tiene sentido: los parámetros pueden no estar listos todavía.
    const [pedido, setPedido] = useState(false);
    const escritura = useWriteContract();
    const [fase, setFase] = useState<FaseTx>("inactiva");
    const [error, setError] = useState<string | undefined>(undefined);

    // Los dos casts siguientes son el puente con los tipos internos de
    // wagmi, que no se dejan tipar desde un ABI genérico. Toda la
    // validación de `address`/`abi`/`functionName`/`args` ya ocurrió antes,
    // al entrar por `ParametrosEscritura`.
    type EntradaSimulacion = Parameters<typeof useSimulateContract>[0];
    type SalidaSimulacion = ResultadoSimulacion<TAbi, TFn>;
    type EntradaEscritura = Parameters<typeof escritura.writeContractAsync>[0];

    const simulacion = useSimulateContract(
        (parametros === undefined
            ? undefined
            : { ...parametros, query: { enabled: pedido } }) as EntradaSimulacion,
    ) as unknown as SalidaSimulacion;

    const { data: hash } = escritura;
    const { isSuccess: confirmada, error: errorRecibo } =
        useWaitForTransactionReceipt({ hash });

    const preparado = simulacion.request;
    // Guarda el request ya consumido para no reenviar la misma tx si el
    // efecto vuelve a dispararse.
    const enviado = useRef<unknown>(null);

    useEffect(() => {
        if (errorRecibo) setError(explicarError(errorRecibo));
    }, [errorRecibo]);

    useEffect(() => {
        if (simulacion.error) setError(explicarError(simulacion.error));
    }, [simulacion.error]);

    // La simulación terminó bien: pedimos la firma.
    useEffect(() => {
        if (!pedido || !preparado || enviado.current === preparado) return;

        enviado.current = preparado;
        setFase("esperandoFirma");

        escritura
            .writeContractAsync({
                address: preparado.address,
                abi: preparado.abi,
                functionName: preparado.functionName,
                args: preparado.args,
                value: preparado.value,
            } as EntradaEscritura)
            .catch((fallo: unknown) => {
                // El rechazo del usuario no es un error de la app: lo
                // dejamos en el estado inicial con un aviso, no como
                // "la transacción falló".
                if (esRechazoUsuario(fallo)) {
                    setFase("inactiva");
                    setError("Rechazaste la transacción en la billetera.");
                } else {
                    setFase("fallida");
                    setError(explicarError(fallo));
                }
            });
    }, [pedido, preparado, escritura]);

    const ejecutar = useCallback(() => {
        if (!parametros) return;

        enviado.current = null;
        setError(undefined);
        setFase("preparando");
        setPedido(true);
    }, [parametros]);

    const reiniciar = useCallback(() => {
        // No hace falta resetear la simulación: con `pedido` en false el
        // hook no corre, y al volver a pedir se vuelve a simular.
        escritura.reset();
        enviado.current = null;
        setPedido(false);
        setFase("inactiva");
        setError(undefined);
    }, [escritura]);

    // A partir de que hay hash, manda la receipt y no la simulación.
    const faseEfectiva = useMemo<FaseTx>(() => {
        if (errorRecibo) return "fallida";
        if (confirmada) return "confirmada";
        if (hash !== undefined) return "minando";
        if (simulacion.error) return "fallida";
        if (pedido && simulacion.isFetching) return "preparando";
        return fase;
    }, [errorRecibo, confirmada, hash, simulacion.error, simulacion.isFetching, pedido, fase]);

    return {
        fase: faseEfectiva,
        etiqueta: ETIQUETAS[faseEfectiva],
        hash,
        error,
        ocupada: estaOcupada(faseEfectiva),
        rechazada: fase === "inactiva" && error !== undefined,
        ejecutar,
        reiniciar,
    };
}

/** ¿La fase actual indica que hay que esperar? Se usa para el spinner. */
export function estaOcupada(fase: FaseTx): boolean {
    return fase === "preparando" || fase === "esperandoFirma" || fase === "minando";
}