# CLAUDE.md

Pautas de comportamiento para reducir errores comunes de LLMs al programar. Adaptado de [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).

**Tradeoff:** Las pautas priorizan la cautela por encima de la velocidad. Para tareas triviales, usar criterio propio.

## 1. Piensa antes de programar

**No asumas. No escondas la confusión. Expón los tradeoffs.**

Antes de implementar:

- Enunciá tus supuestos explícitamente. Si tenés dudas, preguntá.
- Si hay varias interpretaciones, presentalas — no elijas en silencio.
- Si hay un enfoque más simple, decilo. Empujá hacia atrás cuando corresponde.
- Si algo no está claro, frená. Nombra qué confunde. Preguntá.

## 2. Simplicidad ante todo

**El mínimo código que resuelve el problema. Nada especulativo.**

- Ninguna feature extra fuera de lo pedido.
- Ninguna abstracción para código de un solo uso.
- Ninguna "flexibilidad" o "configurabilidad" no pedida.
- Ningún manejo de error para escenarios imposibles.
- Si escribiste 200 líneas y podrían ser 50, reescribí.

Preguntate: "¿Un senior diría que esto está sobre-ingenierado?" Si sí, simplificar.

## 3. Cambios quirúrgicos

**Tocá solo lo que debés. Limpiá solo tu propio desorden.**

Al editar código existente:

- No "mejores" código adyacente, comentarios o formato.
- No refactorices lo que no está roto.
- Respetá el estilo existente, incluso si lo harías diferente.
- Si notás código muerto no relacionado, mencionalo — no lo borres.

Cuando tus cambios dejan huérfanos:

- Borrá imports/variables/funciones que TUS cambios dejaron sin usar.
- No borres código muerto preexistente a menos que lo pidan.

La prueba: cada línea cambiada debe trazarse directo a lo que pidió el usuario.

## 4. Ejecución guiada por objetivos

**Definí criterios de éxito. Iterá hasta verificar.**

Transformá tareas imperativas en metas verificables:

- "Agregá validación" → "Escribí tests para entradas inválidas y hacé que pasen"
- "Arreglá el bug" → "Escribí un test que lo reproduzca y hacé que pase"
- "Refactoreá X" → "Asegurate de que los tests pasen antes y después"

Para tareas multi-paso, escribí un plan breve:

```
1. [Paso] → verificar: [chequeo]
2. [Paso] → verificar: [chequeo]
3. [Paso] → verificar: [chequeo]
```

Buenos criterios de éxito te dejan iterar solo. Malos criterios ("que funcione") requieren aclaración constante.

---

**Estas pautas están funcionando si:** hay menos cambios innecesarios en los diffs, menos reescrituras por sobre-ingeniería, y las preguntas aclaratorias llegan antes de la implementación en vez de después de los errores.

---

## Project-Specific Guidelines (puerta7)

### Stack

- **Solidity** `0.8.34` (ver `1-hardhat/hardhat.config.ts`).
- **Hardhat 3** con `@nomicfoundation/hardhat-toolbox-mocha-ethers`.
- **OpenZeppelin Contracts** `5.6.1` (ERC-721, Ownable).
- **Tests**: Mocha + Chai + ethers v6. **No usar Jest.**
- **Despliegues**: Hardhat Ignition. Módulos en `1-hardhat/ignition/modules/`.

### Convenciones del repo

- Comentarios, mensajes y nombres de funciones en español: `emitir`, `comprar`, `usar`, `retirar`, etc.
- Scripts npm en español: `compilar`, `test`, `nodo`, `desplegar`.
- Los `error` personalizados son parte de la API del contrato: cambiarlos rompe los tests, lo cual es correcto.
- Las constantes `E_*` al tope de `test/Entrada.ts` (`E_PAGO`, `E_NO_PORTERO`, …) son la fuente de verdad del mensaje que emite el contrato.
- No traducir mensajes de error entre español e inglés al "arreglar" — la suite los verifica literalmente.

### Reglas de contrato

- **TDD primero**: los tests en `1-hardhat/test/Entrada.ts` van antes que el código. El contrato `1-hardhat/contracts/Entrada.sol` se completa para hacerlos pasar.
- **No tocar `docs/spec/entrada.md`** salvo que el usuario lo pida. La spec es la fuente de invariantes y decisiones de diseño (pago exacto, sector 1–4, etc.).
- **No introducir dependencias nuevas** sin pedir. Si algo se puede hacer con lo ya instalado (`@openzeppelin/contracts`, `hardhat-ignition`, etc.), hacer así.
- **No abstraer de más**: si una función se usa una sola vez, dejarla inline. No crear librerías, helpers ni patrones "por si acaso".
- **No agregar funciones sin tests**. Si no hay test que lo pida, no hace falta la función.
- **Seguir el estilo OpenZeppelin 5.x**: usar `_update`, `_ownerOf`, `_setApproval` y los hooks en vez de `transferFrom` directo cuando aplique.
- **Errores con parámetros**: los `error Foo(uint256 x, address y)` ya son legibles por ethers; no duplicarlos en un `require` con string.
- **Eventos**: incluir `indexed` en los campos que se vayan a filtrar off-chain (`tokenId`, direcciones).

### Reglas de tests

- Tests en `1-hardhat/test/`, extensión `.ts`.
- Helpers de setup al tope del archivo (`desplegar`, `conTresEmitidas`, `conUnaVendida`).
- Constantes de error declaradas como `E_*` para que cambiar el mensaje del contrato rompa la suite.
- Una sección `describe` por función pública del contrato + una sección final para la máquina de estados.
- No mockear el contrato ni el provider — usar el nodo EDR simulado de Hardhat 3.

### Reglas de workspace

- **No modificar** la raíz `package.json` ni `pnpm-workspace.yaml` salvo que el usuario lo pida. Los cambios van en `1-hardhat/`.
- **No commitir `.env`** — está en `.gitignore`. Para documentar variables, usar `.env.example`.
- **`2-nextjs/`** todavía no existe. Cuando se cree, mantener la misma convención (TypeScript estricto, sin dependencias innecesarias, comentarios en español).

### Antes de tocar código

- ¿Está en la spec o lo pidió el usuario explícito? Si no, preguntar.
- ¿Agrega complejidad sin valor (abstracción, "flexibilidad", manejo de errores imposibles)? Si sí, no.
- ¿Hay un test que cubre este cambio? Si no, escribirlo antes de implementar.
- ¿Rompe un invariante de `docs/spec/entrada.md`? Si sí, frená.