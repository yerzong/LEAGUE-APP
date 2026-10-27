import { DEFAULT_TOURNAMENT_CONFIG, defaultPhase, type TournamentConfig } from '@league/contracts';
import { createFormatRegistry } from '@league/core';
import { describe, expect, it } from 'vitest';

import { ApplicationError } from '../../../shared/application-error.js';
import { FakeImageStorage, PNG_BYTES } from '../../identity/testing/fake-image-storage.js';
import {
  InMemoryTemplateRepository,
  InMemoryTournamentRepository,
} from '../testing/in-memory-tournament-repository.js';
import type { TournamentsDeps } from './deps.js';
import {
  CreateTemplateUseCase,
  CreateTournamentUseCase,
  DeleteTemplateUseCase,
  GetTournamentAuditUseCase,
  GetTournamentUseCase,
  ListTemplatesUseCase,
  ListTournamentsUseCase,
  PublishRulebookVersionUseCase,
  RunTournamentActionUseCase,
  SaveRulebookDraftUseCase,
  UpdateTournamentUseCase,
  UploadTournamentCoverUseCase,
} from './tournaments.use-cases.js';

const ORG = 'org-1';
const ADMIN = 'admin';
const PLAYER = 'player';

/** A config that can be published: dates, capacity and a group stage. */
const ready: TournamentConfig = {
  ...DEFAULT_TOURNAMENT_CONFIG,
  basics: { ...DEFAULT_TOURNAMENT_CONFIG.basics, name: 'Copa Relámpago' },
  capacity: { capacity: 8, waitlistEnabled: true },
  schedule: {
    ...DEFAULT_TOURNAMENT_CONFIG.schedule,
    registrationOpensAt: '2026-11-01T00:00:00.000Z',
    registrationClosesAt: '2026-11-10T00:00:00.000Z',
    startsAt: '2026-11-14T18:00:00.000Z',
  },
  format: {
    seedingMethod: 'random',
    phases: [
      { ...defaultPhase('groups', 'Grupos'), advance: 2 },
      defaultPhase('single_elimination', 'Playoffs'),
    ],
  },
};

function setup() {
  const now = new Date('2026-10-26T12:00:00.000Z');
  const tournaments = new InMemoryTournamentRepository(() => now);
  const templates = new InMemoryTemplateRepository(() => now);
  const storage = new FakeImageStorage();
  let id = 0;
  const deps: TournamentsDeps = {
    tournaments,
    templates,
    staff: {
      isStaff: (userId) => Promise.resolve(userId === ADMIN),
      summaries: (ids) =>
        Promise.resolve(
          new Map(ids.map((u) => [u, { username: u, displayName: u.toUpperCase() }])),
        ),
    },
    organization: { id: () => Promise.resolve(ORG) },
    storage,
    clock: { now: () => now },
    formats: createFormatRegistry(),
    newId: () => {
      id += 1;
      return `file-${String(id)}`;
    },
  };
  return { deps, tournaments, templates, storage };
}

async function rejects(promise: Promise<unknown>, code: string) {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Error);
  const actual =
    error instanceof ApplicationError
      ? error.code
      : ((error as { details?: { reason?: string } }).details?.reason ??
        (error as { code?: string }).code);
  expect(actual).toBe(code);
  return error;
}

async function published(deps: TournamentsDeps) {
  const created = await new CreateTournamentUseCase(deps).execute(ADMIN, {
    config: ready,
    templateId: null,
  });
  await new SaveRulebookDraftUseCase(deps).execute(ADMIN, created.id, {
    title: 'Reglamento',
    content: '# Reglas del relámpago',
    changeSummary: null,
  });
  return new RunTournamentActionUseCase(deps).execute(ADMIN, created.id, 'publish', {
    reason: null,
  });
}

describe('staff permissions', () => {
  it('only staff manages tournaments and templates', async () => {
    const { deps } = setup();
    await rejects(new ListTournamentsUseCase(deps).execute(PLAYER), 'staff_only');
    await rejects(
      new CreateTournamentUseCase(deps).execute(PLAYER, { config: ready, templateId: null }),
      'staff_only',
    );
    await rejects(new ListTemplatesUseCase(deps).execute(PLAYER), 'staff_only');
  });
});

describe('CreateTournamentUseCase', () => {
  it('saves a draft with a unique slug and says what is missing to publish', async () => {
    const { deps } = setup();
    const create = new CreateTournamentUseCase(deps);
    const first = await create.execute(ADMIN, {
      config: DEFAULT_TOURNAMENT_CONFIG,
      templateId: null,
    });
    const second = await create.execute(ADMIN, {
      config: DEFAULT_TOURNAMENT_CONFIG,
      templateId: null,
    });

    expect(first).toMatchObject({
      slug: 'nuevo-torneo',
      status: 'draft',
      actions: ['publish', 'cancel'],
    });
    expect(second.slug).toBe('nuevo-torneo-2');
    expect(Object.values(first.editPolicy).every((mode) => mode === 'free')).toBe(true);
    expect(first.publishIssues).toEqual([
      'rulebook_required',
      'registration_window_required',
      'start_date_required',
    ]);
    expect(first.preview).toEqual({
      shapes: [{ entrants: 16, rounds: 4, matches: 15, groups: [] }],
      error: null,
    });
  });

  it('previews the structure and flags a format that cannot be played', async () => {
    const { deps } = setup();
    const broken: TournamentConfig = {
      ...ready,
      capacity: { capacity: 6, waitlistEnabled: true },
      format: { ...ready.format, phases: [{ ...defaultPhase('groups', 'Grupos'), groupCount: 4 }] },
    };
    const detail = await new CreateTournamentUseCase(deps).execute(ADMIN, {
      config: broken,
      templateId: null,
    });
    expect(detail.preview).toEqual({ shapes: [], error: 'invalid_format_config' });
    expect(detail.publishIssues).toContain('invalid_format');
  });
});

describe('publishing', () => {
  it('refuses an incomplete draft with the list of issues', async () => {
    const { deps } = setup();
    const draft = await new CreateTournamentUseCase(deps).execute(ADMIN, {
      config: ready,
      templateId: null,
    });
    const error = await rejects(
      new RunTournamentActionUseCase(deps).execute(ADMIN, draft.id, 'publish', { reason: null }),
      'publish_incomplete',
    );
    expect((error as ApplicationError).details).toEqual({ issues: ['rulebook_required'] });
  });

  it('creates the empty phases and groups, freezes the rulebook, audits and emits', async () => {
    const { deps, tournaments } = setup();
    const detail = await published(deps);

    expect(detail.status).toBe('published');
    expect(detail.phases.map((p) => [p.name, p.format, p.groups.map((g) => g.name)])).toEqual([
      ['Grupos', 'groups', ['A', 'B']],
      ['Playoffs', 'single_elimination', []],
    ]);
    expect(detail.rulebook?.current?.version).toBe(1);
    expect(detail.rulebook?.draft).toBeNull();
    expect(detail.actions).toEqual(['open_registration', 'cancel']);
    expect(tournaments.audit.map((a) => a.action)).toEqual(['tournament.published']);
    expect(tournaments.events).toContain('tournament.published');
  });
});

describe('UpdateTournamentUseCase (docs/14 §3.2)', () => {
  it('edits a draft freely without auditing', async () => {
    const { deps, tournaments } = setup();
    const draft = await new CreateTournamentUseCase(deps).execute(ADMIN, {
      config: ready,
      templateId: null,
    });
    const updated = await new UpdateTournamentUseCase(deps).execute(ADMIN, draft.id, {
      config: { ...ready, eligibility: { ...ready.eligibility, rules: [] } },
      confirm: false,
      reason: null,
    });
    expect(updated.config.eligibility.rules).toEqual([]);
    expect(updated.slug).toBe(draft.slug);
    expect(tournaments.audit).toEqual([]);
  });

  it('asks for confirmation to change eligibility or format once published', async () => {
    const { deps, tournaments } = setup();
    const detail = await published(deps);
    const update = new UpdateTournamentUseCase(deps);
    const stricter = { ...ready, eligibility: { ...ready.eligibility, rules: [] } };

    const error = await rejects(
      update.execute(ADMIN, detail.id, { config: stricter, confirm: false, reason: null }),
      'confirmation_required',
    );
    expect((error as ApplicationError).details).toEqual({ sections: ['eligibility'] });

    await update.execute(ADMIN, detail.id, { config: stricter, confirm: true, reason: 'Ajuste' });
    expect(tournaments.audit.at(-1)).toMatchObject({
      action: 'tournament.config.updated',
      sections: ['eligibility'],
      reason: 'Ajuste',
    });
    expect(tournaments.events.at(-1)).toBe('tournament.rules_changed');
  });

  it('keeps texts and dates free after publishing and regenerates the phases on a format change', async () => {
    const { deps, tournaments } = setup();
    const detail = await published(deps);
    const update = new UpdateTournamentUseCase(deps);

    const renamed = await update.execute(ADMIN, detail.id, {
      config: { ...ready, basics: { ...ready.basics, description: 'Nueva descripción' } },
      confirm: false,
      reason: null,
    });
    expect(renamed.config.basics.description).toBe('Nueva descripción');
    expect(tournaments.events.at(-1)).toBe('tournament.updated');

    const single = await update.execute(ADMIN, detail.id, {
      config: {
        ...renamed.config,
        format: { ...ready.format, phases: [defaultPhase('single_elimination', 'Directo')] },
      },
      confirm: true,
      reason: null,
    });
    expect(single.phases.map((p) => p.name)).toEqual(['Directo']);
  });

  it('refuses locked sections and an unpublishable format after publishing', async () => {
    const { deps, tournaments } = setup();
    const detail = await published(deps);
    const update = new UpdateTournamentUseCase(deps);
    await rejects(
      update.execute(ADMIN, detail.id, {
        config: {
          ...ready,
          format: { ...ready.format, phases: [{ ...defaultPhase('groups', 'G'), groupCount: 8 }] },
        },
        confirm: true,
        reason: null,
      }),
      'invalid_format',
    );
    tournaments.setStatus(detail.id, 'in_progress');
    await rejects(
      update.execute(ADMIN, detail.id, {
        config: { ...ready, eligibility: { ...ready.eligibility, rules: [] } },
        confirm: true,
        reason: null,
      }),
      'section_locked',
    );
  });
});

describe('RunTournamentActionUseCase', () => {
  it('opens and closes registration through the core lifecycle', async () => {
    const { deps, tournaments } = setup();
    const detail = await published(deps);
    const run = new RunTournamentActionUseCase(deps);
    await rejects(
      run.execute(ADMIN, detail.id, 'close_registration', { reason: null }),
      'invalid_transition',
    );
    const open = await run.execute(ADMIN, detail.id, 'open_registration', { reason: null });
    expect(open.status).toBe('registration_open');
    expect(open.actions).toEqual(['close_registration', 'cancel']);
    const closed = await run.execute(ADMIN, detail.id, 'close_registration', { reason: null });
    expect(closed.status).toBe('registration_closed');
    expect(tournaments.events).toEqual(
      expect.arrayContaining(['tournament.registration_opened', 'tournament.registration_closed']),
    );
  });

  it('needs a reason to cancel, and audits it', async () => {
    const { deps, tournaments } = setup();
    const detail = await published(deps);
    const run = new RunTournamentActionUseCase(deps);
    await rejects(run.execute(ADMIN, detail.id, 'cancel', { reason: 'no' }), 'reason_required');
    const canceled = await run.execute(ADMIN, detail.id, 'cancel', {
      reason: 'Sin equipos suficientes',
    });
    expect(canceled.status).toBe('canceled');
    expect(canceled.actions).toEqual(['archive']);
    expect(tournaments.audit.at(-1)).toMatchObject({
      action: 'tournament.canceled',
      reason: 'Sin equipos suficientes',
    });
  });
});

describe('rulebook versions', () => {
  it('publishes a new version only after the tournament is published', async () => {
    const { deps } = setup();
    const draft = await new CreateTournamentUseCase(deps).execute(ADMIN, {
      config: ready,
      templateId: null,
    });
    const save = new SaveRulebookDraftUseCase(deps);
    const publishVersion = new PublishRulebookVersionUseCase(deps);
    await save.execute(ADMIN, draft.id, {
      title: 'Reglamento',
      content: 'v1',
      changeSummary: null,
    });
    await rejects(publishVersion.execute(ADMIN, draft.id), 'tournament_not_published');

    const detail = await published(deps);
    await save.execute(ADMIN, detail.id, {
      title: 'Reglamento',
      content: 'v2',
      changeSummary: 'Pausas',
    });
    const withDraft = await new GetTournamentUseCase(deps).execute(ADMIN, detail.id);
    expect(withDraft.rulebook?.draft?.version).toBe(2);
    const after = await publishVersion.execute(ADMIN, detail.id);
    expect(after.rulebook?.current).toMatchObject({ version: 2, changeSummary: 'Pausas' });
    expect(after.rulebook?.versions.map((v) => v.version)).toEqual([1, 2]);
  });
});

describe('covers, audit trail and templates', () => {
  it('replaces the cover image', async () => {
    const { deps, storage } = setup();
    const draft = await new CreateTournamentUseCase(deps).execute(ADMIN, {
      config: ready,
      templateId: null,
    });
    const upload = new UploadTournamentCoverUseCase(deps);
    const file = { buffer: PNG_BYTES, mimetype: 'image/png', size: PNG_BYTES.length };
    await upload.execute(ADMIN, draft.id, file);
    const second = await upload.execute(ADMIN, draft.id, file);
    expect(second.coverUrl).toBe(`https://storage.test/tournament-covers/${draft.id}/file-2.png`);
    expect(storage.removed).toEqual([`tournament-covers/${draft.id}/file-1.png`]);
  });

  it('lists the audit trail with the actors', async () => {
    const { deps } = setup();
    const detail = await published(deps);
    const trail = await new GetTournamentAuditUseCase(deps).execute(ADMIN, detail.id);
    expect(trail[0]).toMatchObject({
      action: 'tournament.published',
      actor: { username: ADMIN, displayName: 'ADMIN' },
    });
  });

  it('saves, lists and deletes templates with unique names', async () => {
    const { deps } = setup();
    const create = new CreateTemplateUseCase(deps);
    const template = await create.execute(ADMIN, { name: 'Relámpago 5v5', config: ready });
    await rejects(
      create.execute(ADMIN, { name: 'relámpago 5v5', config: ready }),
      'template_name_taken',
    );
    expect((await new ListTemplatesUseCase(deps).execute(ADMIN)).map((t) => t.name)).toEqual([
      'Relámpago 5v5',
    ]);

    const fromTemplate = await new CreateTournamentUseCase(deps).execute(ADMIN, {
      config: template.config,
      templateId: template.id,
    });
    expect(fromTemplate.templateId).toBe(template.id);

    await new DeleteTemplateUseCase(deps).execute(ADMIN, template.id);
    expect(await new ListTemplatesUseCase(deps).execute(ADMIN)).toEqual([]);
    await rejects(
      new DeleteTemplateUseCase(deps).execute(ADMIN, template.id),
      'template_not_found',
    );
  });

  it('lists tournaments for staff, newest first', async () => {
    const { deps } = setup();
    await published(deps);
    const list = await new ListTournamentsUseCase(deps).execute(ADMIN);
    expect(list.map((t) => [t.name, t.status])).toEqual([['Copa Relámpago', 'published']]);
  });
});
