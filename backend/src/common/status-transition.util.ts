import { BadRequestException } from '@nestjs/common';

// Simple, reusable lifecycle-state-machine check.
// `allowedTransitions` maps a current status to the list of statuses it is
// allowed to move to next. If the move isn't in that list, we reject it.
//
// Example:
//   const ADZONE_TRANSITIONS = { ACTIVE: ['PAUSED', 'ARCHIVED'], ... }
//   assertTransition('ACTIVE', 'PAUSED', ADZONE_TRANSITIONS) // OK
//   assertTransition('ARCHIVED', 'ACTIVE', ADZONE_TRANSITIONS) // throws
export function assertTransition<Status extends string>(
  current: Status,
  next: Status,
  allowedTransitions: Record<Status, Status[]>,
) {
  if (current === next) {
    throw new BadRequestException(`Already in ${current} status`);
  }

  const allowedNextStatuses = allowedTransitions[current] ?? [];

  if (!allowedNextStatuses.includes(next)) {
    throw new BadRequestException(`Cannot move from ${current} to ${next}`);
  }
}
