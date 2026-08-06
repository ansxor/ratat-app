type ClassValue = string | false | null | undefined;

/** Joins the truthy class names, so conditional classes read the same as the old app. */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}
