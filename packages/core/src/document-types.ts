export const DOCUMENT_TYPES = [
  "pay_stub",
  "bank_statement",
  "w2",
  "utility_bill",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}
