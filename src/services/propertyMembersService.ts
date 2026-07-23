import { backendClient } from './backendClient';
import type {
  PropertyInvite,
  PropertyMember,
  PropertyMemberRole,
  PropertyPeoplePayload,
} from '../types';

export const propertyMembersService = {
  async listPeople(propertyId: string): Promise<PropertyPeoplePayload> {
    const response = await backendClient.call<{ data: PropertyPeoplePayload }>(
      `listPropertyMembers?propertyId=${encodeURIComponent(propertyId)}`,
      { method: 'GET' }
    );
    return response.data;
  },

  async createInvite(input: {
    propertyId: string;
    role: PropertyMemberRole;
    email?: string;
    phone?: string;
  }): Promise<PropertyInvite & { share_message?: string; share_url?: string }> {
    const response = await backendClient.call<{
      data: PropertyInvite & { share_message?: string; share_url?: string };
    }>('createPropertyInvite', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  async getInvitePreview(token: string): Promise<{
    token: string;
    role: string;
    status: string;
    invite_email?: string | null;
    invite_phone?: string | null;
    expires_at?: string | null;
    property_label: string;
  }> {
    const response = await backendClient.call<{ data: any }>(
      `getPropertyInvitePreview?token=${encodeURIComponent(token)}`,
      { method: 'GET' }
    );
    return response.data;
  },

  async acceptInvite(token: string): Promise<{
    property_id: string;
    role: string;
    member_id?: string;
    already_member?: boolean;
  }> {
    const response = await backendClient.call<{ data: any }>('acceptPropertyInvite', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return response.data;
  },

  async updateMemberRole(
    memberId: string,
    role: PropertyMemberRole
  ): Promise<PropertyMember> {
    const response = await backendClient.call<{ data: PropertyMember }>(
      'updatePropertyMemberRole',
      {
        method: 'PATCH',
        body: JSON.stringify({ memberId, role }),
      }
    );
    return response.data;
  },

  async revokeMember(memberId: string): Promise<void> {
    await backendClient.call('revokePropertyMember', {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    });
  },

  async revokeInvite(inviteId: string): Promise<void> {
    await backendClient.call('revokePropertyInvite', {
      method: 'POST',
      body: JSON.stringify({ inviteId }),
    });
  },
};
