import type { OnboardingStep } from '@league/contracts';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@league/ui';
import Link from 'next/link';

import { messages } from '@/config/i18n';

const t = messages.onboarding;

/** Guides the user through what is still missing to compete. */
export function OnboardingCard({ missing }: { missing: readonly OnboardingStep[] }) {
  if (missing.length === 0) return null;
  const profileSteps = missing.filter((step) => step !== 'riot_account');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="list-disc pl-5 text-sm">
          {missing.map((step) => (
            <li key={step}>{t.steps[step]}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {profileSteps.length > 0 && (
            <Button asChild size="sm">
              <Link href="/app/perfil">{t.goToProfile}</Link>
            </Button>
          )}
          {missing.includes('riot_account') && (
            <Button asChild size="sm" variant="secondary">
              <Link href="/app/riot">{t.goToRiot}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
