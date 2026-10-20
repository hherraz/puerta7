"use client";

import { Boton } from "@/components/ui/Boton";
import { useRed, motivoBloqueo } from "@/lib/red";

/**
 * Banner que explica por qué no se puede operar y ofrece el arreglo.
 *
 * Sin esto, una wallet en la red equivocada ve los botones activos, firma
 * la transacción y la pierde: el contrato no existe en otra red. Bloquear
 * el botón sin explicación tampoco sirve — el usuario no sabe qué hacer.
 */
export function AvisoRed() {
    const red = useRed();
    const motivo = motivoBloqueo(red);

    // Sin wallet no dice nada: cada página ya tiene su propio prompt de
    // "conectá la billetera".
    if (!red.chainId || motivo === null) return null;

    return (
        <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-amber-700/40 bg-amber-950/20 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
                <p className="text-sm font-medium text-amber-200">{motivo}</p>
                {red.errorCambioRed !== undefined && (
                    <p className="text-xs text-red-400">{red.errorCambioRed}</p>
                )}
            </div>

            {red.puedeCambiarRed && (
                <Boton
                    variante="secundario"
                    tamano="sm"
                    cargando={red.cambiandoRed}
                    onClick={() => {
                        void red.cambiarRed();
                    }}
                >
                    Cambiar a Hardhat
                </Boton>
            )}
        </div>
    );
}