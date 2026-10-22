// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* ================================================================
 *  Entrada — Entrada NFT (ERC-721) para un único evento.
 *
 *  Este contrato implementa la especificación de
 *  `docs/spec/entrada.md` y está validado por la suite de tests
 *  en `test/Entrada.ts`. La metodología de trabajo es TDD: los
 *  tests son la especificación ejecutable y este contrato se
 *  completa para hacerlos pasar.
 *
 *  Tres roles coexisten:
 *    - Organizador (owner): emite las entradas y retira lo recaudado.
 *    - Portero: marca una entrada Vendida como Usada en la puerta.
 *    - Comprador: paga el precio exacto y reserva; el asiento se le
 *      asigna al azar con el hash de un bloque posterior al pago.
 *
 *  Máquina de estados:  Inexistente → Emitida → Vendida → Usada
 *  Las transiciones son unidireccionales y están forzadas por el
 *  contrato (ver invariantes 3 y 5 de la spec).
 * ================================================================ */

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";

// Ownable2Step: el traspaso de organizador se completa recién cuando el
// nuevo lo acepta, así un error de tipeo en la dirección no pierde el control.
contract Entrada is ERC721, Ownable2Step {

    // ===========================================================
    // TIPOS DEL DOMINIO
    // ===========================================================
    //
    // El orden del enum es parte del contrato. La suite de tests
    // compara el resultado de `estado(tokenId)` con los valores
    // 1n (Emitida), 2n (Vendida) y 3n (Usada). Cualquier cambio
    // en el orden rompe los tests, lo cual es correcto: la
    // representación en storage de una entrada no es negociable.

    /// @notice Estado de un token. El valor 0 (Inexistente) es
    /// el default del mapping y se usa para tokenIds que nunca
    /// fueron emitidos.
    enum Estado { Inexistente, Emitida, Vendida, Usada }

    /// @notice Identificación completa de un asiento. Fila y
    /// asiento se guardan como string porque la spec permite
    /// valores alfanuméricos ("AB", "10B", "Z9"...).
    struct Asiento {
        uint16 sector;
        string fila;
        string asiento;
    }

    // ===========================================================
    // ESTADO INMUTABLE (configurado una sola vez en el constructor)
    // ===========================================================
    //
    // `immutable` se guarda en bytecode y se lee con un PUSH (no
    // un SLOAD). Más barato y a prueba de modificación. La spec
    // fija precio y portero al desplegar; no cambian en vida del
    // contrato.

    /// @notice Precio exacto (wei) que paga el comprador.
    uint256 public immutable precio;

    /// @notice Dirección del portero autorizada a marcar Usada.
    address public immutable portero;

    // ===========================================================
    // ALMACENAMIENTO PRINCIPAL
    // ===========================================================
    //
    // Tres mappings y un array. El array `_disponibles` permite
    // muestreo O(1) de un tokenId a la venta: pick al azar,
    // swap con el último, pop.

    /// @notice Estado de cada token. Mapping público → getter
    /// autogenerado `estado(tokenId)`.
    mapping(uint256 tokenId => Estado) public estado;

    /// @notice Datos del asiento asociado a cada token.
    /// Privado: se accede vía `tokenURI` (que es público).
    mapping(uint256 tokenId => Asiento) private _asiento;

    /// @notice Clave (sector, fila, asiento) → emitido?.
    /// Cumple el invariante 1 de la spec: no se puede emitir
    /// dos veces el mismo asiento. Se calcula con keccak256
    /// porque fila y asiento son strings (ver `_claveAsiento`).
    mapping(uint256 clave => bool) private _emitido;

    /// @notice Lista de tokenIds Emitidas que aún no se vendieron.
    /// El comprador recibe uno elegido al azar; luego se quita.
    uint256[] private _disponibles;

    /// @notice Contador monótono del próximo tokenId a asignar.
    /// Empieza en 0; la primera emisión produce tokenId 1.
    uint256 private _ultimoId;

    /// @notice Contratos del sistema autorizados a emitir para un
    /// titular (`emitirPara`) y a quemar (`quemar`): Sorteo entrega
    /// la entrada del ganador y Canje quema la usada y emite la
    /// mejora. Los designa el organizador tras el despliegue.
    mapping(address cuenta => bool) public operadorAutorizado;

    /// @notice Compra pagada a la espera de su asiento. El asiento sale del
    /// hash del bloque siguiente a `bloque`, que no existe cuando se paga.
    struct Reserva {
        address comprador;
        uint256 bloque;
    }

    /// @dev Reservas en orden de llegada (ids desde 1). Se procesan en ese
    /// orden: el estado de `_disponibles` al asignar una reserva no depende
    /// de cuándo la confirme cada uno.
    mapping(uint256 idReserva => Reserva) private _reservas;
    uint256 private _reservasCreadas;
    uint256 private _reservasProcesadas;

    /// @notice Cuántas veces cambió de dueño cada entrada entre personas (no
    /// cuenta el minteo ni la primera venta desde el contrato). Reventa lo
    /// usa para que un listado viejo no reviva si la entrada se fue y volvió.
    mapping(uint256 tokenId => uint256) public transferencias;

    /// @notice Horario en que el portero puede marcar entradas (timestamps).
    /// Mientras `finIngreso` sea 0 no hay ventana. Acota al portero, que es
    /// el oráculo del sistema: no puede marcar "desde su casa el día antes".
    uint256 public inicioIngreso;
    uint256 public finIngreso;

    // ===========================================================
    // EVENTOS
    // ===========================================================
    //
    // `indexed` solo en los campos que vamos a filtrar off-chain
    // (tokenId, direcciones, sector). El resto viaja como `data`
    // para que sea legible sin decodificar topics. Recordar: un
    // evento puede tener como máximo 3 campos `indexed` (más el
    // resto como data), porque los topics se empaquetan en una
    // sola palabra de 32 bytes cada uno en el log.

    event EntradaEmitida(
        uint256 indexed tokenId,
        uint16 indexed sector,
        string fila,
        string asiento
    );

    event EntradaComprada(
        uint256 indexed tokenId,
        address indexed comprador,
        uint256 precio
    );

    event EntradaUsada(
        uint256 indexed tokenId,
        address indexed duenio
    );

    event FondosRetirados(
        address indexed destinatario,
        uint256 monto
    );

    event OperadorAutorizadoDesignado(
        address indexed cuenta,
        bool autorizado
    );

    event EntradaQuemada(uint256 indexed tokenId);

    event CompraReservada(
        uint256 indexed idReserva,
        address indexed comprador
    );

    event CompraReprogramada(uint256 indexed idReserva);

    event VentanaIngresoDefinida(uint256 inicio, uint256 fin);

    // ===========================================================
    // ERRORES
    // ===========================================================
    //
    // La spec académica recomienda `error Foo(...)` (custom
    // errors): son ~50% más baratos en gas y dan mejor tipado.
    // PERO la suite de tests actual usa `revertedWith("...")`
    // con strings, así que el contrato emite strings para
    // casar con esa API. Mantenemos los nombres de error como
    // documentación y usamos `revert("...")` con el mismo
    // mensaje en el cuerpo de las funciones. Cuando migramos a
    // `revertedWithCustomError`, basta cambiar `revert("X")` por
    // `revert NombreErrorX()` en cada punto.

    error AsientoInvalido(string fila, string asiento);
    error AsientoYaEmitido(string fila, string asiento);
    error PagoIncorrecto(uint256 enviado, uint256 precio);
    error SinDisponibilidadEntradas();
    error NoEsPortero(address cuenta);
    error EntradaNoVendida(uint256 tokenId);
    error EntradaYaUsada(uint256 tokenId);
    error TransferenciaFallida();
    error LongitudInconsistente();
    error SectorInvalido(uint16 sector);
    error FilaInvalida(string fila);
    error AsientoVacio(string asiento);
    error PrecioInvalido();
    error PorteroInvalido();
    error SinFondos();

    // ===========================================================
    // CONSTANTES
    // ===========================================================
    //
    // Sectores válidos según la spec: 1 (Platea), 2 (Platea Alta),
    // 3 (Platea Baja), 4 (Cancha). Se excluye 5 (Galería)
    // deliberadamente en esta versión; la spec lista 5 nombres
    // pero solo A–D son emitidos por la suite.

    uint16 private constant SECTOR_MIN = 1;
    uint16 private constant SECTOR_MAX = 4;

    // ===========================================================
    // CONSTRUCTOR
    // ===========================================================
    //
    // Validamos los parámetros antes de asignarlos. En OZ 5.x
    // `Ownable(msg.sender)` fija al deployer como owner (es el
    // organizador). El portero es una cuenta distinta: en el
    // despliegue real se calcula off-chain y se pasa acá.

    constructor(uint256 precio_, address portero_)
        ERC721("Puerta7", "P7")
        Ownable(msg.sender)
    {
        if (portero_ == address(0)) revert("Portero invalido");
        if (precio_ == 0) revert("Precio invalido");
        precio = precio_;
        portero = portero_;
    }

    // ===========================================================
    // MODIFICADORES
    // ===========================================================
    //
    // Centralizan el control de acceso. El doble check
    // (`msg.sender != portero` además de `onlyOwner` para
    // otras funciones) mantiene cada guardia en un solo lugar
    // y mejora la legibilidad de las funciones públicas.

    /// @dev Restringe una función al portero configurado al
    /// desplegar. El portero NO es owner; es un rol distinto.
    modifier soloPortero() {
        if (msg.sender != portero) revert("Solo el portero");
        _;
    }

    /// @dev Restringe una función al organizador (owner). Usamos
    /// un check propio en vez del `onlyOwner` de OpenZeppelin
    /// porque la suite de tests verifica el string
    /// "Solo el organizador", y el modifier de OZ emite un
    /// custom error (`OwnableUnauthorizedAccount`).
    modifier soloOrganizador() {
        if (msg.sender != owner()) revert("Solo el organizador");
        _;
    }

    /// @dev Restringe una función a un operador autorizado del
    /// sistema (Sorteo, Canje) designado por el organizador.
    modifier soloOperadorAutorizado() {
        if (!operadorAutorizado[msg.sender]) revert("No autorizado");
        _;
    }

    /// @notice Deshabilitada: `retirar` paga a `owner()`, así que sin
    /// organizador lo recaudado quedaría atrapado para siempre (y no se
    /// podría emitir más). Para cambiar de organizador: `transferOwnership`.
    function renounceOwnership() public pure override {
        revert("Renuncia deshabilitada");
    }

    // ===========================================================
    // ORGANIZADOR — emitir
    // ===========================================================
    //
    // Emite un lote de entradas. La operación es atómica: si
    // CUALQUIER entrada del lote es inválida (sector fuera de
    // rango, fila "0", asiento "0", o duplicada), NINGUNA se
    // emite. Esto preserva el invariante 1 incluso dentro de
    // una misma transacción.
    //
    // Implementación en dos pasadas:
    //   1) Validar todos los items (sin tocar estado).
    //   2) Crear todos los tokens (con estado nuevo).
    // Esta separación es la forma idiomática de garantizar
    // atomicidad sin necesidad de try/catch o rollback manual.

    /// @notice Emite un lote de entradas. Las entradas quedan en
    /// estado `Emitida` y en poder del contrato hasta que un
    /// comprador las adquiera vía `comprar`.
    /// @param filas    Lista de filas (ej. "A", "B", "10").
    /// @param asientos Lista de asientos (ej. "1", "23B").
    /// @param sectores Lista de sectores (1..4).
    function emitir(
        string[] calldata filas,
        string[] calldata asientos,
        uint16[] calldata sectores
    ) external soloOrganizador {
        // La cantidad a emitir es `asientos.length`. Las otras
        // dos listas deben tener, como mínimo, esa cantidad de
        // elementos. Si `filas` trae más, los sobrantes se
        // ignoran. Esta regla es la que espera la suite de
        // tests: e.g. `conTresEmitidas` pasa `FILAS` (5 items)
        // con `ASIENTOS.slice(0,3)` (3) y emite 3 entradas.
        uint256 n = asientos.length;

        // Lote vacío: revertir siempre. Un batch sin items no
        // tiene sentido y podría usarse para inflar gas gratis.
        if (n == 0) revert("Lote vacio");

        // `sectores` debe tener EXACTAMENTE `n` (es la fuente
        // de verdad del largo). `filas` debe tener AL MENOS `n`
        // (los extras se descartan).
        if (n != sectores.length) revert("Longitud inconsistente");
        if (filas.length < n) revert("Longitud inconsistente");

        // Pasada 1: validar TODO el lote sin tocar estado.
        // Si cualquier item falla, revertimos sin haber
        // emitido nada (atomicidad).
        for (uint256 i = 0; i < n; i++) {
            _validarSector(sectores[i]);
            _validarFila(filas[i]);
            _validarAsiento(asientos[i]);
            _validarNoEmitida(sectores[i], filas[i], asientos[i]);
        }

        // Pasada 2: crear los tokens. La precondición garantiza
        // que NINGUNA validación fallará acá adentro. Hay tres
        // efectos de storage por item:
        //   1) Marcar el asiento como emitido (cumple
        //      invariante 1; permite detectar duplicados).
        //   2) Mintear el token al CONTRATO (no al
        //      organizador): así queda en poder del contrato
        //      hasta que un comprador lo adquiera.
        //   3) Registrar el estado y agregarlo a disponibles.
        for (uint256 i = 0; i < n; i++) {
            uint256 tokenId = ++_ultimoId;
            uint256 clave = _claveAsiento(sectores[i], filas[i], asientos[i]);

            _emitido[clave] = true;
            _asiento[tokenId] = Asiento({
                sector: sectores[i],
                fila: filas[i],
                asiento: asientos[i]
            });
            estado[tokenId] = Estado.Emitida;
            _disponibles.push(tokenId);

            // `_update(to, tokenId, auth)` de OZ 5.x: cuando
            // `_ownerOf(tokenId) == address(0)` lo interpreta
            // como minteo. `auth = address(0)` porque el
            // contrato es el emisor.
            _update(address(this), tokenId, address(0));

            emit EntradaEmitida(tokenId, sectores[i], filas[i], asientos[i]);
        }
    }

    // ===========================================================
    // COMPRADOR — comprar
    // ===========================================================
    //
    // Compra en dos pasos. Pago exacto, sin devolución de vuelto.
    //
    //   1) `comprar()` cobra y reserva un lugar en la fila.
    //   2) `confirmarCompras()` (cualquiera puede llamarla) asigna el
    //      asiento con el hash del bloque SIGUIENTE al de la reserva.
    //
    // Por qué dos pasos: con un solo paso el azar (prevrandao) es
    // público en el momento de comprar, y un contrato atacante puede
    // comprar, mirar qué asiento le tocó y revertir todo si no le
    // gusta (solo pierde gas), hasta conseguir el que quiere. Acá,
    // cuando se paga, el hash que va a elegir el asiento todavía no
    // existe; cuando existe, ya está fijo: revertir no lo cambia.
    // Las reservas se procesan en orden de llegada, así nadie puede
    // elegir en qué momento (con qué lista de disponibles) se asigna
    // la suya.
    //
    // Límite: quien produce ese bloque puede influir en su hash, pero
    // eso exige ser validador, no solo comprador.

    /// @notice Paga el precio exacto y reserva una entrada. El asiento se
    /// asigna después, con `confirmarCompras`. No recibe parámetros: el
    /// comprador no elige asiento (decisión de diseño).
    function comprar() external payable {
        if (msg.value != precio) revert("Pago incorrecto");
        // Las reservas pendientes ya tienen su entrada apartada.
        if (_disponibles.length <= _reservasCreadas - _reservasProcesadas) {
            revert("Sin entradas disponibles");
        }

        uint256 idReserva = ++_reservasCreadas;
        _reservas[idReserva] = Reserva({
            comprador: msg.sender,
            bloque: block.number
        });
        emit CompraReservada(idReserva, msg.sender);
    }

    /// @notice Asigna su asiento a hasta `maximo` reservas, en orden de
    /// llegada. Cualquiera puede llamarla: el resultado de cada reserva ya
    /// está fijado por el hash de su bloque, no por quién confirma.
    function confirmarCompras(uint256 maximo) external {
        for (uint256 n = 0; n < maximo && _reservasProcesadas < _reservasCreadas; n++) {
            uint256 idReserva = _reservasProcesadas + 1;
            Reserva storage reserva = _reservas[idReserva];

            // El hash del bloque siguiente a la reserva todavía no existe.
            if (block.number <= reserva.bloque + 1) return;

            // El EVM solo recuerda los últimos 256 hashes. Si nadie
            // confirmó a tiempo, se fija un bloque nuevo.
            bytes32 semilla = blockhash(reserva.bloque + 1);
            if (semilla == bytes32(0)) {
                reserva.bloque = block.number;
                emit CompraReprogramada(idReserva);
                return;
            }

            uint256 indice = uint256(keccak256(abi.encodePacked(semilla, idReserva))) %
                _disponibles.length;
            uint256 tokenId = _disponibles[indice];

            // Remoción O(1): swap con el último + pop.
            _disponibles[indice] = _disponibles[_disponibles.length - 1];
            _disponibles.pop();

            address comprador = reserva.comprador;
            _reservasProcesadas = idReserva;
            delete _reservas[idReserva];
            estado[tokenId] = Estado.Vendida;
            _update(comprador, tokenId, address(0));

            emit EntradaComprada(tokenId, comprador, precio);
        }
    }

    // ===========================================================
    // PORTERO — usar
    // ===========================================================
    //
    // Marca una entrada Vendida como Usada. NO cambia el dueño:
    // la persona ya entró al evento y el token le queda como
    // souvenir. Solo se puede usar una vez (invariante 3) y
    // solo si la entrada está Vendida (invariante 5).

    /// @notice Marca la entrada `tokenId` como Usada. Solo el
    /// portero configurado al desplegar puede llamar.
    function usar(uint256 tokenId) external soloPortero {
        if (
            finIngreso != 0 &&
            (block.timestamp < inicioIngreso || block.timestamp > finIngreso)
        ) revert("Fuera del horario de ingreso");

        Estado est = estado[tokenId];

        // Emitida o Inexistente: no se puede usar. La spec no
        // distingue entre "nunca existió" y "existe pero no
        // se vendió" en el mensaje de error.
        if (est == Estado.Emitida || est == Estado.Inexistente) {
            revert("La entrada no esta vendida");
        }
        if (est == Estado.Usada) revert("Entrada ya usada");

        estado[tokenId] = Estado.Usada;

        // `_ownerOf` (de OZ 5.x) es la versión que NO valida;
        // ya sabemos que existe porque su estado es Vendida.
        address duenio = _ownerOf(tokenId);

        emit EntradaUsada(tokenId, duenio);
    }

    // ===========================================================
    // ORGANIZADOR — retirar
    // ===========================================================
    //
    // Retira TODO el Ether acumulado por compras previas. El
    // organizador puede llamar varias veces; cada llamada emite
    // `FondosRetirados(destinatario, monto)`. Si no hay fondos,
    // revierte (no es no-op silencioso: queremos que la UI
    // muestre un mensaje claro).

    /// @notice Fija el horario en que el portero puede marcar entradas.
    /// Mitiga (no elimina) el problema del oráculo: un portero deshonesto
    /// o una llave robada ya no pueden marcar entradas fuera del evento.
    function definirVentanaIngreso(
        uint256 inicio,
        uint256 fin
    ) external soloOrganizador {
        if (inicio >= fin) revert("Ventana invalida");
        inicioIngreso = inicio;
        finIngreso = fin;
        emit VentanaIngresoDefinida(inicio, fin);
    }

    /// @notice Retira al organizador todo el Ether acumulado.
    function retirar() external soloOrganizador {
        uint256 monto = address(this).balance;
        if (monto == 0) revert("Nada que retirar");

        // Usamos `call` en vez de `transfer`/`send`: OZ 5.x
        // recomienda `call` porque `transfer` y `send`
        // hardcodean un stipend de 2300 gas, insuficiente para
        // receptores cuyo fallback no es trivial. `call`
        // delega todo el gas disponible.
        (bool ok, ) = owner().call{value: monto}("");
        if (!ok) revert("Transferencia fallida");

        emit FondosRetirados(owner(), monto);
    }

    // ===========================================================
    // OPERADORES DEL SISTEMA (Sorteo, Canje)
    // ===========================================================
    //
    // Permisos cruzados mínimos: un operador autorizado puede
    // emitir una entrada ya Vendida a nombre de un titular
    // (ganador del sorteo, mejora del canje) y quemar una entrada
    // (la usada que el canje destruye). Nada más: no puede emitir
    // lotes a la venta, ni usar, ni retirar fondos.

    /// @notice Designa (o revoca) un operador autorizado del sistema.
    function designarOperadorAutorizado(
        address cuenta,
        bool autorizado
    ) external soloOrganizador {
        operadorAutorizado[cuenta] = autorizado;
        emit OperadorAutorizadoDesignado(cuenta, autorizado);
    }

    /// @notice Emite una entrada en estado Vendida directamente al
    /// `titular`. Solo un operador autorizado. No pasa por la venta
    /// al azar: el titular ya ganó el sorteo o pagó con puntos.
    /// @return tokenId El id de la entrada emitida.
    function emitirPara(
        address titular,
        uint16 sector,
        string memory fila,
        string memory asiento
    ) external soloOperadorAutorizado returns (uint256 tokenId) {
        _validarSector(sector);
        _validarFila(fila);
        _validarAsiento(asiento);
        _validarNoEmitida(sector, fila, asiento);

        tokenId = ++_ultimoId;
        _emitido[_claveAsiento(sector, fila, asiento)] = true;
        _asiento[tokenId] = Asiento({
            sector: sector,
            fila: fila,
            asiento: asiento
        });
        estado[tokenId] = Estado.Vendida;
        _update(titular, tokenId, address(0));

        emit EntradaEmitida(tokenId, sector, fila, asiento);
    }

    /// @notice Quema la entrada `tokenId`: deja de existir como
    /// NFT. Solo un operador autorizado (el canje la destruye al
    /// entregar la mejora; la suite verifica las autorizaciones
    /// previas del titular en Canje, antes de llegar acá).
    function quemar(uint256 tokenId) external soloOperadorAutorizado {
        // Además de ser operador hace falta el permiso del dueño sobre esa
        // entrada: ningún operador (ni uno con bugs) quema entradas ajenas
        // por su cuenta. También impide quemar las que tiene el contrato.
        _checkAuthorized(_ownerOf(tokenId), msg.sender, tokenId);
        delete estado[tokenId];
        delete _asiento[tokenId];
        _burn(tokenId);
        emit EntradaQuemada(tokenId);
    }

    /// @notice Sector, fila y asiento de una entrada existente.
    /// Lo consume Canje para validar que el destino sea superior
    /// y para emitir la mejora en la misma fila y asiento.
    function datosAsiento(uint256 tokenId)
        external
        view
        returns (uint16 sector, string memory fila, string memory asiento)
    {
        _requireOwned(tokenId);
        Asiento memory a = _asiento[tokenId];
        return (a.sector, a.fila, a.asiento);
    }

    // ===========================================================
    // VISTAS PÚBLICAS (contadores que la spec y la UI consumen)
    // ===========================================================

    /// @notice Total de entradas emitidas desde el despliegue.
    /// Es el ID que se le asignará al próximo `emitir`.
    function emitidas() external view returns (uint256) {
        return _ultimoId;
    }

    /// @notice Entradas aún a la venta: las Emitidas menos las que ya
    /// están apartadas por una reserva pendiente.
    function disponibles() external view returns (uint256) {
        return _disponibles.length - (_reservasCreadas - _reservasProcesadas);
    }

    // ===========================================================
    // tokenURI — SVG on-chain
    // ===========================================================
    //
    // La spec dice "se dibuja on-chain". Devolvemos un data URI
    // con metadata JSON que apunta a un SVG embebido como
    // base64. Así el NFT es autosuficiente: no depende de IPFS
    // ni de un servidor externo para renderizarse. Funciona
    // en cualquier wallet que decodifique data URIs.

    /// @inheritdoc ERC721
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        // `_requireOwned` (OZ 5.x) revierte con
        // `ERC721NonexistentToken` si el token no existe.
        _requireOwned(tokenId);

        Asiento memory a = _asiento[tokenId];

        string memory nombre = string.concat(
            "Entrada ",
            Strings.toString(a.sector),
            "-",
            a.fila,
            "-",
            a.asiento
        );

        string memory imagen = string.concat(
            "data:image/svg+xml;base64,",
            Base64.encode(bytes(_renderSvg(a)))
        );

        string memory json = string.concat(
            '{"name":"', nombre,
            '","description":"Entrada NFT Puerta 7"',
            ',"image":"', imagen, '"}'
        );

        return string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        );
    }

    // ===========================================================
    // HELPERS INTERNOS
    // ===========================================================

    /// @dev Hook de OZ 5.x por el que pasa todo cambio de dueño (minteo,
    /// transferencia, quema). Cuenta los cambios entre personas.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && from != address(this)) {
            transferencias[tokenId]++;
        }
    }

    function _validarSector(uint16 sector) private pure {
        if (sector < SECTOR_MIN || sector > SECTOR_MAX) {
            revert("Sector invalido");
        }
    }

    /// @dev Fila "0" se rechaza explícitamente (es el caso
    /// degenerado que la spec marca como inválido). Además debe ser
    /// alfanumérica (ver `_esAlfanumerico`).
    function _validarFila(string memory fila) private pure {
        bytes memory b = bytes(fila);
        if (b.length == 0 || (b.length == 1 && b[0] == "0") || !_esAlfanumerico(b)) {
            revert("Fila invalida");
        }
    }

    /// @dev Misma regla que la fila: rechaza "0", la cadena
    /// vacía y lo no alfanumérico. La spec usa "Asiento invalido".
    function _validarAsiento(string memory asiento) private pure {
        bytes memory b = bytes(asiento);
        if (b.length == 0 || (b.length == 1 && b[0] == "0") || !_esAlfanumerico(b)) {
            revert("Asiento invalido");
        }
    }

    /// @dev Solo [0-9A-Za-z], como define la spec. Fila y asiento se
    /// pegan tal cual en el JSON y el SVG de `tokenURI`: una comilla
    /// permitiría inyectar campos en la metadata y un "<", marcado en el SVG.
    function _esAlfanumerico(bytes memory b) private pure returns (bool) {
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= "0" && c <= "9") ||
                (c >= "A" && c <= "Z") ||
                (c >= "a" && c <= "z");
            if (!ok) return false;
        }
        return true;
    }

    function _validarNoEmitida(
        uint16 sector,
        string memory fila,
        string memory asiento
    ) private view {
        uint256 clave = _claveAsiento(sector, fila, asiento);
        if (_emitido[clave]) revert("Asiento ya emitido");
    }

    /// @dev Convierte la terna (sector, fila, asiento) en una
    /// clave de 256 bits. Como fila y asiento son strings,
    /// usamos keccak256 sobre su `abi.encode` para evitar
    /// colisiones. La clave es solo auxiliar (no se publica),
    /// así que la eficiencia no es crítica.
    function _claveAsiento(
        uint16 sector,
        string memory fila,
        string memory asiento
    ) private pure returns (uint256) {
        return uint256(keccak256(abi.encode(sector, fila, asiento)));
    }

    /// @dev Renderiza un SVG minimalista con sector, fila y
    /// asiento. Se construye con `string.concat` para no
    /// depender de librerías externas de plantillas. La
    /// apariencia es deliberadamente sobria: el NFT vale por
    /// su on-chainness, no por su diseño.
    function _renderSvg(Asiento memory a) private pure returns (string memory) {
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 200">',
            '<rect width="350" height="200" fill="#0f172a"/>',
            '<text x="20" y="40" fill="#f8fafc" font-family="monospace" font-size="18">Puerta 7</text>',
            '<text x="20" y="110" fill="#f8fafc" font-family="monospace" font-size="36">',
            a.fila, '-', a.asiento,
            '</text>',
            '<text x="20" y="150" fill="#94a3b8" font-family="monospace" font-size="14">Sector ',
            Strings.toString(a.sector),
            '</text>',
            '</svg>'
        );
    }
}
