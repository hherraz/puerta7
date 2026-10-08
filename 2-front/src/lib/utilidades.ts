import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combinar clases Tailwind sin que la última pierda frente a la primera. */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
