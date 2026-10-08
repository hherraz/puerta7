import { ETIQUETA_ESTADO, ESTADO, type Estado } from "@/tipos/entrada";
import { Etiqueta } from "./ui/Etiqueta";

/**
 * Badge de estado visible en cada TarjetaEntrada.
 * Las invariantes del contrato se respetan desde el render: si el
 * token está Utilizada, no se puede volver a Usar (lo cortamos en la UI).
 */
export function EstadoBadge({ estado }: { estado: Estado }) {
    switch (estado) {
        case ESTADO.Emitida:
            return <Etiqueta tono="acento">{ETIQUETA_ESTADO[estado]}</Etiqueta>;
        case ESTADO.Vendida:
            return <Etiqueta tono="positivo">{ETIQUETA_ESTADO[estado]}</Etiqueta>;
        case ESTADO.Utilizada:
            return <Etiqueta tono="neutral">{ETIQUETA_ESTADO[estado]}</Etiqueta>;
        default:
            return <Etiqueta tono="neutral">{ETIQUETA_ESTADO[estado]}</Etiqueta>;
    }
}
