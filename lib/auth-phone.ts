export function normalizeOmanPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("968") ? `+${digits}` : `+968${digits}`;
}

export function isValidOmanPhone(value: string): boolean {
  return /^\+968[279]\d{7}$/.test(normalizeOmanPhone(value));
}
