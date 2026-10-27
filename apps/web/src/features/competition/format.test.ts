import { describe, expect, it } from 'vitest';

import { matchLabel, roundTitle, signed, slotName, tiebreakNote } from './format';

const single = { format: 'single_elimination' as const };

describe('round titles', () => {
  it('names elimination rounds from the end of the bracket', () => {
    const at = (round: number) =>
      roundTitle(single, { round, bracketSide: null, bracketKey: `r${String(round)}-m1` }, 3);
    expect([at(1), at(2), at(3)]).toEqual(['Cuartos de final', 'Semifinales', 'Final']);
    expect(roundTitle(single, { round: 3, bracketSide: null, bracketKey: 'third-place' }, 3)).toBe(
      'Tercer lugar',
    );
  });

  it('numbers table rounds and names the grand final', () => {
    expect(
      roundTitle(
        { format: 'round_robin' },
        { round: 2, bracketSide: null, bracketKey: 'r2-m1' },
        3,
      ),
    ).toBe('Ronda 2');
    expect(
      roundTitle(
        { format: 'double_elimination' },
        { round: 1, bracketSide: 'final', bracketKey: 'gf-1' },
        1,
      ),
    ).toBe('Gran final');
  });
});

describe('slots and labels', () => {
  const matches = [{ bracketKey: 'r1-m2', round: 1, position: 2 }];

  it('says where an empty slot comes from', () => {
    expect(matchLabel({ round: 1, position: 2 })).toBe('R1-P2');
    expect(slotName(matches, { bracketKey: 'r1-m2', outcome: 'winner' })).toBe('Ganador de R1-P2');
    expect(slotName(matches, { bracketKey: 'r1-m2', outcome: 'loser' })).toBe('Perdedor de R1-P2');
    expect(slotName(matches, null)).toBe('Por definir');
  });
});

describe('tiebreak note', () => {
  it('lists the criteria that ordered a tie, or flags an unresolved one', () => {
    expect(
      tiebreakNote({
        tiebreaks: [
          { criterion: 'head_to_head', value: 3, among: [] },
          { criterion: 'game_diff', value: 2, among: [] },
        ],
        tiedWith: [],
      }),
    ).toBe('Desempate: Resultado directo (3), Diferencia de partidas (+2)');
    expect(tiebreakNote({ tiebreaks: [], tiedWith: [] })).toBeNull();
    expect(tiebreakNote({ tiebreaks: [], tiedWith: ['x'] })).toContain('sin resolver');
    expect(signed(2)).toBe('+2');
    expect(signed(-1)).toBe('-1');
  });
});
