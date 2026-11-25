/** A change an admin makes to someone who joined a challenge. */
export type ParticipantChange = 'exclude' | 'reinstate' | 'makeCreator' | 'removeCreator';

/**
 * The changes offered for a participant (mockup « Fiche d'un défi »): one
 * who takes part may be excluded, one who abandoned or was excluded
 * reinstated; a creator loses the role, anyone else may get it. The server
 * takes each at any time; it still says no (the last creator).
 */
export function participantChanges(participant: {
  status: 'active' | 'abandoned';
  is_creator: boolean;
}): [ParticipantChange, ParticipantChange] {
  return [
    participant.status === 'active' ? 'exclude' : 'reinstate',
    participant.is_creator ? 'removeCreator' : 'makeCreator',
  ];
}
