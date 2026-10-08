/**
 * Tipos de dominio del proyecto. Reflejan la spec en `docs/spec/entrada.md`
 * y los tests en `1-hardhat/test/Entrada.ts`.
 *
 * Mantener este archivo en sync con la spec evita tener que importar el ABI
 * cada vez que querés razonar sobre el dominio en la UI.
 */

/** Sectores del recinto. El contrato acepta 1..4 (A..D); 5 = Cancha. */
export const SECTOR = {
    Invalido: 0,
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    /** Cancha se vende por capacidad total, no por asiento fijo. */
    Cancha: 5,
} as const;
export type Sector = (typeof SECTOR)[keyof typeof SECTOR];

/** Estado de una entrada en la máquina de transiciones Emitida -> Vendida -> Usada. */
export const ESTADO = {
    Inexistente: 0,
    Emitida: 1,
    Vendida: 2,
    Utilizada: 3,
} as const;
export type Estado = (typeof ESTADO)[keyof typeof ESTADO];

/** Etiqueta humana para mostrar en UI. */
export const ETIQUETA_ESTADO: Record<Estado, string> = {
    [ESTADO.Inexistente]: "Inexistente",
    [ESTADO.Emitida]: "Emitida",
    [ESTADO.Vendida]: "Vendida",
    [ESTADO.Utilizada]: "Utilizada",
};

/** Asiento tipográfico que se muestra en la UI. */
export interface Asiento {
    sector: Sector;
    fila: string; // puede ser alfanumérica: "A", "AB", "C12", …
    asiento: string; // idem
}

/** Entrada que el portador ve (vista de wallet). */
export interface EntradaVista {
    tokenId: bigint;
    dueno: `0x${string}`;
    estado: Estado;
    asiento: Asiento;
}
