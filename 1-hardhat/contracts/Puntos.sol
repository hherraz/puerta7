// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* ================================================================
 *  Puntos — Token fungible (ERC-20) que premia la asistencia.
 *
 *  Implementa `docs/spec/puntos.md` y está validado por
 *  `test/Puntos.ts`. Se usa el ERC-20 de OpenZeppelin sin
 *  reimplementar nada del estándar (decisión de la spec).
 *
 *  Roles:
 *    - Organizador (owner): designa emisor y quemador.
 *    - Emisor autorizado: único que puede crear puntos.
 *    - Quemador autorizado: único que puede destruir puntos ajenos.
 * ================================================================ */

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract Puntos is ERC20, Ownable {
    /// @notice Único autorizado a emitir (en el sistema, Entrada).
    address public emisor;

    /// @notice Único autorizado a quemar (en el sistema, Canje).
    address public quemador;

    /// @notice tokenId de entrada ya premiado (invariante 3: no se
    /// emiten puntos dos veces por la misma asistencia).
    mapping(uint256 tokenIdEntrada => bool) private _premiada;

    event PuntosEmitidos(
        address indexed titular,
        uint256 cantidad,
        uint256 indexed tokenIdEntrada
    );
    event PuntosQuemados(address indexed titular, uint256 cantidad);
    event EmisorDesignado(address indexed direccion);
    event QuemadorDesignado(address indexed direccion);

    error NoEsEmisor();
    error NoEsQuemador();
    error NoEsOrganizador();
    error AsistenciaYaPremiada();
    error SaldoInsuficiente();

    constructor() ERC20("Puntos Puerta 7", "PTOS7") Ownable(msg.sender) {}

    /// @dev Check propio en vez de `onlyOwner` de OZ porque la suite
    /// verifica el custom error `NoEsOrganizador` de la spec.
    modifier soloOrganizador() {
        if (msg.sender != owner()) revert NoEsOrganizador();
        _;
    }

    function designarEmisor(address direccion) external soloOrganizador {
        emisor = direccion;
        emit EmisorDesignado(direccion);
    }

    function designarQuemador(address direccion) external soloOrganizador {
        quemador = direccion;
        emit QuemadorDesignado(direccion);
    }

    /// @notice Crea `cantidad` puntos para `titular` por la asistencia
    /// registrada en la entrada `tokenIdEntrada`. Solo el emisor.
    function emitir(
        address titular,
        uint256 cantidad,
        uint256 tokenIdEntrada
    ) external {
        if (msg.sender != emisor) revert NoEsEmisor();
        if (_premiada[tokenIdEntrada]) revert AsistenciaYaPremiada();
        _premiada[tokenIdEntrada] = true;
        _mint(titular, cantidad);
        emit PuntosEmitidos(titular, cantidad, tokenIdEntrada);
    }

    /// @notice Destruye `cantidad` puntos de `titular`. Solo el quemador.
    function quemar(address titular, uint256 cantidad) external {
        if (msg.sender != quemador) revert NoEsQuemador();
        if (balanceOf(titular) < cantidad) revert SaldoInsuficiente();
        _burn(titular, cantidad);
        emit PuntosQuemados(titular, cantidad);
    }
}
