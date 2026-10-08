import { SECTOR, type Sector } from "@/tipos/entrada";

/** Nombre visible de cada sector en UI. */
export const NOMBRE_SECTOR: Record<Sector, string> = {
    [SECTOR.Invalido]: "—",
    [SECTOR.A]: "Platea",
    [SECTOR.B]: "Platea Alta",
    [SECTOR.C]: "Platea Baja",
    [SECTOR.D]: "Galería",
    [SECTOR.Cancha]: "Cancha",
};

/** Orden estable para iterar / mostrar. */
export const SECTORES_ORDENADOS: Sector[] = [
    SECTOR.A,
    SECTOR.B,
    SECTOR.C,
    SECTOR.D,
    SECTOR.Cancha,
];

/** Sector codificado como uint16 (para construir calls). */
export function sectorAId(s: Sector): number {
    return s;
}
