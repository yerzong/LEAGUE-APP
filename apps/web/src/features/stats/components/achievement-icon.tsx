import type { AchievementIcon as Icon } from '@league/contracts';
import {
  CrownIcon,
  EyeIcon,
  FlameIcon,
  ShieldIcon,
  StarIcon,
  SwordsIcon,
  TargetIcon,
  TrophyIcon,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<Icon, LucideIcon> = {
  trophy: TrophyIcon,
  flame: FlameIcon,
  swords: SwordsIcon,
  eye: EyeIcon,
  crown: CrownIcon,
  star: StarIcon,
  target: TargetIcon,
  shield: ShieldIcon,
};

export function AchievementIcon({ icon, className }: { icon: Icon; className?: string }) {
  const Component = ICONS[icon];
  return <Component aria-hidden className={className} />;
}
