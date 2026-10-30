'use client';

import {
  DISCORD_CHANNEL_PURPOSES,
  DISCORD_FEATURES,
  type DiscordChannelPurpose,
  type DiscordConfig,
  type DiscordFeature,
} from '@league/contracts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  toast,
} from '@league/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { messages } from '@/config/i18n';

import { saveDiscordGuild, setDiscordChannel } from '../actions';

const d = messages.discord;

export function DiscordConfigForm({ config }: { config: DiscordConfig }) {
  const router = useRouter();
  const fieldId = useId();
  const [guildId, setGuildId] = useState(config.guildId ?? '');
  const [guildName, setGuildName] = useState(config.guildName ?? '');
  const [verifiedRoleId, setVerifiedRoleId] = useState(config.verifiedRoleId ?? '');
  const [features, setFeatures] = useState<Partial<Record<DiscordFeature, boolean>>>(
    config.features,
  );
  const [pending, setPending] = useState(false);

  const saveGuild = async () => {
    setPending(true);
    const result = await saveDiscordGuild({
      guildId,
      guildName: guildName || undefined,
      features,
      verifiedRoleId: verifiedRoleId || null,
    });
    setPending(false);
    if (result.ok) {
      toast.success(d.actions.saved);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{d.guild.heading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={config.connected ? 'success' : 'blue'}>
              {config.connected
                ? d.status.connected.replace('{guild}', config.guildName ?? config.guildId ?? '')
                : d.status.disconnected}
            </Badge>
            <Badge variant={config.botReady ? 'success' : 'warning'}>
              {config.botReady ? d.status.botReady : d.status.botMissing}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${fieldId}-guild`}>{d.guild.guildId}</Label>
              <Input
                id={`${fieldId}-guild`}
                value={guildId}
                inputMode="numeric"
                onChange={(e) => {
                  setGuildId(e.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${fieldId}-name`}>{d.guild.guildName}</Label>
              <Input
                id={`${fieldId}-name`}
                value={guildName}
                onChange={(e) => {
                  setGuildName(e.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${fieldId}-role`}>{d.guild.verifiedRole}</Label>
              <Input
                id={`${fieldId}-role`}
                value={verifiedRoleId}
                inputMode="numeric"
                onChange={(e) => {
                  setVerifiedRoleId(e.target.value);
                }}
              />
            </div>
          </div>
          <p className="text-sm text-text-muted">{d.guild.help}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{d.features.heading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {DISCORD_FEATURES.map((feature) => (
            <div key={feature} className="flex items-center justify-between gap-4">
              <Label htmlFor={`${fieldId}-${feature}`}>{d.features[feature]}</Label>
              <Switch
                id={`${fieldId}-${feature}`}
                checked={features[feature] ?? false}
                onCheckedChange={(checked) => {
                  setFeatures((prev) => ({ ...prev, [feature]: checked }));
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => void saveGuild()} disabled={pending || guildId === ''}>
          {d.actions.save}
        </Button>
      </div>

      {config.connected && (
        <Card>
          <CardHeader>
            <CardTitle>{d.channels.heading}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {DISCORD_CHANNEL_PURPOSES.map((purpose) => (
              <ChannelRow
                key={purpose}
                purpose={purpose}
                value={config.channels.find((c) => c.purpose === purpose)?.channelId ?? ''}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{d.commands.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-sm text-text-muted">{d.commands.list}</code>
        </CardContent>
      </Card>
    </div>
  );
}

function ChannelRow({ purpose, value }: { purpose: DiscordChannelPurpose; value: string }) {
  const router = useRouter();
  const id = useId();
  const [channelId, setChannelId] = useState(value);
  const [pending, setPending] = useState(false);

  const save = async (next: string | null) => {
    setPending(true);
    const result = await setDiscordChannel({ purpose, channelId: next });
    setPending(false);
    if (result.ok) {
      toast.success(d.actions.saved);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-1 flex-col gap-1">
        <Label htmlFor={id}>{d.channels[purpose]}</Label>
        <Input
          id={id}
          value={channelId}
          inputMode="numeric"
          placeholder={d.channels.placeholder}
          onChange={(e) => {
            setChannelId(e.target.value);
          }}
        />
      </div>
      <Button variant="secondary" disabled={pending} onClick={() => void save(channelId || null)}>
        {d.actions.saveChannel}
      </Button>
      {value !== '' && (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setChannelId('');
            void save(null);
          }}
        >
          {d.channels.clear}
        </Button>
      )}
    </div>
  );
}
