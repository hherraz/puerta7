# Spec Entrada

Entrada NFT (ERC-721) para un único evento. Cada entrada representa un asiento concreto del recinto y se dibujo on-chain.

## Actores

- **Organizador**: despliega el contrato, emite las entradas, fija el precio y el retira lo recauda.
- **Comprador**: paga el precio y recibe una o mas entradas.
- **Portero**: marca una entrada como utilizada, cuando la persona entre.

## Recinto

- Sectores Platea, Platea Alta, Platea Baja, Cancha y Galeria.
- Cada asiento se identifica por (sector, fila, asiento). Fila y asiento pueden ser alfa numericas.
- Cancha se vende por capacidad total.

## Estados de una entrada

| Estado   |  Significado                                  |  Dueño del token |
|----------|-----------------------------------------------| ---------------- |
| Emitida  | Creada por el organizador, todavia a la venta | El contrato      |
| Vendida  | Comprador paga el precio y se la adjudica     | El comprador     |
| Usada    | Portero valida la entrada en la puerta        | El comprador     |

Transacciones: Emitida -> Vendida (compra), Vendida -> Usada (portero).
No hay otras.

## Asignación del asiento

El comprador **no elige** el asiento. Al comprar, recibe una entrada al azar entre las que siguen a la venta. Decision de diseño: evitar que los revendedores compren en bloque los mejores asientos.

## Invariantes (lo que no debe pasar nunca)

1. Un asiento no se puede emitir dos veces para el mismo evento.
2. Nadie salvo el organizador puede emitir entradas.
3. Una entrada usada no se puede volver a usar.
4. Solo el portero puede marcar una entrada como usada.
5. Solo se puede usar una entrada vendida (una emitida sin vender, no).
6. Nadie recibe una entrada sin pagar exactamente el precio.
7. Solo el organizador puede retirar lo recaudado.

## Decisiones tras los `TODO: AMBIGUO` de la primera vuelta de tests

- **Pago de más**: se rechaza. El precio es exacto; así no hay que devolver vuelto.
- **Sin entradas disponibles**: la compra se rechaza.
- **Sector inválido** (fuera de A–D) o fila/asiento 0: la emisión se rechaza.
- **Transferir una entrada vendida o usada**: se permite (es un ERC-721 normal;
la reventa con techo llega en la sesión 4).
- **Una sola compra por dirección**: no se limita en esta versión.
- **Cambiar de portero**: no se contempla; se fija al desplegar.
- **Precio**: se fija al desplegar y no cambia