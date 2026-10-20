# Cómo probar la integración local

Checklist para levantar el sistema completo (contratos + front) en la
máquina. Asume que estás en la raíz del repo.

## 0. Problema conocido: `pnpm` no corre

`pnpm <script>` falla hoy con `ERR_PNPM_IGNORED_BUILDS` porque
`pnpm-workspace.yaml` tiene tres entradas sin resolver en `allowBuilds`:

```yaml
allowBuilds:
  bufferutil: set this to true or false      # <-- placeholder
  keccak: set this to true or false         # <-- placeholder
  utf-8-validate: set this to true or false # <-- placeholder
```

Ponerlas en `false` alcanza para desbloquear: son dependencias nativas
opcionales (el JS puro de `ws` y `keccak` funciona igual). Es un cambio de
tres líneas en un archivo que el `CLAUDE.md` marca como protegido, así que
queda a criterio tuyo.

**Mientras tanto, usá `npx` dentro de cada paquete** (los comandos de más
abajo están escritos con `npx` justamente por esto).

## 1. Compilar los contratos

```bash
cd 1-hardhat && npx hardhat compile
```

## 2. Levantar el nodo

```bash
cd 1-hardhat && npx hardhat node
```

Deja esto corriendo en una terminal. Imprime las 20 cuentas con sus claves
privadas: las vas a necesitar para la wallet.

## 3. Desplegar el sistema completo

En otra terminal:

```bash
cd 1-hardhat && npx hardhat ignition deploy ignition/modules/SistemaPuerta7.ts --network localhost
```

Despliega los cinco contratos y después ejecuta las **cuatro
designaciones cruzadas**. Esto último es lo importante: sin ellas el canje
y el sorteo fallan en producción con errores poco claros (ver el bloque
[SOLO INSTRUCTOR] de `docs/spec/canje.md`).

| Designación | Por qué |
|---|---|
| `Entrada.designarOperadorAutorizado(Canje, true)` | El canje quema la entrada usada y emite la mejora |
| `Entrada.designarOperadorAutorizado(Sorteo, true)` | El sorteo emite la entrada del ganador |
| `Puntos.designarQuemador(Canje)` | El canje destruye los puntos del canje |
| `Puntos.designarEmisor(Entrada)` | La spec dice que `Entrada` emite puntos al validar (ver nota abajo) |

## 4. Exportar ABIs y direcciones al front

```bash
cd 1-hardhat && npx hardhat run scripts/exportar.ts --network localhost
```

Escribe en `2-front/src/lib/`:

- `abis/Entrada.ts`, `Puntos.ts`, `Canje.ts`, `Reventa.ts`, `Sorteo.ts` —
  los ABI reales como `as const`, para que viem los infiera.
- `direcciones.ts` — las direcciones, keyed por chain ID.

**Estos dos archivos son generados. No los edites a mano**: la próxima
corrida de `exportar` los pisa. Si cambiás un contrato, el flujo es
`compilar → desplegar → exportar`.

## 5. Verificación automática

```bash
cd 1-hardhat && npx hardhat run scripts/verificar.ts --network localhost
```

Comprueba contra el nodo que:

- las direcciones exportadas responden,
- `owner()` es la cuenta 0 y `portero()` es la cuenta 1,
- el camino `emitir → comprar → usar` anda de punta a punta,
- el portero **no** puede retirar fondos,
- una entrada ya usada **no** se puede listar en reventa.

Es re-ejecutable: nombra los asientos a partir de lo ya emitido, así que
podés correrlo las veces que quieras contra el mismo nodo.

## 6. Levantar el front

```bash
cd 2-front && npm run dev
```

Abrí <http://localhost:3000>.

## 7. Cargar las cuentas en la billetera

En `hardhat node` aparecen las claves. Las dos que importan:

| Rol | Cuenta | Clave privada |
|---|---|---|
| Organizador | #0 `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Portero | #1 `0x70997970C51812dc3A010C7d01b50e0d17dc79c8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |

Importá **las dos** en la wallet y alterná entre ellas para recorrer los
roles. Es lo que hace falta porque organizador y portero son roles
distintos: el portero **no** es el owner.

En MetaMask: *Importar cuenta → pegar clave*. Después agregá la red
`http://127.0.0.1:8545` con chain ID `31337` (aparece sola en el flujo de
conexión).

## 8. Recorrido de prueba

Con la cuenta **#0 (organizador)** conectada:

1. `/organizador` → los contadores están en cero. "Retirar ahora" debe
   estar **habilitado**: `owner()` devuelve tu dirección.
2. `/organizador/emitir` → emití 3 entradas (filas `A,B,C`, asientos
   `1,2,3`, sector A). Volvé a `/organizador`: `Emitidas 3`,
   `Disponibles 3`.
3. `/reventa` → el **techo y la comisión salen en 0** hasta que el
   organizador llame a `configurar`. Con 0% el techo es 0 y ninguna
   publicación pasa el control. Es el comportamiento esperado del
   contrato, no un bug: hay que configurar antes de publicar.

Con la cuenta **#2 o #3 (comprador)**:

4. `/comprar` → comprá una. Una compra es **una** entrada: el contrato no
   recibe cantidad y exige el pago exacto.
5. `/mis-entradas` → tiene que aparecer con **sector y asiento reales**,
   no todos como `A-1`.

Con la cuenta **#1 (portero)**:

6. `/portero` → pegá el tokenId. El visor tiene que mostrar el mismo
   estado que el input (comparten estado). "Marcar como Usada" se habilita
   solo si la entrada está en estado **Vendida**.

Volviendo a la cuenta **#2**:

7. `/mis-entradas` → **sin recargar**: la pantalla tiene que actualizarse
   sola. Eso es `useSincronizacion`, que escucha `EntradaUsada` y
   refresca las lecturas.

## 9. Probar la red equivocada

Cambiá la wallet a otra red (Sepolia, la que sea). Tiene que aparecer el
banner con "Conectá la billetera a Hardhat local" y un botón "Cambiar a
Hardhat". Todos los botones de escritura quedan inoperantes mientras tanto:
sin ese bloqueo, la transacción iría a una red donde el contrato no existe
y el usuario perdería el gas.

## Reiniciar el nonce local

Si la cadena queda en un estado raro, pará el nodo con `Ctrl-C` y volvé a
levantarlo. El estado vive en memoria: al reiniciar, la cadena vuelve al
genesis (cuenta 0 con 10000 ETH, nonce 0) **y los contratos desaparecen**.
Después hay que volver a correr los pasos 3 y 4.

Para empezar de cero sin perder las dependencias:

```bash
rm -rf 1-hardhat/ignition/deployments
```

## Una nota sobre `Puntos.emitir`

`docs/spec/puntos.md` dice que los puntos se emiten cuando una entrada se
marca como usada, y designa a `Entrada` como emisor. **`Entrada.usar()`
no llama a `Puntos.emitir`**: la spec quedó a medio cablear. El deploy
designa el emisor igual (es inocuo y deja el permiso listo), pero en la
práctica `/puntos` muestra saldo cero siempre y no hay forma de emitir
puntos desde la UI.

Es un hueco de los contratos, no del front. Cablearlo es una transacción
en `Entrada.usar()` y el emisor ya está designado.