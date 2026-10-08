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
