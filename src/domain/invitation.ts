// Invitation links of the domain, shared with the mobile app in V2.

import type { ChallengeRole } from './challenge';

/** The fields of a challenge, as the server gives them, that say who may invite. */
export interface InvitationRights {
  my_role: ChallengeRole;
  my_status: 'active' | 'abandoned' | null;
  members_can_invite: boolean;
  registration_deadline: string;
}

/**
 * Whether the user is offered to invite, as the contract says
 * (createInvitation): the creators, and the active participants when the
 * challenge lets them (members_can_invite), until the end of week 1
 * (registration_deadline). The server still refuses past it, should the
 * device's clock be wrong.
 */
export function canInvite(challenge: InvitationRights, now: Date): boolean {
  if (now.getTime() >= Date.parse(challenge.registration_deadline)) return false;
  if (challenge.my_role === 'creator') return true;
  return (
    challenge.my_role === 'participant' &&
    challenge.my_status === 'active' &&
    challenge.members_can_invite
  );
}

/**
 * The address to share: the app's invitation page with the token in the
 * fragment, which the browser never sends to the server (access logs,
 * Referer). Nothing else, so the link carries no personal data.
 */
export function invitationLink(origin: string, token: string): string {
  return `${origin}/invite#${encodeURIComponent(token)}`;
}
