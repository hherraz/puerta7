/**
 * Demo de ataques: reproduce cada hallazgo de la revisión de seguridad
 * contra contratos recién desplegados y muestra si el ataque FUNCIONÓ
 * (vulnerable) o quedó BLOQUEADO (corregido). El veredicto sale de lo que
 * pasa en la cadena, no de la versión: el mismo script sirve para el código
 * viejo y para el corregido (detecta qué funciones existen).
 *
 *   DEMO_VERSION="DESPUÉS" npx hardhat run scripts/demo-ataques.ts --network localhost
 *
 * Despliega contratos nuevos para cada escenario, así no depende del estado
 * del nodo y se puede correr las veces que haga falta.
 */
import { network } from "hardhat";

const { ethers } = await network.create();

const PRECIO = ethers.parseEther("0.1");
const DEPOSITO = ethers.parseEther("0.01");
const PLAZO = 60; // segundos por fase del sorteo

let vulnerables = 0;
let bloqueados = 0;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** ¿El contrato tiene esta función? (el código viejo no tiene las nuevas) */
function tiene(contrato: any, funcion: string): boolean {
    return contrato.interface.getFunction(funcion) !== null;
}

/** Ejecuta y devuelve si revirtió y por qué. */
async function intentar(
    accion: () => Promise<any>,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
    try {
        const tx = await accion();
        if (tx?.wait) await tx.wait();
        return { ok: true };
    } catch (error: any) {
        const texto = String(error?.shortMessage ?? error?.message ?? error).split("\n")[0];
        // "…reverted with reason string 'X'" / "…reverted with custom error 'X()'" → X
        const revert = texto.match(/reverted with (?:reason string|custom error) '(.+)'/);
        // Custom error que el proveedor no decodificó: se busca por selector.
        const datos = texto.match(/return data: (0x[0-9a-fA-F]{8})/)?.[1];
        const porSelector = datos ? ERRORES_CONOCIDOS.get(datos.toLowerCase()) : undefined;
        return { ok: false, motivo: revert?.[1] ?? porSelector ?? error?.revert?.name ?? error?.reason ?? texto };
    }
}

/** Selector → nombre, para los custom errors que pueden aparecer en la demo. */
const ERRORES_CONOCIDOS = new Map(
    ["SinFondosParaRetirar()", "ListadoInactivo()", "AutorizacionInsuficiente()", "SorteoYaAbierto()"].map(
        (firma) => [ethers.id(firma).slice(0, 10), firma] as const,
    ),
);

async function minar() {
    await ethers.provider.send("evm_mine", []);
}

async function avanzar(segundos: number) {
    await ethers.provider.send("evm_increaseTime", [segundos]);
    await minar();
}

function eth(wei: bigint) {
    return `${ethers.formatEther(wei)} ETH`;
}

function titulo(codigo: string, texto: string) {
    console.log(`\n[${codigo}] ${texto}`);
}

function dato(texto: string) {
    console.log(`     ${texto}`);
}

function veredicto(vulnerable: boolean, siVulnerable: string, siBloqueado: string) {
    if (vulnerable) {
        vulnerables++;
        console.log(`     → ✘ VULNERABLE: ${siVulnerable}`);
    } else {
        bloqueados++;
        console.log(`     → ✔ BLOQUEADO: ${siBloqueado}`);
    }
}

/** Compra completa: un paso en el código viejo, dos en el corregido. */
async function comprar(entrada: any, quien: any) {
    await (await entrada.connect(quien).comprar({ value: PRECIO })).wait();
    if (tiene(entrada, "confirmarCompras")) {
        await minar();
        await (await entrada.connect(quien).confirmarCompras(10)).wait();
    }
}

/** Primer tokenId que pertenece a `duenio`. */
async function tokenDe(entrada: any, duenio: string): Promise<bigint> {
    const total = await entrada.emitidas();
    for (let id = 1n; id <= total; id++) {
        try {
            if ((await entrada.ownerOf(id)) === duenio) return id;
        } catch {
            // quemada o inexistente
        }
    }
    throw new Error(`sin entrada para ${duenio}`);
}

/** Cierre: una llamada en el código viejo, dos en el corregido. */
async function cerrar(sorteo: any) {
    let recibo = await (await sorteo.cerrar()).wait();
    if (tiene(sorteo, "bloqueSorteo")) {
        await minar();
        recibo = await (await sorteo.cerrar()).wait();
    }
    return recibo;
}

function compromiso(valor: bigint, sal: string, direccion: string) {
    return ethers.solidityPackedKeccak256(
        ["uint256", "bytes32", "address"],
        [valor, sal, direccion],
    );
}

const firmantes = await ethers.getSigners();
const [organizador, portero] = firmantes;
const otros = firmantes.slice(2);
const [alice, bob, caro, otro] = otros;

async function nuevaEntrada() {
    return (await ethers.deployContract("Entrada", [PRECIO, portero.address])) as any;
}

async function nuevoSorteo(entrada: any) {
    const sorteo: any = await ethers.deployContract("Sorteo", [
        await entrada.getAddress(),
        DEPOSITO,
    ]);
    await (await entrada.designarOperadorAutorizado(await sorteo.getAddress(), true)).wait();
    return sorteo;
}

/** Sorteo con `postulantes` revelados y la revelación ya vencida. */
async function sorteoRevelado(postulantes: any[], entradas: number) {
    const entrada = await nuevaEntrada();
    const sorteo = await nuevoSorteo(entrada);
    await (await sorteo.abrirSorteo(entradas, PLAZO, PLAZO)).wait();
    const sal = ethers.id("demo");
    for (const [i, p] of postulantes.entries()) {
        await (await sorteo.connect(p).comprometer(compromiso(BigInt(i + 1), sal, p.address), { value: DEPOSITO })).wait();
    }
    await avanzar(PLAZO + 1);
    for (const [i, p] of postulantes.entries()) {
        await (await sorteo.connect(p).revelar(BigInt(i + 1), sal)).wait();
    }
    await avanzar(PLAZO + 1);
    return { entrada, sorteo };
}

// ---------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------

const red = await ethers.provider.getNetwork();
console.log("════════════════════════════════════════════════════════════════════");
console.log(` DEMO DE ATAQUES — versión: ${process.env.DEMO_VERSION ?? "(sin etiqueta)"}`);
console.log(` Red: chain ${red.chainId} · bloque inicial ${await ethers.provider.getBlockNumber()}`);
console.log(` Fecha: ${new Date().toISOString()}`);
console.log("════════════════════════════════════════════════════════════════════");

// F1 — DoS del cierre del sorteo --------------------------------------------
{
    titulo("F1", "DoS del cierre del sorteo: ¿encarecen el cierre los postulantes extra?");
    const gas = async (n: number) => {
        const { sorteo } = await sorteoRevelado(otros.slice(0, n), 1);
        return (await cerrar(sorteo)).gasUsed as bigint;
    };
    const pocos = await gas(3);
    const muchos = await gas(18);
    dato(`gas de cerrar() con  3 postulantes y 1 entrada: ${pocos}`);
    dato(`gas de cerrar() con 18 postulantes y 1 entrada: ${muchos}`);
    dato(`diferencia: ${muchos - pocos} gas`);
    veredicto(
        muchos - pocos > 15_000n,
        "cada postulante encarece el cierre; inflando la lista se supera el límite del bloque y los depósitos quedan atrapados",
        "el costo de cerrar no depende de cuántos se postulan",
    );
}

// F2 — Reabrir el sorteo -----------------------------------------------------
{
    titulo("F2", "El organizador intenta reabrir un sorteo ya cerrado (para volver a sortear)");
    const { sorteo } = await sorteoRevelado([alice, bob], 1);
    await cerrar(sorteo);
    const r = await intentar(() => sorteo.abrirSorteo(1, PLAZO, PLAZO));
    dato(r.ok ? `abrirSorteo() aceptado; cerrado() = ${await sorteo.cerrado()}` : `abrirSorteo() revirtió: ${r.motivo}`);
    veredicto(r.ok, "el sorteo se reabre y se puede volver a sortear hasta que gane quien uno quiere", "un contrato hace un solo sorteo");
}

// F3 — Comisión cambiada a último momento -----------------------------------
{
    titulo("F3", "El organizador sube la comisión al 100% justo antes de una compra en reventa");
    const entrada = await nuevaEntrada();
    const reventa: any = await ethers.deployContract("Reventa", [await entrada.getAddress()]);
    await (await reventa.configurar(110, 10)).wait();
    await (await entrada.emitir(["A"], ["1"], [1])).wait();
    await comprar(entrada, alice);
    const id = await tokenDe(entrada, alice.address);
    await (await entrada.connect(alice).approve(await reventa.getAddress(), id)).wait();
    await (await reventa.connect(alice).listar(id, PRECIO)).wait();
    dato(`la vendedora lista a ${eth(PRECIO)} con comisión 10% (espera cobrar ${eth((PRECIO * 90n) / 100n)})`);
    await (await reventa.configurar(110, 100)).wait();
    await (await reventa.connect(bob).comprar(1n, { value: PRECIO })).wait();
    const antes = await ethers.provider.getBalance(alice.address);
    const r = await intentar(() => reventa.connect(alice).retirar());
    const cobro = r.ok ? (await ethers.provider.getBalance(alice.address)) - antes : 0n;
    dato(r.ok ? `la vendedora retiró ≈ ${eth(cobro)} (neto de gas)` : `la vendedora no tiene nada para retirar (${r.motivo})`);
    veredicto(!r.ok, "la vendedora cobró 0: el organizador se quedó con todo el pago", "la vendedora cobró lo pactado al listar");
}

// F4 — renounceOwnership ------------------------------------------------------
{
    titulo("F4", "Se llama a renounceOwnership() en Entrada con plata recaudada");
    const entrada = await nuevaEntrada();
    await (await entrada.emitir(["A"], ["1"], [1])).wait();
    await comprar(entrada, alice);
    const r = await intentar(() => entrada.renounceOwnership());
    if (r.ok) {
        const retiro = await intentar(() => entrada.retirar());
        dato(`owner() = ${await entrada.owner()}`);
        dato(`retirar(): ${retiro.ok ? "funcionó" : `revirtió (${retiro.motivo})`}`);
        dato(`saldo del contrato: ${eth(await ethers.provider.getBalance(await entrada.getAddress()))}`);
    } else {
        dato(`renounceOwnership() revirtió: ${r.motivo}`);
    }
    veredicto(r.ok, "el contrato quedó sin dueño y la recaudación atrapada para siempre", "no se puede renunciar; el organizador conserva el control");
}

// F5 — Depósito de más --------------------------------------------------------
{
    titulo("F5", "Un postulante manda el doble del depósito al sorteo");
    const entrada = await nuevaEntrada();
    const sorteo = await nuevoSorteo(entrada);
    await (await sorteo.abrirSorteo(1, PLAZO, PLAZO)).wait();
    const r = await intentar(() =>
        sorteo.connect(alice).comprometer(compromiso(1n, ethers.id("x"), alice.address), { value: 2n * DEPOSITO }),
    );
    dato(r.ok ? `aceptado: ${eth(2n * DEPOSITO)}, pero reclamar() devuelve ${eth(DEPOSITO)}` : `revirtió: ${r.motivo}`);
    veredicto(r.ok, "el excedente queda atrapado en el contrato", "se exige el depósito exacto");
}

// F6 — Inyección en la metadata ----------------------------------------------
{
    titulo("F6", "Se emite una entrada con una fila que trae JSON");
    const entrada = await nuevaEntrada();
    const fila = 'A","image":"https://sitio-falso.com/x.png';
    const r = await intentar(() => entrada.emitir([fila], ["1"], [1]));
    if (r.ok) {
        const uri: string = await entrada.tokenURI(1n);
        const json = Buffer.from(uri.split(",")[1], "base64").toString("utf-8");
        const campos = (json.match(/"image"/g) ?? []).length;
        dato(`emitida; la metadata trae ${campos} campos "image": ${json.slice(0, 90)}…`);
    } else {
        dato(`emitir() revirtió: ${r.motivo}`);
    }
    veredicto(r.ok, "quien emite puede meter campos en el JSON (o marcado en el SVG) del NFT", "fila y asiento solo aceptan letras y números");
}

// N1 — Simular y revertir -----------------------------------------------------
{
    titulo("N1", "Un contrato atacante compra y revierte hasta conseguir la entrada #3");
    const entrada = await nuevaEntrada();
    await (await entrada.emitir(["A", "B", "C"], ["1", "2", "3"], [1, 2, 3])).wait();
    const atacante: any = await ethers.deployContract("AtacanteCompra", [await entrada.getAddress()]);
    let intento = 0;
    let consiguio = false;
    while (intento < 10 && !consiguio) {
        intento++;
        const r = await intentar(() => atacante.atacar(3n, { value: PRECIO }));
        consiguio = r.ok;
        if (!r.ok) await minar();
    }
    dato(consiguio ? `consiguió la entrada #3 en el intento ${intento} (los fallidos solo le costaron gas)` : `10 intentos, ninguno le dio la entrada #3`);
    veredicto(consiguio, "el comprador elige su asiento revirtiendo las compras que no le gustan", "pagar solo reserva; el asiento sale de un bloque que todavía no existe");
}

// N2 — Sesgo del último revelador --------------------------------------------
{
    titulo("N2", "El último en revelar calcula el resultado ANTES de que cierre el sorteo");
    const { sorteo } = await sorteoRevelado([alice, bob], 1);
    // Lo que puede calcular cualquiera mirando las revelaciones públicas.
    const tras1 = ethers.solidityPackedKeccak256(["uint256", "uint256", "address"], [0n, 1n, alice.address]);
    const prediccion = ethers.solidityPackedKeccak256(["uint256", "uint256", "address"], [tras1, 2n, bob.address]);
    await cerrar(sorteo);
    const real = ethers.toBeHex(await sorteo.entropiaFinal(), 32);
    dato(`predicción (solo con lo revelado): ${prediccion.slice(0, 18)}…`);
    dato(`entropía final real:               ${real.slice(0, 18)}…`);
    veredicto(real === prediccion, "el resultado se puede calcular con lo revelado: el último decide si revela según le convenga", "el resultado depende del hash de un bloque fijado después de la revelación");
}

// R1 — Fondos atrapados en el sorteo -----------------------------------------
{
    titulo("R1", "Depósitos de ganadores y de quienes no revelan, después del cierre");
    const entrada = await nuevaEntrada();
    const sorteo = await nuevoSorteo(entrada);
    await (await sorteo.abrirSorteo(1, PLAZO, PLAZO)).wait();
    const sal = ethers.id("r1");
    for (const [i, p] of [alice, bob, caro].entries()) {
        await (await sorteo.connect(p).comprometer(compromiso(BigInt(i + 1), sal, p.address), { value: DEPOSITO })).wait();
    }
    await avanzar(PLAZO + 1);
    await (await sorteo.connect(alice).revelar(1n, sal)).wait();
    await (await sorteo.connect(bob).revelar(2n, sal)).wait(); // caro no revela
    await avanzar(PLAZO + 1);
    await cerrar(sorteo);
    await (await sorteo.connect(alice).reclamar()).wait();
    await (await sorteo.connect(bob).reclamar()).wait();
    if (tiene(sorteo, "retirar")) await (await sorteo.retirar()).wait();
    const queda = await ethers.provider.getBalance(await sorteo.getAddress());
    dato(`saldo que queda en el contrato: ${eth(queda)}${tiene(sorteo, "retirar") ? "" : " (no existe ninguna función para sacarlo)"}`);
    veredicto(queda > 0n, "esa plata no la puede retirar nadie, nunca", "el organizador retira lo que no se devuelve y no queda nada atrapado");
}

// R2 — Tope de entradas por sorteo -------------------------------------------
{
    titulo("R2", "Se abre un sorteo de 100.000 entradas (imposible de cerrar en un bloque)");
    const entrada = await nuevaEntrada();
    const sorteo = await nuevoSorteo(entrada);
    const r = await intentar(() => sorteo.abrirSorteo(100_000, PLAZO, PLAZO));
    dato(r.ok ? "aceptado" : `revirtió: ${r.motivo}`);
    veredicto(r.ok, "un sorteo así no se puede cerrar nunca si se anotan más que las entradas", "hay un tope (500) que siempre entra en un cierre");
}

// R3 — Traspaso a una dirección mal tipeada ----------------------------------
{
    titulo("R3", "El organizador transfiere el contrato a una dirección mal tipeada");
    const entrada = await nuevaEntrada();
    const tipeada = ethers.Wallet.createRandom().address; // nadie tiene su clave
    await (await entrada.transferOwnership(tipeada)).wait();
    const duenio = await entrada.owner();
    dato(`owner() después del traspaso: ${duenio === organizador.address ? "sigue siendo el organizador" : `${duenio} (la dirección tipeada)`}`);
    veredicto(duenio !== organizador.address, "el control pasó a una dirección que nadie maneja", "el traspaso espera a que el nuevo dueño lo acepte");
}

// R4 — Operador que quema una entrada ajena ----------------------------------
{
    titulo("R4", "Un operador autorizado (con un bug o malicioso) quema la entrada de alguien");
    const entrada = await nuevaEntrada();
    await (await entrada.designarOperadorAutorizado(otro.address, true)).wait();
    await (await entrada.emitir(["A"], ["1"], [1])).wait();
    await comprar(entrada, alice);
    const id = await tokenDe(entrada, alice.address);
    const r = await intentar(() => entrada.connect(otro).quemar(id));
    dato(r.ok ? `quemó la entrada #${id} de Alice sin su permiso` : `quemar() revirtió: ${r.motivo}`);
    veredicto(r.ok, "cualquier operador puede destruir entradas ajenas", "hace falta el permiso del dueño sobre esa entrada");
}

// R5 — Listado viejo que revive ----------------------------------------------
{
    titulo("R5", "La entrada se va y vuelve a la vendedora: ¿revive el listado viejo?");
    const entrada = await nuevaEntrada();
    const reventa: any = await ethers.deployContract("Reventa", [await entrada.getAddress()]);
    await (await reventa.configurar(110, 10)).wait();
    await (await entrada.emitir(["A"], ["1"], [1])).wait();
    await comprar(entrada, alice);
    const id = await tokenDe(entrada, alice.address);
    await (await entrada.connect(alice).setApprovalForAll(await reventa.getAddress(), true)).wait();
    await (await reventa.connect(alice).listar(id, PRECIO)).wait();
    await (await entrada.connect(alice).transferFrom(alice.address, caro.address, id)).wait();
    await (await entrada.connect(caro).transferFrom(caro.address, alice.address, id)).wait();
    const r = await intentar(() => reventa.connect(bob).comprar(1n, { value: PRECIO }));
    dato(r.ok ? "Bob compró por el listado viejo, al precio viejo" : `comprar() revirtió: ${r.motivo}`);
    veredicto(r.ok, "un listado olvidado se ejecuta sin que la vendedora lo haya vuelto a decidir", "si la entrada cambió de dueño, el listado viejo deja de valer");
}

// N3 — Portero que marca fuera del evento ------------------------------------
{
    titulo("N3", "El portero marca una entrada como usada el día antes del evento");
    const entrada = await nuevaEntrada();
    await (await entrada.emitir(["A"], ["1"], [1])).wait();
    await comprar(entrada, alice);
    const id = await tokenDe(entrada, alice.address);
    if (tiene(entrada, "definirVentanaIngreso")) {
        const ahora = (await ethers.provider.getBlock("latest"))!.timestamp;
        await (await entrada.definirVentanaIngreso(ahora + 86_400, ahora + 90_000)).wait();
        dato("el organizador fijó el ingreso para mañana");
    } else {
        dato("no existe forma de acotar el horario del portero");
    }
    const r = await intentar(() => entrada.connect(portero).usar(id));
    dato(r.ok ? "marcada como usada hoy: Alice no va a poder entrar mañana" : `usar() revirtió: ${r.motivo}`);
    veredicto(r.ok, "el portero (o quien robe su llave) puede marcar entradas en cualquier momento", "solo puede marcar dentro del horario del evento");
}

// N6 — Autorización de puntos que no se consume ------------------------------
{
    titulo("N6", "Después de un canje, ¿sigue vigente la autorización de puntos?");
    const entrada = await nuevaEntrada();
    const puntos: any = await ethers.deployContract("Puntos", []);
    const canje: any = await ethers.deployContract("Canje", [await entrada.getAddress(), await puntos.getAddress()]);
    await (await puntos.designarQuemador(await canje.getAddress())).wait();
    await (await puntos.designarEmisor(organizador.address)).wait();
    await (await entrada.designarOperadorAutorizado(await canje.getAddress(), true)).wait();
    await (await canje.definirCosto(1, 2, 100n)).wait();
    await (await entrada.emitir(["A"], ["1"], [1])).wait();
    await comprar(entrada, alice);
    const id = await tokenDe(entrada, alice.address);
    await (await entrada.connect(portero).usar(id)).wait();
    await (await puntos.emitir(alice.address, 500n, id)).wait();
    await (await puntos.connect(alice).approve(await canje.getAddress(), 100n)).wait();
    await (await entrada.connect(alice).approve(await canje.getAddress(), id)).wait();
    await (await canje.connect(alice).canjear(id, 2)).wait();
    const resto = await puntos.allowance(alice.address, await canje.getAddress());
    dato(`autorización aprobada: 100 · costo del canje: 100 · autorización que queda: ${resto}`);
    veredicto(resto > 0n, "el permiso dado para un canje queda vivo para los siguientes", "el canje consume la autorización");
}

console.log("\n════════════════════════════════════════════════════════════════════");
console.log(` Resumen: ${vulnerables} ataques funcionaron · ${bloqueados} bloqueados (de ${vulnerables + bloqueados})`);
console.log("════════════════════════════════════════════════════════════════════");
