/**
 * Stored profile display name (spec 008): "First Last". firestore.rules
 * require displayName to equal exactly this when first/last are present.
 */
export function joinName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}
