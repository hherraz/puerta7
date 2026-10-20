import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Despliegue del sistema completo de Puerta 7.
 *
 * La topología no es plana: `Canje` y `Sorteo` hablan con `Entrada` y con
 * `Puntos`, así que Ignition despliega primero las hojas y después ejecuta
 * las designaciones cruzadas. Si alguna falta, el canje revierte en
 * producción con un error poco claro (ver el bloque [SOLO INSTRUCTOR] de
 * `docs/spec/canje.md`, "Permisos cruzados").
 *
 *   Entrada ──┬──> Sorteo   (emite la entrada del ganador)
 *             └──> Canje    (quema la usada, emite la mejora)
 *             └──> Reventa   (lee precio/estado, transfiere)
 *   Puntos ────────> Canje    (quema los puntos del canje)
 */

// 0.05 ETH: 50_000_000_000_000_000 wei.
const PRECIO_ENTRADA = 50_000_000_000_000_000n;

// 0.01 ETH de depósito por postulación al sorteo.
const DEPOSITO_SORTEO = 10_000_000_000_000_000n;

export default buildModule("SistemaPuerta7", (m) => {
    // El portero es un rol DISTINTO del owner (ver `Entrada.sol`). Usamos la
    // cuenta 1 para que el flujo portero/organizador se pueda probar entero
    // con dos cuentas de la wallet. La cuenta 0 queda como `owner` de los
    // cinco contratos por `Ownable(msg.sender)`.
    const portero = m.getAccount(1);

    // --- Hojas: sin dependencias de otros contratos ------------------------
    const entrada = m.contract("Entrada", [PRECIO_ENTRADA, portero]);
    const puntos = m.contract("Puntos");

    // --- Dependientes: reciben direcciones de las hojas ---------------------
    const sorteo = m.contract("Sorteo", [entrada, DEPOSITO_SORTEO]);
    const canje = m.contract("Canje", [entrada, puntos]);
    const reventa = m.contract("Reventa", [entrada]);

    // --- Designaciones cruzadas ---------------------------------------------
    // Los ids son obligatorios: `designarOperadorAutorizado` se llama dos
    // veces sobre `Entrada` y el id autogenerado (que deriva de la firma del
    // método) colisionaría.
    //
    // Canje necesita quemar entradas y emitir las mejoras.
    m.call(entrada, "designarOperadorAutorizado", [canje, true], {
        id: "designarCanjeComoOperador",
    });

    // Sorteo necesita emitir la entrada del ganador.
    m.call(entrada, "designarOperadorAutorizado", [sorteo, true], {
        id: "designarSorteoComoOperador",
    });

    // Canje es el único que puede destruir puntos al entregar una mejora.
    m.call(puntos, "designarQuemador", [canje]);

    // OJO: la spec de `puntos.md` designa a `Entrada` como emisor ("emite
    // puntos cuando una entrada se marca como usada"), pero `Entrada.usar()`
    // hoy NO llama a `Puntos.emitir` — la spec quedó a medio cablear. Designar
    // el emisor igual es inocuo y deja el permiso listo para cuando se cablee;
    // mientras tanto nadie puede emitir puntos y la pantalla de `/puntos`
    // muestra el saldo en cero.
    m.call(puntos, "designarEmisor", [entrada]);

    // Solo se devuelven contratos: Ignition tipa el retorno como futures de
    // contrato, y una cuenta (`AccountRuntimeValue`) no es una de esas.
    return { entrada, puntos, sorteo, canje, reventa };
});