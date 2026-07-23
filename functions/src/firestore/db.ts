/**
 * Firestore Admin helpers for Cloud Functions.
 */
import * as admin from "firebase-admin";

/**
 * @return {FirebaseFirestore.Firestore} Default Firestore instance.
 */
export function db(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

/**
 * @return {string} Current ISO timestamp.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Converts a Firestore Timestamp or string to ISO string.
 * @param {unknown} value Raw timestamp.
 * @return {string|undefined} ISO string or undefined.
 */
export function toIso(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as {toDate: () => Date}).toDate === "function"
  ) {
    return (value as {toDate: () => Date}).toDate().toISOString();
  }
  return String(value);
}

/**
 * @param {unknown} value Raw date.
 * @return {string|undefined} YYYY-MM-DD or undefined.
 */
export function toDateOnly(value: unknown): string | undefined {
  const iso = toIso(value);
  if (!iso) {
    return undefined;
  }
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

export type FsDoc = FirebaseFirestore.DocumentData & {id: string};

/**
 * @param {FirebaseFirestore.DocumentSnapshot} snap Document snapshot.
 * @return {FsDoc|null} Data with id or null.
 */
export function snapToDoc(
  snap: FirebaseFirestore.DocumentSnapshot
): FsDoc | null {
  if (!snap.exists) {
    return null;
  }
  return {id: snap.id, ...snap.data()} as FsDoc;
}
