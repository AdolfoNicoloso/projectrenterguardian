/**
 * Firestore + Storage CMS layer for Firebase Functions.
 */

export type {DownloadedFile, SignedUploadSession} from "./storage";
export {
  downloadByFileId,
  uploadBinary,
  createSignedUploadSession,
  finalizeSignedUploadForProfile,
  deleteMediaFile,
  deleteUploadedFileForProfile,
  MAX_BASE64_UPLOAD_BYTES,
  MAX_DIRECT_UPLOAD_BYTES,
} from "./storage";
export * from "./profiles";
export * from "./accountDeletion";
export * from "./properties";
export * from "./spaces";
export * from "./spaceTypes";
export * from "./propertyStatuses";
export * from "./photos";
export * from "./notes";
export * from "./inspections";
export * from "./inspectionTypes";
export * from "./reports";
export * from "./assignments";
export * from "./userPreferences";
export * from "./sharing";
export * from "./notifications";
export * from "./tourReminders";
export {
  fetchPropertyIfOwned,
  isPropertyOwned,
  isSpaceOnProperty,
  fetchPhotoById,
  canAccessFile,
  requirePropertyAccess,
  getPropertyAccess,
  roleMeetsMinimum,
} from "./access";
export type {PropertyRole, PropertyAccess} from "./access";
