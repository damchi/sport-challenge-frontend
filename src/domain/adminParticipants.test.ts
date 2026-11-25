import { participantChanges } from './adminParticipants';

describe('participantChanges', () => {
  it.each([
    ['active', false, ['exclude', 'makeCreator']],
    ['active', true, ['exclude', 'removeCreator']],
    ['abandoned', false, ['reinstate', 'makeCreator']],
    ['abandoned', true, ['reinstate', 'removeCreator']],
  ] as const)('a participant %s, creator %s, may be told %j', (status, isCreator, changes) => {
    expect(participantChanges({ status, is_creator: isCreator })).toEqual(changes);
  });
});
