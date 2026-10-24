import { InvalidFormatConfigError, UnknownFormatError } from '../errors.js';
import { groups, type GroupsConfig } from './groups.js';
import { doubleRoundRobin, roundRobin, type RoundRobinConfig } from './round-robin.js';
import { singleElimination, type SingleEliminationConfig } from './single-elimination.js';
import type { PhaseFormatStrategy } from './strategy.js';

/**
 * Config type of each built-in format, keyed by `phases.format`. A new format
 * extends this interface (declaration merging) and registers its strategy.
 */
export interface PhaseFormatConfigs {
  round_robin: RoundRobinConfig;
  double_round_robin: RoundRobinConfig;
  groups: GroupsConfig;
  single_elimination: SingleEliminationConfig;
}

export type PhaseFormat = keyof PhaseFormatConfigs;

export class PhaseFormatRegistry {
  private readonly strategies = new Map<string, PhaseFormatStrategy<never>>();

  register(strategy: PhaseFormatStrategy<never>): this {
    if (this.strategies.has(strategy.format)) {
      throw new InvalidFormatConfigError(`Format ${strategy.format} is already registered`, {
        field: 'format',
        value: strategy.format,
      });
    }
    this.strategies.set(strategy.format, strategy);
    return this;
  }

  get<F extends PhaseFormat>(format: F): PhaseFormatStrategy<PhaseFormatConfigs[F]>;
  /** For formats read from data: the strategy validates the config at runtime. */
  get(format: string): PhaseFormatStrategy;
  get(format: string): PhaseFormatStrategy<never> {
    const strategy = this.strategies.get(format);
    if (!strategy) {
      throw new UnknownFormatError(`Unknown phase format: ${format}`, { format });
    }
    return strategy;
  }

  formats(): string[] {
    return [...this.strategies.keys()];
  }
}

export function createFormatRegistry(): PhaseFormatRegistry {
  return new PhaseFormatRegistry()
    .register(roundRobin)
    .register(doubleRoundRobin)
    .register(groups)
    .register(singleElimination);
}
