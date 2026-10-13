# Spec · Puntos.sol

Sesión 3. Token fungible que premia la asistencia.

## Contexto

El organizador quiere premiar a quien realmente va al evento, no a quien compra y revende. Cada asistencia confirmada entrega puntos. Los puntos sirven para canjear mejoras en eventos siguientes.

Es un ERC-20 común. Lo interesante no es el token sino quién tiene permiso para emitirlo y en qué condiciones, porque de ahí sale la conversación sobre el oráculo.

## Actores

**Organizador.** Despliega el token y designa qué contrato puede emitir.

**Entrada.sol.** Único emisor autorizado. Emite puntos cuando una entrada se marca como usada.

**Canje.sol.** Único quemador autorizado. Destruye puntos al entregar una mejora.

**Titular.** Acumula puntos, los transfiere libremente y los gasta en canjes.

## Decisiones tomadas

Se usa el ERC-20 de OpenZeppelin. No se reimplementa nada del estándar.

Dieciocho decimales, como el default. Los puntos son divisibles aunque se emitan en enteros, porque pelear contra el default del ecosistema trae más problemas que beneficios.

Los puntos son transferibles. Alguien puede venderlos o regalarlos. Es una decisión, no un descuido, y hay que poder defenderla.

## Funciones públicas

`emitir(direccion, cantidad)`. Solo el emisor autorizado.

`quemar(direccion, cantidad)`. Solo el quemador autorizado.

`designarEmisor(direccion)` y `designarQuemador(direccion)`. Solo organizador.

El resto es el ERC-20 estándar: `transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`.

## Invariantes

Nunca debe pasar que:

1. Una dirección distinta del emisor autorizado cree puntos.
2. Una dirección distinta del quemador autorizado destruya puntos de otro.
3. Se emitan puntos dos veces por la misma asistencia.
4. El total emitido menos el total quemado difiera de la suma de todos los saldos.
5. Una transferencia deje al remitente con saldo negativo.
6. `transferFrom` mueva más de lo autorizado, o no descuente lo autorizado.

## Eventos

`PuntosEmitidos(titular, cantidad, tokenIdEntrada)`
`PuntosQuemados(titular, cantidad)`
`EmisorDesignado(direccion)` y `QuemadorDesignado(direccion)`

Más los eventos `Transfer` y `Approval` del estándar.

## Errores

`NoEsEmisor`, `NoEsQuemador`, `NoEsOrganizador`, `AsistenciaYaPremiada`, `SaldoInsuficiente`.

## Fuera de alcance

Caducidad de los puntos.

Puntos diferenciados por tipo de evento.

Mercado de puntos.

## [SOLO INSTRUCTOR]

### El hueco deliberado

La spec dice que los puntos se emiten cuando una entrada se marca como usada. No dice cómo sabe el sistema que la persona efectivamente entró.

Porque no lo sabe. Solo sabe que una dirección autorizada lo afirmó.

Esa dirección es el portero, y es el oráculo del sistema. Todo lo que está adentro de la cadena es verificable; el hecho físico de cruzar la puerta no lo es.

### Cómo conducirlo

Pregunta en el paso 2 quién confirma la asistencia. Van a responder "el portero". Pregunta entonces qué pasa si el portero miente, o si le roban la llave, o si marca cien entradas desde su casa el día antes.

El contrato no tiene cómo distinguir esos casos de una asistencia real.

Conecta explícitamente con el trabajo final del módulo anterior, donde se pide identificar dónde está el oráculo y cómo se mitiga. Varios alumnos van a elegir casos de trazabilidad y este es el mismo problema con otro disfraz.

### Mitigaciones que vale la pena nombrar

Firma múltiple: dos porteros distintos para marcar.

Ventana temporal acotada al horario real del evento.

Registro público de marcaciones, que no previene el fraude pero lo hace auditable después.

Límite de marcaciones por portero por minuto, que detecta el marcado masivo.

Ninguna elimina el problema. El punto pedagógico es que lo vean y lo digan.

### El bloque de apertura de la sesión

Genera el día antes un ERC-20 escrito a mano, pidiendo explícitamente que no use OpenZeppelin. Revisa qué bugs salieron en tu corrida, porque varían. Los más frecuentes:

`transferFrom` que no descuenta el allowance.

`transfer` que valida mal el saldo, o que no lo valida.

Ausencia de los eventos del estándar, que rompe cualquier front y cualquier explorer.

`approve` sin el problema de la doble autorización documentado.

Diez minutos en parejas buscándolos. Después pregunta cuántos lo habrían aceptado si pasaba los tests del camino feliz.

Al cerrar el bloque, agrega la regla al `CLAUDE.md` del repo frente a ellos. Que vean que el archivo de reglas se construye con la experiencia, no se copia.
