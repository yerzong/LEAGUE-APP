import { DEFAULT_PRIVACY } from '@league/contracts';
import {
  Card,
  CardContent,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import {
  getMyPrivacy,
  getMyPrivateData,
  getMyProfile,
  getMySocialLinks,
} from '@/features/profile/api';
import { AvatarUploader } from '@/features/profile/components/avatar-uploader';
import { OnboardingCard } from '@/features/profile/components/onboarding-card';
import { PrivacyForm } from '@/features/profile/components/privacy-form';
import { PrivateDataForm } from '@/features/profile/components/private-data-form';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { SocialLinksForm } from '@/features/profile/components/social-links-form';
import { LoadError } from '@/features/shell/load-error';

export const metadata: Metadata = { title: messages.profile.title };

const t = messages.profile;

export default async function ProfilePage() {
  const [profile, privateData, privacy, links] = await Promise.all([
    getMyProfile(),
    getMyPrivateData(),
    getMyPrivacy(),
    getMySocialLinks(),
  ]);
  if (!profile.ok) return <LoadError code={profile.code} />;
  if (!privateData.ok) return <LoadError code={privateData.code} />;
  if (!privacy.ok) return <LoadError code={privacy.code} />;
  if (!links.ok) return <LoadError code={links.code} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={t.description} />
      <OnboardingCard missing={profile.data.missing} />
      <Tabs defaultValue="public">
        <TabsList>
          <TabsTrigger value="public">{t.tabs.public}</TabsTrigger>
          <TabsTrigger value="photo">{t.tabs.photo}</TabsTrigger>
          <TabsTrigger value="social">{t.tabs.social}</TabsTrigger>
          <TabsTrigger value="privacy">{t.tabs.privacy}</TabsTrigger>
          <TabsTrigger value="private">{t.tabs.private}</TabsTrigger>
        </TabsList>
        <Card className="mt-4">
          <CardContent>
            <TabsContent value="public">
              <ProfileForm profile={profile.data} />
            </TabsContent>
            <TabsContent value="photo">
              <AvatarUploader
                avatarUrl={profile.data.avatarUrl}
                name={profile.data.displayName ?? profile.data.username}
              />
            </TabsContent>
            <TabsContent value="social">
              <SocialLinksForm initial={links.data} />
            </TabsContent>
            <TabsContent value="privacy">
              <PrivacyForm initial={{ ...DEFAULT_PRIVACY, ...privacy.data }} />
            </TabsContent>
            <TabsContent value="private">
              <PrivateDataForm initial={privateData.data} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
