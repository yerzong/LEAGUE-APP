// Explicit state machines: state + event (+ context for the guards) → new state.

import { InvalidTransitionError, TransitionGuardError } from '../errors.js';

type EventOf<E extends { type: string }, K extends E['type']> = Extract<E, { type: K }>;

export interface Transition<S extends string, E extends { type: string }, C> {
  readonly from: readonly S[];
  readonly to: S;
  /** Returns a failure reason, or `null` when the transition may happen. */
  readonly guard?: (context: C, event: E, from: S) => string | null;
}

export type TransitionTable<S extends string, E extends { type: string }, C> = {
  readonly [K in E['type']]: Transition<S, EventOf<E, K>, C>;
};

export interface StateMachine<S extends string, E extends { type: string }, C> {
  readonly name: string;
  /** Throws `InvalidTransitionError` or `TransitionGuardError`. */
  transition(state: S, event: E, context: C): S;
  can(state: S, event: E, context: C): boolean;
  /** Events whose `from` includes `state` (guards not evaluated). */
  availableEvents(state: S): E['type'][];
}

export function createStateMachine<S extends string, E extends { type: string }, C>(
  name: string,
  table: TransitionTable<S, E, C>,
): StateMachine<S, E, C> {
  const definitionOf = (event: E) => table[event.type as E['type']] as Transition<S, E, C>;

  const transition = (state: S, event: E, context: C): S => {
    const definition = definitionOf(event);
    const details = { machine: name, from: state, event: event.type };
    if (!definition.from.includes(state)) {
      throw new InvalidTransitionError(`${name}: cannot ${event.type} from ${state}`, details);
    }
    const reason = definition.guard?.(context, event, state) ?? null;
    if (reason !== null) {
      throw new TransitionGuardError(`${name}: ${event.type} rejected (${reason})`, {
        ...details,
        reason,
      });
    }
    return definition.to;
  };

  return {
    name,
    transition,
    can: (state, event, context) => {
      const definition = definitionOf(event);
      return (
        definition.from.includes(state) &&
        (definition.guard?.(context, event, state) ?? null) === null
      );
    },
    availableEvents: (state) =>
      (Object.keys(table) as E['type'][]).filter((type) =>
        (table[type] as Transition<S, E, C>).from.includes(state),
      ),
  };
}
