/**
 * Formateo determinístico para valores on-chain. Sin i18n libs: el sitio
 * es monolingüe español AR, así evitamos peso innecesario.
 */

/** Wei → ETH legible. 4 decimales (un boleto es barato, más precisión satura). */
export function formatoPrecio(wei: bigint | undefined): string {
    if (wei === undefined) return "—";
    const eth = Number(wei) / 1e18;
    return `${eth.toFixed(4)} ETH`;
}

/**
 * Puntos → número legible. `Puntos` es un ERC-20 con 18 decimales, pero
 * los puntos se emiten en enteros y no son una moneda: mostrar "0.0000"
 * cuando hay 250 sería engañoso, así que acá se recorta a 2 decimales y
 * se saca el cero entero.
 */
export function formatoPuntos(cantidad: bigint | undefined): string {
    if (cantidad === undefined) return "—";
    if (cantidad === 0n) return "0";

    const entero = cantidad / 10n ** 18n;
    const resto = (cantidad % 10n ** 18n) / 10n ** 16n; // 2 decimales

    if (resto === 0n) return entero.toString();
    return `${entero.toString()}.${resto.toString().padStart(2, "0")}`;
}

/** Token id → "P7 #003" con padding a 3 dígitos. */
export function formatoTokenId(id: bigint | number | undefined): string {
    if (id === undefined) return "—";
    return `#${id.toString().padStart(3, "0")}`;
}

/** Dirección 0x → "0x12…34ab". */
export function formatoDireccion(dir: string | undefined): string {
    if (!dir) return "—";
    return `${dir.slice(0, 6)}…${dir.slice(-4)}`;
}

/** Hash de tx → "0x1234…56" para mostrar copy de confirmación. */
export function formatoHash(hash: string | undefined): string {
    if (!hash) return "—";
    return `${hash.slice(0, 10)}…${hash.slice(-4)}`;
}
