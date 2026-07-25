/**
 * Property members and invites (sharing).
 * Thin barrel — implementations live in focused modules.
 */

export type {CollaboratorRole} from "./sharingNormalize";
export {
  normalizeInviteEmail,
  normalizeInvitePhone,
} from "./sharingNormalize";

export {
  createPropertyInvite,
  acceptPropertyInvite,
  notifyPendingInvitesForProfile,
  claimPendingInvitesForProfile,
  revokePropertyInvite,
  getInvitePreviewByToken,
} from "./sharingInvites";

export {
  listPropertyPeople,
  updatePropertyMemberRole,
  revokePropertyMember,
  listSharedPropertyIdsForProfile,
  mapPropertyWithRole,
} from "./sharingMembers";
