/** Normalize wording for intent matching only; never rewrite the user's displayed request. */
export function normalizeErpQuestion(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:deparmentos?|departementos?)\b/g, (match) => match.endsWith("s") ? "departamentos" : "departamento")
    .replace(/\bporcentage(?:s)?\b/g, "porcentaje")
    .replace(/\btortas?\b/g, "tarta");
}
