import { BadRequestException } from '@nestjs/common';

import { assertTransition } from './status-transition.util';

describe('assertTransition', () => {
  const rules: Record<'A' | 'B' | 'C', ('A' | 'B' | 'C')[]> = {
    A: ['B'],
    B: ['C'],
    C: [],
  };

  it('allows a move that is in the allowed list', () => {
    expect(() => assertTransition('A', 'B', rules)).not.toThrow();
  });

  it('rejects a move that is not in the allowed list', () => {
    expect(() => assertTransition('A', 'C', rules)).toThrow(
      BadRequestException,
    );
  });

  it('rejects moving to the same status', () => {
    expect(() => assertTransition('A', 'A', rules)).toThrow(
      BadRequestException,
    );
  });

  it('rejects any move out of a terminal status', () => {
    expect(() => assertTransition('C', 'A', rules)).toThrow(
      BadRequestException,
    );
  });
});
