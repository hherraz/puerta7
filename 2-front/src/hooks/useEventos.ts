"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import type { Abi, Address, ContractEventName } from "viem";

/**
 * Historial de eventos de un contrato, leído de los logs.
 *
 * Existe porque los contratos no exponen getters para lo interesante:
 * `Reventa._listados`, `Canje._costos` y `Sorteo._postulacion` son
 * `private` sin getter. Agregar getters implicaría tocar los contratos, y
 * los logs ya están ahí: son la fuente de verdad pública.
 *
 * Ojo con el alcance: lee el rango completo una sola vez, cuando cambia la
 * dirección, el evento o la red. No se resuscita con cada bloque. Para lo
 * que cambia seguido sirve `useSincronizacion`, que refresca las lecturas.
 *
 * Devuelve `unknown[]`: el angostado a la forma concreta lo hace cada
 * página, que es quien sabe qué evento pidió.
 */
export function useEventos<TAbi extends Abi, TFn extends ContractEventName<TAbi>>(
    direccion: Address | undefined,
    abi: TAbi,
    eventName: TFn,
    opciones: { desdeBloque?: bigint; enabled?: boolean } = {},
): { readonly eventos: unknown[]; readonly isLoading: boolean } {
    const { desdeBloque = 0n, enabled = true } = opciones;
    const cliente = usePublicClient();

    const [eventos, setEventos] = useState<unknown[]>([]);
    const [isLoading, setCargando] = useState(false);

    useEffect(() => {
        if (!enabled || !cliente || direccion === undefined) return;

        let vigente = true;
        setCargando(true);

        cliente
            .getContractEvents({
                address: direccion,
                abi,
                eventName,
                fromBlock: desdeBloque,
                toBlock: "latest",
                strict: false,
            })
            .then((logs: unknown[]) => {
                if (vigente) setEventos(logs);
            })
            .catch(() => {
                // Un rango mal Formationado o un nodo caído no vale para
                // romper la pantalla: mostramos la lista vacía.
                if (vigente) setEventos([]);
            })
            .finally(() => {
                if (vigente) setCargando(false);
            });

        return () => {
            vigente = false;
        };
    }, [cliente, direccion, abi, eventName, desdeBloque, enabled]);

    return { eventos, isLoading };
}