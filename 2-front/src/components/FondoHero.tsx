import { cn } from "@/lib/utilidades";

/**
 * Fondo del Hero. NO usa Unsplash ni random ornament — es un gradiente
 * direccional sutil, un vignette radial y un grid hairline que insinúa
 * las butacas de un teatro sin caer en cliché.
 *
 * El grid lo pintamos con CSS puro (background-image) para no agregar
 * una imagen estática al bundle.
 */
export function FondoHero({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={cn(
                "pointer-events-none absolute inset-0 overflow-hidden",
                className,
            )}
        >
            {/* Gradiente base cálido de off-black a un toque más claro en el sur */}
            <div className="absolute inset-0 bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900" />

            {/* Vignette central que "abre" el foco hacia el texto */}
            <div className="absolute inset-0 [background:radial-gradient(60%_50%_at_50%_30%,rgba(180,83,9,0.18)_0%,rgba(180,83,9,0)_70%)]" />

            {/* Grid hairline de butacas — sutil, indica orden sin gritar */}
            <div
                className="absolute inset-0 opacity-[0.16]"
                style={{
                    backgroundImage:
                        "linear-gradient(to right, rgba(231,229,228,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(231,229,228,0.4) 1px, transparent 1px)",
                    backgroundSize: "64px 80px",
                    maskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.15) 70%, transparent 100%)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.15) 70%, transparent 100%)",
                }}
            />

            {/* Spot cálido abajo — simula el reflejo de las luces de escenario */}
            <div className="absolute -bottom-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-amber-700/10 blur-[120px]" />
        </div>
    );
}
