# Spec · Sorteo.sol

Sesión 2. Asignación de entradas por sorteo con commit-reveal.

## Contexto

Para eventos con más demanda que aforo, vender por orden de llegada premia a quien tiene mejor conexión. El sorteo reparte entre todos los que postulan dentro de un plazo. El problema es hacerlo sin que nadie pueda predecir el resultado ni inclinarlo a su favor, en un sistema donde todo lo que entra al contrato es público.

Commit-reveal resuelve la primera mitad. La segunda mitad es el contenido de la sesión.

## Actores

**Organizador.** Abre el sorteo, define cuántas entradas se rifan y los plazos de cada fase. Ejecuta el cierre.

**Postulante.** Compromete una postulación con un valor secreto, y después la revela. Si gana, recibe una entrada. Si pierde, recupera su depósito.

**Entrada.sol.** Contrato externo. El sorteo necesita permiso para emitir entradas a los ganadores, y nada más.

## Estados del sorteo

| Estado | Cómo se llega | Qué permite |
|---|---|---|
| Abierto | El organizador lo abre | Comprometer postulaciones |
| En revelación | Vence el plazo de compromiso | Revelar postulaciones |
| Cerrado | Vence el plazo de revelación y alguien ejecuta el cierre | Reclamar entrada o depósito |

El paso de un estado al siguiente depende del tiempo, no de una decisión. Cualquiera puede gatillar la transición una vez vencido el plazo.

## Funciones públicas

`abrirSorteo(cantidadEntradas, duracionCompromiso, duracionRevelacion)`. Solo organizador.

`comprometer(bytes32 compromiso)` pagable. Cualquiera, mientras esté abierto. Requiere depósito.

`revelar(uint256 valor, bytes32 salt)`. Solo quien comprometió, solo en fase de revelación.

`cerrar()`. Cualquiera, después del plazo de revelación. Calcula la entropía final y determina los ganadores.

`reclamar()`. Cualquier postulante revelado, después del cierre. Entrega la entrada si ganó, devuelve el depósito si perdió.

## Cómo se arma el compromiso

El hash combina el valor secreto, el salt y la dirección del postulante.

```
compromiso = keccak256(abi.encodePacked(valor, salt, msg.sender))
```

El salt impide adivinar por fuerza bruta cuando el espacio de valores es chico. La dirección impide copiar el compromiso de otro postulante y hacerlo pasar por propio.

## Cómo se calcula el resultado

La entropía final combina los valores revelados por todos los postulantes. Ningún participante por sí solo la determina.

Con esa entropía se ordena la lista de postulaciones reveladas y se toman las primeras según la cantidad de entradas disponibles.

## Invariantes

Nunca debe pasar que:

1. Alguien revele un valor que no corresponde al compromiso que registró.
2. Se acepte un compromiso después de vencido el plazo de compromiso.
3. Se acepte una revelación antes de que termine la fase de compromiso.
4. Un postulante gane más de una entrada por sorteo.
5. Se entreguen más entradas que las anunciadas al abrir el sorteo.
6. Alguien reclame dos veces.
7. Un postulante que reveló correctamente y perdió se quede sin su depósito.
8. El resultado se pueda calcular antes de que termine la fase de revelación.

## Eventos

`SorteoAbierto(cantidadEntradas, finCompromiso, finRevelacion)`
`PostulacionComprometida(postulante, compromiso)`
`PostulacionRevelada(postulante, valor)`
`SorteoCerrado(entropiaFinal, cantidadGanadores)`
`EntradaReclamada(postulante, tokenId)`
`DepositoDevuelto(postulante, monto)`

## Errores

`SorteoNoAbierto`, `FueraDePlazoCompromiso`, `FueraDePlazoRevelacion`, `CompromisoNoCoincide`, `YaComprometio`, `YaRevelo`, `YaReclamo`, `DepositoInsuficiente`, `SorteoNoCerrado`.

## Fuera de alcance

Sorteos simultáneos para varios eventos.

Prioridad por antigüedad, cercanía geográfica o cualquier criterio distinto del azar.

Lista de espera para las entradas que nadie reclama.

## Cambios tras la revisión de seguridad (octubre 2026)

- **Cierre en dos pasos.** El primer `cerrar()` fija `bloqueSorteo` (el bloque siguiente); el segundo, ya minado ese bloque, combina su hash con lo revelado y sortea. Así el resultado no se puede calcular antes de que termine la revelación (invariante 8): el último en revelar decide sin conocer ese hash. Si nadie completa el cierre en 256 bloques, se fija un bloque nuevo.
- **Selección de ganadores con Fisher-Yates parcial.** El costo de cerrar depende de las entradas anunciadas, no de cuántos se postulan: antes un sorteo popular (o inflado con direcciones falsas) no se podía cerrar y los depósitos quedaban atrapados.
- **Un solo sorteo por contrato** (`SorteoYaAbierto`) y **tope de 500 entradas** (`DemasiadasEntradas`), para que el cierre siempre entre en un bloque.
- **Depósito exacto** (`DepositoExcedido`): `reclamar` devuelve exactamente el depósito.
- **`retirar()`** (solo organizador, después del cierre): retira los depósitos que no se devuelven (ganadores y quienes no revelaron). Lo que se les debe a los perdedores queda reservado. `renounceOwnership` está deshabilitada y el traspaso de organizador es en dos pasos.

## [SOLO INSTRUCTOR]

### Los dos huecos deliberados

**Primero: qué pasa con quien no revela.** En el paso 1, las parejas van a diferir. Unos van a poner un plazo con consecuencia, otros van a olvidar el plazo por completo. No resuelvas la diferencia cuando aparezca. Anótala en el pizarrón y sigue.

Sin plazo, un postulante que desaparece bloquea el cierre para siempre. Ese es el griefing de la segunda mitad del bloque de ataque.

**Segundo, y es el importante: el sesgo del último revelador.** La spec dice que la entropía combina las revelaciones de todos. No dice qué impide que el último en revelar calcule el resultado antes de decidir si revela.

Porque no hay nada que lo impida. Las revelaciones anteriores ya están en la cadena, son públicas, y él conoce la suya. Puede simular el resultado con su valor incluido, ver si gana, y si no gana simplemente no manda la transacción. El sorteo queda sesgado a su favor y el contrato no tiene cómo detectarlo.

### Cómo conducir el descubrimiento

No lo cuentes. Pregunta quién revela último y qué sabe en ese momento.

Si a los dos minutos nadie llega, da una pista: las revelaciones anteriores ya están en la cadena. Si a los cuatro minutos nadie llega, dilo tú. No alargues más, el valor está en el "ah" colectivo y se pierde si se estira.

### Las mitigaciones, ninguna perfecta

Depósito que se pierde por no revelar. Encarece el ataque sin impedirlo: si la entrada vale más que el depósito, igual conviene.

Orden de revelación forzado. Mueve el problema al último del orden.

Muchos participantes. Diluye el sesgo pero no lo elimina.

Oráculo externo de aleatoriedad. Resuelve el problema y agrega una dependencia, que es justo lo que la sesión 3 va a discutir con el portero.

Cada pareja elige una y la justifica por escrito. No hay respuesta correcta, y conviene decirlo.

### Lo que NO debe entrar en la spec del paso 1

El invariante 8, "el resultado no se puede calcular antes de que termine la revelación", está escrito acá porque es la referencia completa. En la spec de los alumnos no debe aparecer antes del ataque. Si está, la IA lo resuelve sola en el paso 3.

Se agrega en el minuto 92, después del descubrimiento.
