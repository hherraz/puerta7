# Spec · Reventa.sol

Sesión 4. Mercado secundario con techo de precio y comisión.

## Contexto

Prohibir la reventa no funciona: se hace igual, por fuera, sin garantías para el comprador. La apuesta de Puerta 7 es permitirla con dos condiciones. Un techo sobre el precio de lista, y una comisión que vuelve al organizador.

Es el contrato que cierra el sistema y el que deja la lección más incómoda del módulo.

## Actores

**Vendedor.** Titular de una entrada no usada. La lista a un precio y puede cancelar mientras no se venda.

**Comprador.** Paga el precio publicado y recibe la entrada.

**Organizador.** Define el techo y el porcentaje de comisión. Retira lo acumulado.

## Estados de un listado

| Estado | Cómo se llega | Qué permite |
|---|---|---|
| Activo | El titular lista la entrada | Comprar, cancelar |
| Vendido | Alguien pagó el precio | Nada |
| Cancelado | El vendedor lo retiró | Nada |

Un listado también deja de ser válido si la entrada se marca como usada mientras estaba publicada.

## Funciones públicas

`configurar(techoPorcentaje, comisionPorcentaje)`. Solo organizador.

`listar(tokenId, precio)`. Titular de la entrada. Requiere autorización previa sobre el token.

`comprar(idListado)` pagable. Cualquiera.

`cancelar(idListado)`. Solo el vendedor.

`retirar()`. Vendedor, comprador con vuelto pendiente, u organizador. Patrón pull.

## Reglas de precio

El techo se expresa como porcentaje sobre el precio original de la entrada. Un techo de 110 significa que no se puede listar sobre el diez por ciento de recargo.

La comisión se descuenta del pago y queda para el organizador. El resto va al vendedor, y no se le transfiere en la misma llamada: queda disponible para retiro.

## Invariantes

Nunca debe pasar que:

1. Se liste una entrada que ya fue usada.
2. Se liste una entrada que el vendedor no posee.
3. Se acepte un precio por sobre el techo configurado.
4. Un listado cancelado o vendido se pueda comprar.
5. El comprador pague y no reciba la entrada en la misma transacción.
6. El vendedor reciba el total sin que se descuente la comisión.
7. Una reentrada en `comprar` permita adquirir la misma entrada dos veces, o retirar fondos de más.
8. Queden fondos atrapados sin que nadie pueda retirarlos.

## Eventos

`Configurado(techoPorcentaje, comisionPorcentaje)`
`Listado(idListado, tokenId, vendedor, precio)`
`Comprado(idListado, comprador, precio, comision)`
`Cancelado(idListado)`
`Retirado(direccion, monto)`

## Errores

`EntradaUsada`, `NoEsTitular`, `PrecioSobreTecho`, `ListadoInactivo`, `NoEsVendedor`, `PagoIncorrecto`, `SinFondosParaRetirar`, `AutorizacionInsuficiente`.

## Fuera de alcance

Subastas y ofertas por debajo del precio de lista.

Listados con vencimiento automático.

Reventa de entradas ya usadas con fines de coleccionismo.

## [SOLO INSTRUCTOR]

### Los tres ataques del bloque

**Reentrancy.** La IA va a escribir `comprar` transfiriendo al vendedor antes de marcar el listado como vendido, o antes de transferir el NFT. Un vendedor con `receive()` malicioso vuelve a entrar y compra de nuevo.

El arreglo es checks-effects-interactions más pago por retiro. Conecta con el DAO hack: 2016, sesenta millones de dólares, y el fork que partió Ethereum en dos cadenas que existen hasta hoy.

**Approve infinito.** Para listar hay que autorizar al mercado sobre el token. La IA propone `setApprovalForAll` porque es cómodo.

Pregunta qué pasa si el mercado tiene un bug seis meses después. El usuario ya entregó permiso sobre toda su colección y ese permiso sigue vivo. Acá recoges lo que quedó anotado en la sesión 3.

**Front-running.** Alguien ve la compra en el mempool y manda la suya con más gas. No tiene arreglo limpio a este nivel. Nombra MEV, no entres en profundidad, y deja claro que es un problema de infraestructura y no de este contrato.

### El hueco deliberado, que es el remate del módulo

La spec dice que el techo de precio limita la reventa. En el paso 2 los alumnos van a dar eso por hecho.

Pregunta en el bloque de ataque si el techo se puede burlar.

Se puede, y de la forma más simple posible. Te vendo la entrada a precio de lista on-chain, y tú me transfieres la diferencia por transferencia bancaria, en efectivo, o por cualquier medio que el contrato no ve.

No hay nada en Solidity que lo impida. Ni en ningún otro lenguaje de contratos. El contrato solo observa lo que ocurre dentro de la cadena.

### Cómo cerrarlo

Que alguien intente proponer una solución. Van a aparecer ideas: obligar a que el comprador sea el usuario final, exigir identidad, vincular la entrada a una persona.

Todas trasladan el problema a un oráculo, que es exactamente lo que discutieron en la sesión 3 con el portero.

La conclusión no es derrotista. El contrato no puede hacer cumplir la regla, pero sí puede dejar rastro público de cada reventa, encarecer el fraude, y dar al organizador datos que hoy no tiene. Eso ya es más de lo que existe.

Es la conversación más adulta del módulo y es la razón por la que este proyecto vale más que un tutorial. Déjale sus diez minutos.
