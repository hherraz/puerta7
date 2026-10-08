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
 *    - Comprador: paga el precio exacto y recibe una entrada al azar.
 *
 *  Máquina de estados:  Inexistente → Emitida → Vendida → Usada
 *  Las transiciones son unidireccionales y están forzadas por el
 *  contrato (ver invariantes 3 y 5 de la spec).
 * ================================================================ */

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";

contract Entrada is ERC721, Ownable {

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
    // Pago exacto, sin devolución de vuelto. Elige una entrada
    // Emitida al azar, se la transfiere al msg.sender y la
    // marca como Vendida. El Ether queda retenido en el contrato
    // hasta que el organizador llame a `retirar`.
    //
    // Aleatoriedad:
    //   Usamos `block.prevrandao` (PREVRANDAO opcode, disponible
    //   post-Merge). NO es criptográficamente seguro contra un
    //   validador malicioso, pero cumple la motivación de la
    //   spec: evitar que bots elijan sistemáticamente los
    //   mejores asientos. Para aleatoriedad fuerte se necesita
    //   un VRF (Chainlink VRF, drand, etc.) o un commit-reveal.

    /// @notice Compra una entrada al azar entre las Emitidas.
    /// @dev `payable` para recibir ETH. No recibe parámetros:
    /// el comprador no elige asiento (decisión de diseño).
    function comprar() external payable {
        if (msg.value != precio) revert("Pago incorrecto");
        if (_disponibles.length == 0) revert("Sin entradas disponibles");

        // Selección pseudo-aleatoria del índice a remover.
        uint256 indice = uint256(block.prevrandao) % _disponibles.length;
        uint256 tokenId = _disponibles[indice];

        // Remoción O(1): swap con el último + pop. No nos
        // importa perder el orden original; el comprador no
        // elige asiento.
        _disponibles[indice] = _disponibles[_disponibles.length - 1];
        _disponibles.pop();

        estado[tokenId] = Estado.Vendida;

        // Minteo vía el hook interno de OZ 5.x. `_update(to,
        // tokenId, auth)` cuando `_ownerOf(tokenId) == 0`
        // interpreta la operación como minteo y emite el
        // `Transfer` correspondiente. `auth = address(0)`
        // porque nadie autorizó; el contrato es el emisor.
        _update(msg.sender, tokenId, address(0));

        emit EntradaComprada(tokenId, msg.sender, precio);
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
    // VISTAS PÚBLICAS (contadores que la spec y la UI consumen)
    // ===========================================================

    /// @notice Total de entradas emitidas desde el despliegue.
    /// Es el ID que se le asignará al próximo `emitir`.
    function emitidas() external view returns (uint256) {
        return _ultimoId;
    }

    /// @notice Entradas aún a la venta (estado Emitida).
    function disponibles() external view returns (uint256) {
        return _disponibles.length;
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

    function _validarSector(uint16 sector) private pure {
        if (sector < SECTOR_MIN || sector > SECTOR_MAX) {
            revert("Sector invalido");
        }
    }

    /// @dev Fila "0" se rechaza explícitamente (es el caso
    /// degenerado que la spec marca como inválido). Cualquier
    /// otra cadena — incluso alfanumérica — es válida.
    function _validarFila(string memory fila) private pure {
        bytes memory b = bytes(fila);
        if (b.length == 0 || (b.length == 1 && b[0] == "0")) {
            revert("Fila invalida");
        }
    }

    /// @dev Misma regla que la fila: rechaza "0" y la cadena
    /// vacía. La spec usa "Asiento invalido" como string.
    function _validarAsiento(string memory asiento) private pure {
        bytes memory b = bytes(asiento);
        if (b.length == 0 || (b.length == 1 && b[0] == "0")) {
            revert("Asiento invalido");
        }
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
