export const BLACKOUT_IMAGES = import.meta.env.VITE_RATAT_BLACKOUT_IMAGES === "true";

export function imageBackground(source: string | undefined, fallback: string): string {
  if (BLACKOUT_IMAGES) return "background-color: black; background-image: none;";
  return source
    ? `background-image: url(${JSON.stringify(source)});`
    : `background-image: ${fallback};`;
}
