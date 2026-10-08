import type { Config } from "tailwindcss";

/**
 * Paleta:
 * - ink-* : escala off-black cálida (stone). bg por defecto es #0c0a09.
 * - accent-* : un solo acento. amber-700 (#b45309), para botones primarios.
 *              El highlight de confirmación usa emerald-600 inline, no como segundo acento.
 *
 * Nota: nunca uso purple/blue AI glow. Sin gradientes decorativos de fondo.
 * Sin emojis. Sin sombras neón.
 */
const config: Config = {
    content: ["./src/**/*.{ts,tsx}"],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                ink: {
                    50: "#fafaf9",
                    100: "#f5f5f4",
                    200: "#e7e5e4",
                    300: "#d6d3d1",
                    400: "#a8a29e",
                    500: "#78716c",
                    600: "#57534e",
                    700: "#44403c",
                    800: "#292524",
                    900: "#1c1917",
                    950: "#0c0a09",
                },
                accent: {
                    DEFAULT: "#b45309",
                    fg: "#fef3c7",
                    soft: "#451a03",
                },
            },
            fontFamily: {
                sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
                mono: ["var(--font-geist-mono)", "ui-monospace"],
            },
            fontSize: {
                // Mantenemos la escala de Tailwind; sólo añadimos un display extra
                "display-xl": ["clamp(3rem, 8vw, 6.5rem)", { lineHeight: "0.95", letterSpacing: "-0.04em" }],
                "display-lg": ["clamp(2.25rem, 5vw, 4rem)", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
                "display-md": ["clamp(1.5rem, 2.5vw, 2.25rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
            },
            borderRadius: {
                // 2xl = surface medio, 3xl = hero, xl = chips
                "4xl": "2rem",
            },
            transitionTimingFunction: {
                // Curva de easing "premium" para hovers y entradas
                premium: "cubic-bezier(0.16, 1, 0.3, 1)",
            },
            transitionDuration: {
                "300": "300ms",
                "500": "500ms",
            },
            boxShadow: {
                // Sombra "diffusion" muy difusa para tarjetas de superficie
                diffusion: "0 20px 40px -15px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            },
            keyframes: {
                shimmer: {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
                floatUp: {
                    from: { transform: "translateY(8px)", opacity: "0" },
                    to: { transform: "translateY(0)", opacity: "1" },
                },
            },
            animation: {
                shimmer: "shimmer 2.4s linear infinite",
                "float-up": "floatUp 600ms cubic-bezier(0.16, 1, 0.3, 1) both",
            },
        },
    },
    plugins: [],
};

export default config;
