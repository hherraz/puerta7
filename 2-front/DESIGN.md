# DESIGN.md

> Documento vivo de dirección artística para `2-front/`. Las decisiones acá adentro mandan sobre cualquier dependencia de IA generativa de imágenes.

## Historia de la marca

**Puerta 7** es un NFT ticket para un único evento. La estética evoca la puerta de un teatro antes de la función: la expectativa, el foco, el papel viejo. No es un marketplace genérico de NFT, ni un panel admin estilo SaaS — es una **boletería con ADN cinematográfico**.

## Concepto vertebral

**"Stage / spotlight — performer + audience framing"**.

Cada pantalla trata al visitante como alguien parado frente al escenario: la marca le entrega una entrada (un número, una butaca, un momento). Las entradas se sienten coleccionables, casi como boletos impresos, no como filas en una tabla.

## Eje narrativo

El sitio tiene **una sola conversión primaria** (comprar entrada) y dos secundarias (portero, organizador). Todo el diseño refuerza la primera: la ruta del ojo siempre termina en "Comprar entrada" o "Ver mi entrada".

## Identidad visual

### Paleta (controlada)

| Token       | Valor       | Uso |
| ----------- | ----------- | --- |
| `ink-950`   | `#0c0a09`   | fondo principal — off-black cálido, NO pure black |
| `ink-900`   | `#1c1917`   | surface elevada (tarjetas, modales) |
| `ink-800`   | `#292524`   | hairline borders (`border-ink-800/60`) |
| `ink-400`   | `#a8a29e`   | texto secundario / captions |
| `ink-500`   | `#78716c`   | texto terciario / desactivado |
| `ink-50`    | `#fafaf9`   | texto principal |
| `accent`    | `#b45309`   | **un solo acento** — CTAs primarios, links, foco |
| `accent-fg` | `#fef3c7`   | texto sobre accent |
| `accent-soft` | `#451a03` | superficie de acento (badges) |

Verde (`emerald-600`) se usa **solo inline** para indicar confirmación de hash / transacción. No es segundo acento.

### Tipografía

- **Display / headings**: `Geist` 600–700, `tracking-tighter`, escala `text-display-xl`/`lg`/`md`
- **Body**: `Geist` 400–500, `text-base text-ink-300 leading-relaxed max-w-[65ch]`
- **Mono / numerics**: `Geist Mono` para `precio`, `tokenId`, hashes

Prohibido: Inter (regla del taste-skill), gradient text en headlines, font-cluttering de tres familias.

### Materiales

- Superficies con `bg-ink-900` + `border border-ink-800/60` + `shadow-diffusion` (sombra "difusión" tinta, no neon)
- Hairlines de 1px en `border-ink-800/40` para dividir grupos sin cajas pesadas
- Sin glassmorphism apilado; sin floating blobs; sin gradient text

### Radio

- Default: `rounded-2xl` (superficies)
- Hero: `rounded-[2.5rem]`
- Chips / botones chicos: `rounded-xl`

## Anatomía de página (8 secciones → 8 imágenes de referencia)

Si las imágenes se generan con un tool externo, una por sección, en este orden:

1. **Hero** — *Imagen 1/8* — `text centered low over full-bleed` (NO izquierda-texto/derecha-imagen). Fila de butacas vista desde el escenario, foco cálido en la primera fila (`Platea`). Headline corto: 5-7 palabras. CTA primario: outline pill (no filled) sobre la imagen; secondary CTA: link inline con flecha.
2. **Strip / sectores** — *Imagen 2/8* — Marquee horizontal infinito con los nombres de los sectores (`Platea`, `Platea Alta`, `Platea Baja`, `Cancha`, `Galería`). Cada chip es un bloque tipográfico grande, no un ícono. Variar color con un sólo punto de accent por ciclo.
3. **Cómo funciona** — *Imagen 3/8* — Layout zig-zag de 2 columnas (no 3 cards). Tres bloques apilados, alternando izquierda/derecha. Block 1: "Emitís" → foto macro de un boleto viejo / numerado. Block 2: "Comprás" → overlay de wallet mobile. Block 3: "Entrás" → mano pasando ticket por scanner.
4. **NFT showcase** — *Imagen 4/8* — Ticket NFT a pantalla completa como objeto. Crop macro mostrando sector / fila / asiento tipográficos. Off-grid editorial offset (no centrado).
5. **Confianza / transparencia** — *Imagen 5/8* — Sección mini minimalist. Tres renglones monoespaciados: dirección del contrato, contador de emitidas, contador de disponibles. Sin imágenes. Off-white en esta sección para respirar.
6. **Para el portero** — *Imagen 6/8* — Editorial side-image 60/40. Texto a la izquierda, imagen de scanner industrial a la derecha. CTA como link underlined inline (no otro botón).
7. **Para el organizador** — *Imagen 7/8* — Bento grid asimétrico (no cards repetidas). 70/30 split: izquierda "Emitir entradas" con preview de la grilla (sector × filas × asientos), derecha "Retirar recaudación" con número mono grande + un mini-chart de balances diarios.
8. **Footer / CTA final** — *Imagen 8/8* — Stacked center. Headline corto en dos líneas, un solo CTA primario, una línea de hairline, una línea de copy legal/disclaimer. Cero filas de links.

## Reglas duras

- **NO emojis** en código, markup, copy o alt text. Íconos: SVG primitives inline.
- **NO purple/blue AI glow**, NO neon edges, NO gradient text en headlines.
- **NO pure black** (`#000`). Off-black (`ink-950`).
- **NO 3-card-row** en features. Zig-zag o Bento asimétrico.
- **NO Inter**. Geist o nada.
- **NO nombres fake** tipo "John Doe" en copy placeholder. Si necesitás un nombre, usá un nombre realista en español ("Juana Iturbe", "Tomás Aldunate") o eliminá el nombre.
- **NO Avatares "egg"** SVG genéricos. Si necesitás avatar, placeholder neutro cuadrado con iniciales y `tracking-tight`.
- **Mobile-first**. Breakpoints `sm/md/lg/xl`. Toda sección de Hero usa `min-h-[100dvh]` (no `h-screen`).

## Movimiento

Motion intensity 6/10:

- Entradas y reveals: CSS keyframes con `animation-delay: calc(var(--index) * 60ms)` para stagger.
- Hovers: `transition-all duration-300 ease-premium translate-y-[-1px]` sobre botones.
- Marca de carga (cuando se espera hash): shimmer inline.
- Sin `useEffect` con scroll listeners. Sin biblioteca extra (Framer Motion solo si aparece un caso confirmado; por ahora CSS basta).

## Sistema de tokens en código

```ts
// tailwind.config.ts (extracto relevante)
ink: { 50..950 }
accent: { DEFAULT, fg, soft }

// globals.css define @layer base los defaults
html { background: ink-950; color: ink-50; }
body { font-feature-settings: "ss01", "cv02"; }  // Geist OpenType
```

## Plantilla de imagen por sección (para el tool generativo)

Para cada imagen, pasarle a la herramienta algo como:

```
[Section N of 8: <name>]
Style: cinematic editorial, off-black canvas (#0c0a09), warm amber accent (#b45309) used sparingly.
Composition anchor: <uno de los 8 anclas listados arriba>.
Background mode: <uno de los 10 modos>.
Hero scale per page: Mid Editorial.
Type: Geist (or substitute grotesk with optical-size 6 display).
Imperative: NO emojis, NO purple/blue AI glows, NO neon edges, NO gradient headlines.
Real photography or art-directed objects only — no stock clip-art.
Imagen en 16:9 horizontal. Una sola sección por frame.
```

## Decisiones explícitas

- **Sin الأسعار (pricing table)**: el precio se muestra inline en cada entrada individual. No hay tabla.
- **Sin FAQ**: si el usuario tiene dudas, lo llevamos a la sección correspondiente. Portero → `/portero`, etc. Elimina peso visual.
- **Sin testimonios**: el producto está en construcción. Agregarlos sería mentir.
- **Sin blog / news**: no es la página de un periódico.
- **Cero "seamless / unleash / next-gen"** en copy. Verbos concretos: comprás, entrás, emitís, retirá.
