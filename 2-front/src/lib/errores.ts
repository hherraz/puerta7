import { BaseError, ContractFunctionRevertedError } from "viem";

import { mensajeDeError } from "@/lib/red";

/**
 * Traducción de los reverts del sistema a mensajes que se puedan leer.
 *
 * Hay dos clases de revert y conviene no mezclarlas:
 *
 *   - `Puntos`, `Canje`, `Reventa` y `Sorteo` lanzan `custom errors`
 *     (`error NoEsEmisor();`). Viem los decodifica y nos da el nombre y los
 *     argumentos: son recuperables y se pueden formatear.
 *
 *   - `Entrada` DECLARA custom errors pero ejecuta `revert("...")` con
 *     strings, a propósito, para que la suite de tests verifique los
 *     mensajes literales (ver el comentario en `Entrada.sol`, sección
 *     "ERRORES"). Sus reverts llegan como `reason` y ya vienen en español.
 *
 * Por eso no hay un `decodeErrorResult` sobre `ENTRADA_ABI`: no hay nada
 * que decodificar, hay que leer el `reason`.
 */

/** Explicación en español de cada custom error de los cuatro contratos. */
const MENSAJES: Record<string, string> = {
    // --- Puntos ---
    NoEsEmisor: "Solo el emisor autorizado puede crear puntos.",
    NoEsQuemador: "Solo el quemador autorizado puede quemar puntos.",
    AsistenciaYaPremiada: "Esta entrada ya generó puntos antes.",
    SaldoInsuficiente: "No tenés puntos suficientes.",
    // --- Canje ---
    EntradaNoUsada: "La entrada tiene que estar usada para canjear.",
    NoEsTitular: "La entrada no es tuya.",
    SectorNoSuperior: "El sector destino tiene que ser mejor que el actual.",
    CostoNoDefinido: "El organizador no definió el costo de ese canje.",
    PuntosInsuficientes: "No tenés puntos suficientes para el canje.",
    AforoDestinoCompleto: "No queda lugar en el sector destino.",
    AutorizacionInsuficiente: "Falta autorizar al canje a gastar o mover algo tuyo.",
    // --- Reventa ---
    EntradaUsada: "No se puede revender una entrada ya usada.",
    PrecioSobreTecho: "El precio supera el techo que fijó el organizador.",
    ListadoInactivo: "Ese listado ya no está disponible.",
    NoEsVendedor: "Solo el vendedor puede cancelar el listado.",
    SinFondosParaRetirar: "No tenés fondos pendientes para retirar.",
    ComisionInvalida: "La comisión no puede superar el 100%.",
    RenunciaDeshabilitada:
        "No se puede renunciar al contrato: los fondos quedarían sin dueño. Usá transferir.",
    // --- Sorteo ---
    SorteoNoAbierto: "No hay un sorteo abierto.",
    FueraDePlazoCompromiso: "Se venció el plazo para comprometer postulaciones.",
    FueraDePlazoRevelacion: "Se venció el plazo de revelación o todavía no empieza.",
    CompromisoNoCoincide: "El valor revelado no corresponde a tu compromiso.",
    YaComprometio: "Ya comprometiste una postulación en este sorteo.",
    YaRevelo: "Ya revelaste tu postulación.",
    YaReclamo: "Ya reclamaste el resultado de este sorteo.",
    DepositoInsuficiente: "El depósito es menor al requerido.",
    SorteoNoCerrado: "El sorteo todavía no está cerrado.",
    NoRevelo: "No revelaste tu postulación, así que no hay nada que reclamar.",
    SorteoYaAbierto: "Este contrato ya hizo su sorteo: no se puede reabrir.",
    DepositoExcedido: "Mandaste más que el depósito: tiene que ser exacto.",
    DemasiadasEntradas: "Son demasiadas entradas para un sorteo (máximo 500).",
    // --- Ownable2Step (todos los contratos) ---
    OwnableUnauthorizedAccount: "Solo el organizador puede hacer esto.",
    // --- ERC-721 (Entrada) ---
    ERC721InsufficientApproval: "Falta el permiso del dueño sobre esa entrada.",
};

/**
 * Traduce un error de escritura a un mensaje de pantalla.
 *
 * Cubre en orden: rechazo del usuario, custom error de los cuatro
 * contratos, string revert de `Entrada`, y por último la primera línea del
 * mensaje crudo.
 */
export function explicarError(error: unknown): string {
    if (typeof error === "string") return mensajeDeError(error);
    if (!(error instanceof BaseError)) return "La transacción falló.";

    const crudo = error.shortMessage ?? error.message;

    // El rechazo del usuario nunca llega como revert: la wallet corta
    // antes de firmar. Hay que mirarlo primero.
    if (esRechazo(crudo)) return "Rechazaste la transacción en la billetera.";

    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
        return explicarRevert(revert);
    }

    return mensajeDeError(crudo);
}

/** Custom error de los cuatro contratos, o string revert de `Entrada`. */
function explicarRevert(revert: ContractFunctionRevertedError): string {
    // Custom error: nombre y argumentos vienen anidados en `data`.
    // Viem solo los llena si el revert se pudo decodificar contra el ABI.
    const decodificado = revert.data;
    if (decodificado !== undefined && "errorName" in decodificado) {
        const explicacion = MENSAJES[decodificado.errorName];
        const args = formatearArgs(decodificado.args);

        if (explicacion === undefined) {
            return args ? `${decodificado.errorName}: ${args}` : decodificado.errorName;
        }
        return args ? `${explicacion} ${args}` : explicacion;
    }

    // String revert de Entrada: ya viene en español y es legible.
    if (revert.reason !== undefined) return revert.reason;

    return "El contrato rechazó la operación.";
}

/** `["0x…", 1n]` → `(0xabc… 1)`. Sin argumentos → cadena vacía. */
function formatearArgs(args: readonly unknown[] | undefined): string {
    if (!args || args.length === 0) return "";
    return `(${args.map(formatearArg).join(", ")})`;
}

/** Un argumento de custom error. Ninguno del sistema es un struct. */
function formatearArg(arg: unknown): string {
    if (typeof arg === "bigint") return arg.toString();
    if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") {
        return String(arg);
    }
    if (Array.isArray(arg)) return `[${arg.map(formatearArg).join(", ")}]`;
    return JSON.stringify(arg);
}

/** ¿El error es un rechazo del usuario y no una falla real? */
export function esRechazoUsuario(error: unknown): boolean {
    const texto =
        error instanceof BaseError ? error.shortMessage ?? error.message : String(error);
    return esRechazo(texto);
}

function esRechazo(texto: string): boolean {
    return /user rejected|user denied|rejected the request/i.test(texto);
}