/**
 * HTTPS Cloud Functions API — Firebase Auth + Firestore + Storage.
 * Expo clients call these endpoints; they never talk to Firestore/Storage
 * directly.
 */

import {setGlobalOptions} from "firebase-functions";
import * as admin from "firebase-admin";

setGlobalOptions({maxInstances: 10});

if (admin.apps.length === 0) {
  admin.initializeApp({
    storageBucket: "project-renter-guardian-media",
  });
}

export {
  smokeTest,
  bootstrapProfile,
  getAppProfile,
  updateAppProfile,
  getUserPreferences,
  updateUserPreferences,
  deleteAccount,
} from "./http/profile";

export {
  getMyProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
} from "./http/properties";

export {
  getSpaces,
  createSpace,
  updateSpace,
  deleteSpace,
  propertyHasInspections,
  reorderSpaces,
} from "./http/spaces";

export {
  getPhotos,
  getPhoto,
  uploadFile,
  createMediaUpload,
  finalizeMediaUpload,
  deleteUploadedFile,
  createPhoto,
  updatePhoto,
  deletePhoto,
  getFile,
  createAssignment,
  reorderPhotos,
  getAssignments,
} from "./http/photos";

export {
  createInspection,
  getInspections,
  getInspectionById,
  getInspectionSteps,
  getInspectionStep,
  updateInspectionStep,
  updateInspection,
  deleteInspection,
} from "./http/inspections";

export {
  createReport,
  getReports,
  getReportById,
  updateReport,
  generateReportPdf,
} from "./http/reports";

export {
  createPropertyInvite,
  listPropertyMembers,
  getPropertyInvitePreview,
  acceptPropertyInvite,
  updatePropertyMemberRole,
  revokePropertyMember,
  revokePropertyInvite,
} from "./http/sharing";

export {
  createPropertyPublicShare,
  revokePropertyPublicShare,
  getPublicPropertyPreview,
  getPublicFile,
} from "./http/publicShares";

export {
  listMyNotifications,
  markNotificationRead,
} from "./http/notifications";

export {
  processTourReminders,
  runTourRemindersNow,
} from "./http/tourReminders";
