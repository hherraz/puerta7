/**
 * ABIs y direcciones de los contratos de Puerta 7.
 *
 * Los ABIs NO se escriben a mano: los genera `pnpm --filter @puerta7/hardhat
 * exportar` leyendo los artefactos de Hardhat. Este módulo solo reexporta y
 * arma los atajos que consume la UI, para que ninguna página ande
 * importando de `abis/` directamente.
 *
 * Para cambiar los contratos: `pnpm compilar && pnpm desplegar && pnpm exportar`.
 */

import type { Address } from "viem";

import { direccion } from "@/lib/direcciones";

export { ENTRADA_ABI } from "@/lib/abis/Entrada";
export { PUNTOS_ABI } from "@/lib/abis/Puntos";
export { CANJE_ABI } from "@/lib/abis/Canje";
export { REVENTA_ABI } from "@/lib/abis/Reventa";
export { SORTEO_ABI } from "@/lib/abis/Sorteo";
export { CHAIN_ID, sistemaDesplegado } from "@/lib/direcciones";

/** La dirección cero. Un hook nunca debe leer contra esta. */
export const DIRECCION_CERO: Address = "0x0000000000000000000000000000000000000000";

/** Nombres de los contratos del sistema, en el orden de despliegue. */
export type NombreContrato = "Entrada" | "Puntos" | "Canje" | "Reventa" | "Sorteo";

/**
 * Dirección de un contrato en la red conectada.
 *
 * Sin argumento devuelve la dirección de Hardhat local. Pasando el chain
 * ID se devuelve la dirección cero si la wallet está en otra red, que es
 * lo que evita que los hooks dispersen lecturas contra una red sin deploy.
 */
export function direccionContrato(
    contrato: NombreContrato,
    chainId?: number,
): Address {
    return direccion(contrato, chainId);
}

export const direccionEntrada = (chainId?: number) => direccionContrato("Entrada", chainId);
export const direccionPuntos = (chainId?: number) => direccionContrato("Puntos", chainId);
export const direccionCanje = (chainId?: number) => direccionContrato("Canje", chainId);
export const direccionReventa = (chainId?: number) => direccionContrato("Reventa", chainId);
export const direccionSorteo = (chainId?: number) => direccionContrato("Sorteo", chainId);