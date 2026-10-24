import type { AdminClient } from './database/supabase-admin.js';

/** The tenant of the current request. One organization for now (DEFAULT_ORGANIZATION_SLUG). */
export interface CurrentOrganization {
  id(): Promise<string>;
}

export const CURRENT_ORGANIZATION = Symbol('CurrentOrganization');

export class SlugOrganization implements CurrentOrganization {
  private cached: Promise<string> | null = null;

  constructor(
    private readonly client: AdminClient,
    private readonly slug: string,
  ) {}

  id(): Promise<string> {
    this.cached ??= this.resolve().catch((error: unknown) => {
      this.cached = null;
      throw error;
    });
    return this.cached;
  }

  private async resolve(): Promise<string> {
    const { data, error } = await this.client
      .from('organizations')
      .select('id')
      .eq('slug', this.slug)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !data) throw new Error(`Organization ${this.slug} not found`);
    return data.id;
  }
}
