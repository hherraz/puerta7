/**
 * Direcciones de los contratos de Puerta 7 — GENERADO AUTOMÁTICAMENTE.
 *
 * No editar a mano: lo regenera `pnpm --filter @puerta7/hardhat exportar`
 * leyendo `ignition/deployments/chain-31337/deployed_addresses.json`.
 */

import type { Address } from "viem";

/** Direcciones por chain ID (31337 = Hardhat local). */
export const DIRECCIONES = {
    31337: {
        Entrada: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address,
        Puntos: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as Address,
        Canje: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as Address,
        Reventa: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" as Address,
        Sorteo: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707" as Address,
    },
} as const satisfies Record<number, Record<string, Address>>;

/** Chain ID para el que este archivo tiene direcciones. */
export const CHAIN_ID = 31337;

/**
 * Dirección de un contrato en la red dada. Devuelve la dirección cero si
 * el contrato no está desplegado ahí — los hooks la usan para no disparar
 * lecturas contra una dirección inexistente.
 */
export function direccion(
    contrato: keyof (typeof DIRECCIONES)[31337],
    chainIdActual: number | undefined,
): Address {
    if (chainIdActual !== undefined && chainIdActual !== 31337) {
        return "0x0000000000000000000000000000000000000000";
    }
    return DIRECCIONES[31337][contrato];
}

/** ¿Está el sistema desplegado en la red conectada? */
export function sistemaDesplegado(chainIdActual: number | undefined): boolean {
    if (chainIdActual !== 31337) return false;
    return DIRECCIONES[31337].Entrada !== "0x0000000000000000000000000000000000000000";
}
