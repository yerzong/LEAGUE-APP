'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { messages } from '@/config/i18n';
import { browserSupabase } from '@/lib/supabase/browser';

/**
 * Supabase Realtime: when a match, the standings or the stats of the tournament change,
 * the page re-renders from the server (a single refresh per burst of changes).
 */
export function LiveRefresh({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = browserSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
      }, 400);
    };
    const filter = `tournament_id=eq.${tournamentId}`;
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'standings', filter }, refresh)
      // m09: the stats of a closed match land a few seconds after it.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'champion_meta_stats', filter },
        refresh,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router, tournamentId]);

  return (
    <p className="flex items-center gap-2 text-xs text-text-muted" aria-live="polite">
      <span aria-hidden className="size-2 animate-pulse rounded-full bg-success" />
      {messages.competition.board.live}
    </p>
  );
}
