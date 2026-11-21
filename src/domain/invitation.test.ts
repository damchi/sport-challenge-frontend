import {
  canInvite,
  invitationLink,
  invitationTokenFromHash,
  type InvitationRights,
} from './invitation';

const deadline = '2026-11-09T05:00:00Z';
const before = new Date('2026-11-09T04:59:59Z');
const participant: InvitationRights = {
  my_role: 'participant',
  my_status: 'active',
  members_can_invite: true,
  registration_deadline: deadline,
};

describe('canInvite', () => {
  it('lets the creators invite, whatever members_can_invite says', () => {
    expect(
      canInvite({ ...participant, my_role: 'creator', members_can_invite: false }, before),
    ).toBe(true);
  });

  it('lets an active participant invite only when the challenge allows it', () => {
    expect(canInvite(participant, before)).toBe(true);
    expect(canInvite({ ...participant, members_can_invite: false }, before)).toBe(false);
  });

  it.each([
    ['abandoned', 'abandoned'],
    ['invited', null],
    ['outsider', null],
  ] as const)('does not let a user %s invite', (role, status) => {
    expect(canInvite({ ...participant, my_role: role, my_status: status }, before)).toBe(false);
  });

  it('stops at the end of week 1', () => {
    const creator = { ...participant, my_role: 'creator' } as const;
    expect(canInvite(creator, new Date(deadline))).toBe(false);
    expect(canInvite(participant, new Date('2026-11-20T12:00:00Z'))).toBe(false);
  });
});

describe('invitationLink', () => {
  it('puts the token in the fragment of the invitation page', () => {
    expect(invitationLink('https://app.example', 'abc_123')).toBe(
      'https://app.example/invite#abc_123',
    );
  });

  it('encodes the characters a fragment would not keep', () => {
    expect(invitationLink('https://app.example', 'a b#c')).toBe(
      'https://app.example/invite#a%20b%23c',
    );
  });
});

describe('invitationTokenFromHash', () => {
  it('reads the token of the fragment', () => {
    expect(invitationTokenFromHash('#Ab3_x-9')).toBe('Ab3_x-9');
  });

  it('accepts 256 characters at most', () => {
    expect(invitationTokenFromHash(`#${'a'.repeat(256)}`)).toBe('a'.repeat(256));
    expect(invitationTokenFromHash(`#${'a'.repeat(257)}`)).toBeNull();
  });

  it.each(['', '#', '#a b', '#a%20b', '#a/b', '#a#b', '#<script>', '#é'])(
    'refuses the fragment %j',
    (hash) => {
      expect(invitationTokenFromHash(hash)).toBeNull();
    },
  );
});
