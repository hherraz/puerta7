# Spec · Canje.sol

Sesión 3. Quema de puntos y entrada usada a cambio de una mejora.

## Contexto

El titular que acumuló puntos puede gastarlos. El canje toma puntos más una entrada ya usada, destruye ambos, y entrega una entrada de sector superior para el evento siguiente.

Es el primer contrato del proyecto que coordina otros dos. Ahí está su valor pedagógico: quemar algo que vive en otro contrato obliga a pensar en permisos cruzados.

## Actores

**Organizador.** Define la tabla de costos: cuántos puntos cuesta subir de cada sector al siguiente.

**Titular.** Entrega puntos y una entrada usada, recibe una entrada mejorada.

**Puntos.sol.** El canje debe estar designado como quemador.

**Entrada.sol.** El canje debe poder quemar la entrada usada y emitir la nueva.

## Flujo

1. El titular autoriza al canje a gastar sus puntos.
2. El titular autoriza al canje a mover su entrada usada.
3. Llama a `canjear(tokenId, sectorDestino)`.
4. El contrato verifica que la entrada esté usada, que pertenezca al titular, y que el sector destino sea superior al actual.
5. Quema los puntos según la tabla de costos.
6. Quema la entrada usada.
7. Emite una entrada nueva en el sector destino para el evento siguiente.

## Funciones públicas

`definirCosto(sectorOrigen, sectorDestino, costoPuntos)`. Solo organizador.

`canjear(tokenId, sectorDestino)`. Titular de la entrada.

`consultarCosto(sectorOrigen, sectorDestino)`. Lectura.

## Invariantes

Nunca debe pasar que:

1. Se canjee una entrada que no esté en estado usada.
2. Alguien canjee una entrada que no le pertenece.
3. Se canjee la misma entrada dos veces.
4. El canje se complete sin quemar los puntos correspondientes.
5. Se entregue una entrada de sector inferior o igual al original.
6. Se emita la entrada nueva si el aforo del sector destino está completo.
7. Queden puntos quemados sin que se haya entregado la mejora.

El invariante 7 es el que obliga a pensar el orden de las operaciones. Si la emisión falla después de quemar, el titular perdió los puntos y no recibió nada.

## Eventos

`CostoDefinido(sectorOrigen, sectorDestino, costoPuntos)`
`Canjeado(titular, tokenIdQuemado, tokenIdNuevo, puntosGastados)`

## Errores

`EntradaNoUsada`, `NoEsTitular`, `SectorNoSuperior`, `CostoNoDefinido`, `PuntosInsuficientes`, `AforoDestinoCompleto`, `AutorizacionInsuficiente`.

## Fuera de alcance

Canjes parciales o reembolsos.

Mejoras que no sean cambio de sector, como estacionamiento o acceso anticipado.

Canje entre titulares distintos.

## Cambios tras la revisión de seguridad (octubre 2026)

- **El canje consume la autorización de puntos**: los mueve con `transferFrom` (que descuenta el allowance) y los quema desde el canje. Antes verificaba el allowance pero nunca lo descontaba, así que un approve valía para todos los canjes futuros.
- `Entrada.quemar` ahora exige además el permiso del titular sobre la entrada (el paso 2 del flujo ya lo daba).
- El traspaso de organizador es en dos pasos (`transferOwnership` + `acceptOwnership`).

## [SOLO INSTRUCTOR]

### El hueco deliberado

La spec dice que se quema la entrada usada. No dice qué pasa si la emisión de la nueva falla a mitad de camino.

En Ethereum una transacción revierte entera, así que el caso parece resuelto solo. Y lo está, mientras todo ocurra en una sola transacción. El punto es que lo razonen y lo digan, no que lo descubran roto.

La pregunta que abre la discusión: ¿qué pasaría si el canje se hiciera en dos transacciones, una para quemar y otra para emitir? Ahí sí se pierde la atomicidad y aparece el riesgo. Sirve para explicar por qué conviene que una operación de negocio sea una transacción.

### El otro hueco, más sutil

El flujo exige dos autorizaciones previas: una sobre los puntos y otra sobre la entrada. La IA va a proponer `approve` por el máximo posible en ambas, porque es lo cómodo.

No lo corrijas en el paso 3. Déjalo para el bloque de ataque de la sesión 4, donde el approve infinito aparece otra vez en el mercado de reventa y pega más fuerte. Acá solo anótalo.

### Permisos cruzados

Este contrato necesita ser quemador en `Puntos.sol` y tener permiso de quema y emisión en `Entrada.sol`. Son tres designaciones que el organizador tiene que hacer después de desplegar.

Pregunta qué pasa si el organizador se olvida de una. El canje falla en producción con un error poco claro, y nadie lo nota hasta que el primer titular lo intenta.

De ahí sale el argumento para que el script de despliegue haga las designaciones y los tests las verifiquen. Buen momento para mostrar que el despliegue también es código que se prueba.
