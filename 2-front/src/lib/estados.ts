import { ESTADO, type Estado } from "@/tipos/entrada";

/**
 * Decodifica el `uint8` que devuelve `estado(tokenId)` on-chain a un
 * valor tipado del enum local. Si el código no es ninguno de los
 * tres conocidos (contrato desactualizado, zero address, etc.)
 * devolvemos `Inexistente`.
 */
export function decodeEstado(codigo: number | undefined): Estado {
    if (codigo === ESTADO.Emitida) return ESTADO.Emitida;
    if (codigo === ESTADO.Vendida) return ESTADO.Vendida;
    if (codigo === ESTADO.Utilizada) return ESTADO.Utilizada;
    return ESTADO.Inexistente;
}
