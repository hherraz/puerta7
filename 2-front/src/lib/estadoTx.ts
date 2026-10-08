/**
 * Etiqueta humana del estado de una tx. Se usa en Comprar, Portero,
 * Organizador y Emitir para el renglón de feedback al pie del CTA.
 *
 *   esperando=true              → "esperando confirmación"
 *   esperando=false, confirmado → "confirmada"
 *   otro                        → "pendiente"
 */
export function estadoTx(
    esperando: boolean,
    confirmado: boolean,
): string {
    if (esperando) return "esperando confirmación";
    if (confirmado) return "confirmada";
    return "pendiente";
}
