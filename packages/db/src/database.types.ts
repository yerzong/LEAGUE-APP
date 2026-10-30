export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          criteria: Json
          description: string
          icon: string
          icon_media_id: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          organization_id: string | null
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          criteria: Json
          description: string
          icon?: string
          icon_media_id?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          organization_id?: string | null
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          criteria?: Json
          description?: string
          icon?: string
          icon_media_id?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          organization_id?: string | null
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achievements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: unknown
          organization_id: string | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: unknown
          organization_id?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: unknown
          organization_id?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      champion_meta_stats: {
        Row: {
          bans: number
          champion_id: number
          picks: number
          tournament_id: string
          updated_at: string
          wins: number
        }
        Insert: {
          bans?: number
          champion_id: number
          picks?: number
          tournament_id: string
          updated_at?: string
          wins?: number
        }
        Update: {
          bans?: number
          champion_id?: number
          picks?: number
          tournament_id?: string
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "champion_meta_stats_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      circuit_tournaments: {
        Row: {
          circuit_id: string
          created_at: string
          tournament_id: string
          weight: number
        }
        Insert: {
          circuit_id: string
          created_at?: string
          tournament_id: string
          weight?: number
        }
        Update: {
          circuit_id?: string
          created_at?: string
          tournament_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "circuit_tournaments_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circuit_tournaments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      circuits: {
        Row: {
          created_at: string
          description: string | null
          exclusivity_scope: Database["public"]["Enums"]["exclusivity_scope"]
          id: string
          name: string
          organization_id: string
          points_config: Json
          season_id: string | null
          status: Database["public"]["Enums"]["circuit_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          exclusivity_scope?: Database["public"]["Enums"]["exclusivity_scope"]
          id?: string
          name: string
          organization_id: string
          points_config?: Json
          season_id?: string | null
          status?: Database["public"]["Enums"]["circuit_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          exclusivity_scope?: Database["public"]["Enums"]["exclusivity_scope"]
          id?: string
          name?: string
          organization_id?: string
          points_config?: Json
          season_id?: string | null
          status?: Database["public"]["Enums"]["circuit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circuits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circuits_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          club_role: Database["public"]["Enums"]["club_role"]
          created_at: string
          id: string
          joined_at: string
          left_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          club_role: Database["public"]["Enums"]["club_role"]
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          club_role?: Database["public"]["Enums"]["club_role"]
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          banner_media_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          logo_media_id: string | null
          name: string
          organization_id: string
          owner_user_id: string
          slug: string
          social_links: Json
          status: Database["public"]["Enums"]["club_status"]
          tag: string
          updated_at: string
          verified_at: string | null
          website: string | null
        }
        Insert: {
          banner_media_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_media_id?: string | null
          name: string
          organization_id: string
          owner_user_id: string
          slug: string
          social_links?: Json
          status?: Database["public"]["Enums"]["club_status"]
          tag: string
          updated_at?: string
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          banner_media_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_media_id?: string | null
          name?: string
          organization_id?: string
          owner_user_id?: string
          slug?: string
          social_links?: Json
          status?: Database["public"]["Enums"]["club_status"]
          tag?: string
          updated_at?: string
          verified_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_channel_links: {
        Row: {
          channel_id: string
          created_at: string
          guild_id: string
          id: string
          purpose: Database["public"]["Enums"]["discord_channel_purpose"]
          tournament_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          guild_id: string
          id?: string
          purpose: Database["public"]["Enums"]["discord_channel_purpose"]
          tournament_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          guild_id?: string
          id?: string
          purpose?: Database["public"]["Enums"]["discord_channel_purpose"]
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discord_channel_links_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "discord_guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discord_channel_links_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_guilds: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          installed_by: string | null
          is_active: boolean
          name: string | null
          organization_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          installed_by?: string | null
          is_active?: boolean
          name?: string | null
          organization_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          installed_by?: string | null
          is_active?: boolean
          name?: string | null
          organization_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_guilds_installed_by_fkey"
            columns: ["installed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discord_guilds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_temp_channels: {
        Row: {
          channel_id: string
          created_at: string
          deleted_at: string | null
          entrant_id: string | null
          guild_id: string
          id: string
          match_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          entrant_id?: string | null
          guild_id: string
          id?: string
          match_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          entrant_id?: string | null
          guild_id?: string
          id?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_temp_channels_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discord_temp_channels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "discord_guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discord_temp_channels_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_evidence: {
        Row: {
          added_by: string
          created_at: string
          dispute_id: string
          id: string
          note: string | null
          storage_path: string | null
          url: string | null
        }
        Insert: {
          added_by: string
          created_at?: string
          dispute_id: string
          id?: string
          note?: string | null
          storage_path?: string | null
          url?: string | null
        }
        Update: {
          added_by?: string
          created_at?: string
          dispute_id?: string
          id?: string
          note?: string | null
          storage_path?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["dispute_category"]
          created_at: string
          description: string
          game_id: string | null
          id: string
          match_id: string
          opened_by_entrant_id: string | null
          opened_by_user_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["dispute_category"]
          created_at?: string
          description: string
          game_id?: string | null
          id?: string
          match_id: string
          opened_by_entrant_id?: string | null
          opened_by_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["dispute_category"]
          created_at?: string
          description?: string
          game_id?: string | null
          id?: string
          match_id?: string
          opened_by_entrant_id?: string | null
          opened_by_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_opened_by_entrant_id_fkey"
            columns: ["opened_by_entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_opened_by_user_id_fkey"
            columns: ["opened_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_actions: {
        Row: {
          action: Database["public"]["Enums"]["draft_action_type"]
          champion_id: number
          created_at: string
          entrant_id: string
          game_id: string
          id: string
          sequence: number
          side: Database["public"]["Enums"]["game_side"]
        }
        Insert: {
          action: Database["public"]["Enums"]["draft_action_type"]
          champion_id: number
          created_at?: string
          entrant_id: string
          game_id: string
          id?: string
          sequence: number
          side: Database["public"]["Enums"]["game_side"]
        }
        Update: {
          action?: Database["public"]["Enums"]["draft_action_type"]
          champion_id?: number
          created_at?: string
          entrant_id?: string
          game_id?: string
          id?: string
          sequence?: number
          side?: Database["public"]["Enums"]["game_side"]
        }
        Relationships: [
          {
            foreignKeyName: "draft_actions_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_actions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_rules: {
        Row: {
          applies_to: Database["public"]["Enums"]["eligibility_target"]
          created_at: string
          id: string
          is_active: boolean
          params: Json
          position: number
          rule_type: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["eligibility_target"]
          created_at?: string
          id?: string
          is_active?: boolean
          params?: Json
          position: number
          rule_type: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["eligibility_target"]
          created_at?: string
          id?: string
          is_active?: boolean
          params?: Json
          position?: number
          rule_type?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      entrant_roster_members: {
        Row: {
          added_at: string
          created_at: string
          entrant_id: string
          exclusivity_key: string | null
          game_role: Database["public"]["Enums"]["player_role"] | null
          id: string
          removed_at: string | null
          riot_account_id: string | null
          roster_role: Database["public"]["Enums"]["roster_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          created_at?: string
          entrant_id: string
          exclusivity_key?: string | null
          game_role?: Database["public"]["Enums"]["player_role"] | null
          id?: string
          removed_at?: string | null
          riot_account_id?: string | null
          roster_role: Database["public"]["Enums"]["roster_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          created_at?: string
          entrant_id?: string
          exclusivity_key?: string | null
          game_role?: Database["public"]["Enums"]["player_role"] | null
          id?: string
          removed_at?: string | null
          riot_account_id?: string | null
          roster_role?: Database["public"]["Enums"]["roster_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entrant_roster_members_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrant_roster_members_riot_account_id_fkey"
            columns: ["riot_account_id"]
            isOneToOne: false
            referencedRelation: "riot_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrant_roster_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      entrants: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          check_eligibility_result: Json | null
          created_at: string
          display_name: string
          display_tag: string | null
          id: string
          logo_media_id: string | null
          logo_path: string | null
          payment_id: string | null
          registered_by: string
          rejection_reason: string | null
          rulebook_version_id: string | null
          seed: number | null
          status: Database["public"]["Enums"]["entrant_status"]
          team_id: string | null
          tournament_id: string
          updated_at: string
          user_id: string | null
          waitlist_position: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          check_eligibility_result?: Json | null
          created_at?: string
          display_name: string
          display_tag?: string | null
          id?: string
          logo_media_id?: string | null
          logo_path?: string | null
          payment_id?: string | null
          registered_by: string
          rejection_reason?: string | null
          rulebook_version_id?: string | null
          seed?: number | null
          status?: Database["public"]["Enums"]["entrant_status"]
          team_id?: string | null
          tournament_id: string
          updated_at?: string
          user_id?: string | null
          waitlist_position?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          check_eligibility_result?: Json | null
          created_at?: string
          display_name?: string
          display_tag?: string | null
          id?: string
          logo_media_id?: string | null
          logo_path?: string | null
          payment_id?: string | null
          registered_by?: string
          rejection_reason?: string | null
          rulebook_version_id?: string | null
          seed?: number | null
          status?: Database["public"]["Enums"]["entrant_status"]
          team_id?: string | null
          tournament_id?: string
          updated_at?: string
          user_id?: string | null
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entrants_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrants_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrants_rulebook_version_id_fkey"
            columns: ["rulebook_version_id"]
            isOneToOne: false
            referencedRelation: "rulebook_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followable_id: string
          followable_type: Database["public"]["Enums"]["followable_type"]
          follower_user_id: string
        }
        Insert: {
          created_at?: string
          followable_id: string
          followable_type: Database["public"]["Enums"]["followable_type"]
          follower_user_id: string
        }
        Update: {
          created_at?: string
          followable_id?: string
          followable_type?: Database["public"]["Enums"]["followable_type"]
          follower_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_user_id_fkey"
            columns: ["follower_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      free_agent_listings: {
        Row: {
          active_until: string
          availability: Json
          created_at: string
          id: string
          message: string | null
          organization_id: string
          rank_snapshot_id: string | null
          roles: Database["public"]["Enums"]["player_role"][]
          updated_at: string
          user_id: string
        }
        Insert: {
          active_until: string
          availability?: Json
          created_at?: string
          id?: string
          message?: string | null
          organization_id: string
          rank_snapshot_id?: string | null
          roles: Database["public"]["Enums"]["player_role"][]
          updated_at?: string
          user_id: string
        }
        Update: {
          active_until?: string
          availability?: Json
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string
          rank_snapshot_id?: string | null
          roles?: Database["public"]["Enums"]["player_role"][]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_agent_listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "free_agent_listings_rank_snapshot_id_fkey"
            columns: ["rank_snapshot_id"]
            isOneToOne: false
            referencedRelation: "riot_rank_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "free_agent_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_participants: {
        Row: {
          champion_id: number | null
          created_at: string
          entrant_id: string
          game_id: string
          game_role: Database["public"]["Enums"]["player_role"] | null
          id: string
          is_expected: boolean
          puuid: string
          riot_account_id: string | null
          side: Database["public"]["Enums"]["game_side"]
          user_id: string | null
        }
        Insert: {
          champion_id?: number | null
          created_at?: string
          entrant_id: string
          game_id: string
          game_role?: Database["public"]["Enums"]["player_role"] | null
          id?: string
          is_expected?: boolean
          puuid: string
          riot_account_id?: string | null
          side: Database["public"]["Enums"]["game_side"]
          user_id?: string | null
        }
        Update: {
          champion_id?: number | null
          created_at?: string
          entrant_id?: string
          game_id?: string
          game_role?: Database["public"]["Enums"]["player_role"] | null
          id?: string
          is_expected?: boolean
          puuid?: string
          riot_account_id?: string | null
          side?: Database["public"]["Enums"]["game_side"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_participants_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_participants_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_participants_riot_account_id_fkey"
            columns: ["riot_account_id"]
            isOneToOne: false
            referencedRelation: "riot_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_timeline_events: {
        Row: {
          actor_puuid: string | null
          created_at: string
          game_id: string
          id: string
          payload: Json
          side: Database["public"]["Enums"]["game_side"] | null
          timestamp_ms: number | null
          tournament_id: string
          type: string
        }
        Insert: {
          actor_puuid?: string | null
          created_at?: string
          game_id: string
          id?: string
          payload?: Json
          side?: Database["public"]["Enums"]["game_side"] | null
          timestamp_ms?: number | null
          tournament_id: string
          type: string
        }
        Update: {
          actor_puuid?: string | null
          created_at?: string
          game_id?: string
          id?: string
          payload?: Json
          side?: Database["public"]["Enums"]["game_side"] | null
          timestamp_ms?: number | null
          tournament_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_timeline_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_timeline_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          blue_entrant_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          game_number: number
          id: string
          match_id: string
          patch: string | null
          raw_match_payload: Json | null
          raw_timeline_payload: Json | null
          red_entrant_id: string
          result_source: Database["public"]["Enums"]["result_source"] | null
          riot_game_id: string | null
          riot_match_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["game_status"]
          updated_at: string
          winner_entrant_id: string | null
        }
        Insert: {
          blue_entrant_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          game_number: number
          id?: string
          match_id: string
          patch?: string | null
          raw_match_payload?: Json | null
          raw_timeline_payload?: Json | null
          red_entrant_id: string
          result_source?: Database["public"]["Enums"]["result_source"] | null
          riot_game_id?: string | null
          riot_match_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          winner_entrant_id?: string | null
        }
        Update: {
          blue_entrant_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          game_number?: number
          id?: string
          match_id?: string
          patch?: string | null
          raw_match_payload?: Json | null
          raw_timeline_payload?: Json | null
          red_entrant_id?: string
          result_source?: Database["public"]["Enums"]["result_source"] | null
          riot_game_id?: string | null
          riot_match_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          winner_entrant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_blue_entrant_id_fkey"
            columns: ["blue_entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_red_entrant_id_fkey"
            columns: ["red_entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_entrant_id_fkey"
            columns: ["winner_entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
          phase_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phase_id: string
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phase_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_webhooks: {
        Row: {
          error: string | null
          event_type: string
          id: string
          idempotency_key: string
          organization_id: string | null
          payload: Json
          processed_at: string | null
          received_at: string
          signature_valid: boolean
          source: string
          status: Database["public"]["Enums"]["inbound_webhook_status"]
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string
          signature_valid?: boolean
          source: string
          status?: Database["public"]["Enums"]["inbound_webhook_status"]
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string
          signature_valid?: boolean
          source?: string
          status?: Database["public"]["Enums"]["inbound_webhook_status"]
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_alerts: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          notes: string | null
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          risk_score: number | null
          severity: number
          status: Database["public"]["Enums"]["integrity_alert_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["subject_type"]
          type: Database["public"]["Enums"]["integrity_alert_type"]
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          notes?: string | null
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number | null
          severity?: number
          status?: Database["public"]["Enums"]["integrity_alert_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["subject_type"]
          type: Database["public"]["Enums"]["integrity_alert_type"]
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          notes?: string | null
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number | null
          severity?: number
          status?: Database["public"]["Enums"]["integrity_alert_status"]
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["subject_type"]
          type?: Database["public"]["Enums"]["integrity_alert_type"]
        }
        Relationships: [
          {
            foreignKeyName: "integrity_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrity_alerts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      match_checkins: {
        Row: {
          checked_in_at: string
          entrant_id: string
          id: string
          match_id: string
          method: Database["public"]["Enums"]["checkin_method"]
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string
          entrant_id: string
          id?: string
          match_id: string
          method?: Database["public"]["Enums"]["checkin_method"]
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string
          entrant_id?: string
          id?: string
          match_id?: string
          method?: Database["public"]["Enums"]["checkin_method"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_checkins_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_checkins_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      match_officials: {
        Row: {
          created_at: string
          match_id: string
          role: Database["public"]["Enums"]["match_official_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          match_id: string
          role: Database["public"]["Enums"]["match_official_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          match_id?: string
          role?: Database["public"]["Enums"]["match_official_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_officials_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_officials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          bracket_key: string
          bracket_side: Database["public"]["Enums"]["bracket_side"] | null
          checkin_closes_at: string | null
          checkin_opens_at: string | null
          created_at: string
          dispute_deadline: string | null
          draft_mode: Database["public"]["Enums"]["draft_mode"]
          entrant_a_id: string | null
          entrant_b_id: string | null
          finalized_at: string | null
          group_id: string | null
          id: string
          is_broadcast: boolean
          is_tiebreaker: boolean
          next_match_loser_id: string | null
          next_match_loser_slot:
            | Database["public"]["Enums"]["match_slot"]
            | null
          next_match_winner_id: string | null
          next_match_winner_slot:
            | Database["public"]["Enums"]["match_slot"]
            | null
          organization_id: string
          original_scheduled_at: string | null
          phase_id: string
          position: number
          result_source: Database["public"]["Enums"]["result_source"] | null
          round: number
          scheduled_at: string | null
          score_a: number
          score_b: number
          series_format: Database["public"]["Enums"]["series_format"]
          source_a: Json | null
          source_b: Json | null
          status: Database["public"]["Enums"]["match_status"]
          stream_session_id: string | null
          tournament_id: string
          updated_at: string
          version: number
          winner_entrant_id: string | null
        }
        Insert: {
          bracket_key: string
          bracket_side?: Database["public"]["Enums"]["bracket_side"] | null
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          created_at?: string
          dispute_deadline?: string | null
          draft_mode?: Database["public"]["Enums"]["draft_mode"]
          entrant_a_id?: string | null
          entrant_b_id?: string | null
          finalized_at?: string | null
          group_id?: string | null
          id?: string
          is_broadcast?: boolean
          is_tiebreaker?: boolean
          next_match_loser_id?: string | null
          next_match_loser_slot?:
            | Database["public"]["Enums"]["match_slot"]
            | null
          next_match_winner_id?: string | null
          next_match_winner_slot?:
            | Database["public"]["Enums"]["match_slot"]
            | null
          organization_id: string
          original_scheduled_at?: string | null
          phase_id: string
          position: number
          result_source?: Database["public"]["Enums"]["result_source"] | null
          round: number
          scheduled_at?: string | null
          score_a?: number
          score_b?: number
          series_format: Database["public"]["Enums"]["series_format"]
          source_a?: Json | null
          source_b?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          stream_session_id?: string | null
          tournament_id: string
          updated_at?: string
          version?: number
          winner_entrant_id?: string | null
        }
        Update: {
          bracket_key?: string
          bracket_side?: Database["public"]["Enums"]["bracket_side"] | null
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          created_at?: string
          dispute_deadline?: string | null
          draft_mode?: Database["public"]["Enums"]["draft_mode"]
          entrant_a_id?: string | null
          entrant_b_id?: string | null
          finalized_at?: string | null
          group_id?: string | null
          id?: string
          is_broadcast?: boolean
          is_tiebreaker?: boolean
          next_match_loser_id?: string | null
          next_match_loser_slot?:
            | Database["public"]["Enums"]["match_slot"]
            | null
          next_match_winner_id?: string | null
          next_match_winner_slot?:
            | Database["public"]["Enums"]["match_slot"]
            | null
          organization_id?: string
          original_scheduled_at?: string | null
          phase_id?: string
          position?: number
          result_source?: Database["public"]["Enums"]["result_source"] | null
          round?: number
          scheduled_at?: string | null
          score_a?: number
          score_b?: number
          series_format?: Database["public"]["Enums"]["series_format"]
          source_a?: Json | null
          source_b?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          stream_session_id?: string | null
          tournament_id?: string
          updated_at?: string
          version?: number
          winner_entrant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_entrant_a_id_fkey"
            columns: ["entrant_a_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_entrant_b_id_fkey"
            columns: ["entrant_b_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_loser_id_fkey"
            columns: ["next_match_loser_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_winner_id_fkey"
            columns: ["next_match_winner_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_entrant_id_fkey"
            columns: ["winner_entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_awards: {
        Row: {
          awarded_at: string
          entrant_id: string | null
          games: number
          id: string
          scope_id: string
          scope_type: Database["public"]["Enums"]["mvp_scope"]
          score: number
          sponsor_placement_id: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          entrant_id?: string | null
          games?: number
          id?: string
          scope_id: string
          scope_type: Database["public"]["Enums"]["mvp_scope"]
          score: number
          sponsor_placement_id?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          entrant_id?: string | null
          games?: number
          id?: string
          scope_id?: string
          scope_type?: Database["public"]["Enums"]["mvp_scope"]
          score?: number
          sponsor_placement_id?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mvp_awards_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_awards_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          last_error: string | null
          locked_until: string | null
          next_attempt_at: string
          notification_id: string
          provider_message_id: string | null
          sent_at: string | null
          source_event_id: string
          status: Database["public"]["Enums"]["notification_delivery_status"]
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          notification_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          source_event_id: string
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          notification_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          source_event_id?: string
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          channels: Database["public"]["Enums"]["notification_channel"][] | null
          conditions: Json
          created_at: string
          enabled: boolean
          id: string
          offsets: string[]
          organization_id: string
          tournament_id: string | null
          type_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channels?:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          offsets?: string[]
          organization_id: string
          tournament_id?: string | null
          type_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channels?:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          offsets?: string[]
          organization_id?: string
          tournament_id?: string | null
          type_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_type_key_fkey"
            columns: ["type_key"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "notification_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          locale: string
          organization_id: string | null
          subject: string | null
          type_key: string
          updated_at: string
          updated_by: string | null
          variables: string[]
          version: number
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          locale?: string
          organization_id?: string | null
          subject?: string | null
          type_key: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[]
          version?: number
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          locale?: string
          organization_id?: string | null
          subject?: string | null
          type_key?: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_templates_type_key_fkey"
            columns: ["type_key"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "notification_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_types: {
        Row: {
          audience: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          default_channels: Database["public"]["Enums"]["notification_channel"][]
          is_critical: boolean
          key: string
          position: number
        }
        Insert: {
          audience: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          default_channels: Database["public"]["Enums"]["notification_channel"][]
          is_critical?: boolean
          key: string
          position?: number
        }
        Update: {
          audience?: string
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          default_channels?: Database["public"]["Enums"]["notification_channel"][]
          is_critical?: boolean
          key?: string
          position?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          link: string | null
          organization_id: string | null
          read_at: string | null
          source_event_id: string
          title: string
          type_key: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          source_event_id: string
          title: string
          type_key: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          source_event_id?: string
          title?: string
          type_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_type_key_fkey"
            columns: ["type_key"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          default_locale: string
          default_timezone: string
          deleted_at: string | null
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_locale?: string
          default_timezone?: string
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_locale?: string
          default_timezone?: string
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          dead_at: string | null
          event_type: string
          id: string
          last_error: string | null
          locked_until: string | null
          next_attempt_at: string | null
          occurred_at: string
          organization_id: string | null
          payload: Json
          published_at: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          dead_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string | null
          occurred_at?: string
          organization_id?: string | null
          payload?: Json
          published_at?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          dead_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string | null
          occurred_at?: string
          organization_id?: string | null
          payload?: Json
          published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_entrants: {
        Row: {
          created_at: string
          entrant_id: string
          group_id: string | null
          phase_id: string
          seed: number | null
          status: Database["public"]["Enums"]["phase_entrant_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          entrant_id: string
          group_id?: string | null
          phase_id: string
          seed?: number | null
          status?: Database["public"]["Enums"]["phase_entrant_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          entrant_id?: string
          group_id?: string | null
          phase_id?: string
          seed?: number | null
          status?: Database["public"]["Enums"]["phase_entrant_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_entrants_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_entrants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_entrants_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          advancement: Json
          created_at: string
          draft_mode: Database["public"]["Enums"]["draft_mode"]
          final_series_format:
            | Database["public"]["Enums"]["series_format"]
            | null
          format: Database["public"]["Enums"]["phase_format"]
          format_config: Json
          id: string
          name: string
          points_config: Json
          position: number
          schema_version: number
          series_format: Database["public"]["Enums"]["series_format"]
          starts_at: string | null
          status: Database["public"]["Enums"]["phase_status"]
          tiebreakers: Json
          tournament_id: string
          updated_at: string
        }
        Insert: {
          advancement?: Json
          created_at?: string
          draft_mode?: Database["public"]["Enums"]["draft_mode"]
          final_series_format?:
            | Database["public"]["Enums"]["series_format"]
            | null
          format: Database["public"]["Enums"]["phase_format"]
          format_config?: Json
          id?: string
          name: string
          points_config?: Json
          position: number
          schema_version?: number
          series_format: Database["public"]["Enums"]["series_format"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
          tiebreakers?: Json
          tournament_id: string
          updated_at?: string
        }
        Update: {
          advancement?: Json
          created_at?: string
          draft_mode?: Database["public"]["Enums"]["draft_mode"]
          final_series_format?:
            | Database["public"]["Enums"]["series_format"]
            | null
          format?: Database["public"]["Enums"]["phase_format"]
          format_config?: Json
          id?: string
          name?: string
          points_config?: Json
          position?: number
          schema_version?: number
          series_format?: Database["public"]["Enums"]["series_format"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
          tiebreakers?: Json
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_aggregate_stats: {
        Row: {
          assists: number
          avg_cs_per_min: number
          avg_damage_per_min: number
          avg_damage_share: number
          avg_gold_per_min: number
          avg_kp: number
          avg_score: number
          avg_vision: number
          deaths: number
          games: number
          id: string
          kda: number
          kills: number
          mvps: number
          radar: Json
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["stats_scope"]
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          assists?: number
          avg_cs_per_min: number
          avg_damage_per_min: number
          avg_damage_share: number
          avg_gold_per_min: number
          avg_kp: number
          avg_score: number
          avg_vision: number
          deaths?: number
          games: number
          id?: string
          kda: number
          kills?: number
          mvps?: number
          radar: Json
          scope_id?: string | null
          scope_type: Database["public"]["Enums"]["stats_scope"]
          updated_at?: string
          user_id: string
          wins: number
        }
        Update: {
          assists?: number
          avg_cs_per_min?: number
          avg_damage_per_min?: number
          avg_damage_share?: number
          avg_gold_per_min?: number
          avg_kp?: number
          avg_score?: number
          avg_vision?: number
          deaths?: number
          games?: number
          id?: string
          kda?: number
          kills?: number
          mvps?: number
          radar?: Json
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["stats_scope"]
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_aggregate_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      player_champion_stats: {
        Row: {
          assists: number
          champion_id: number
          deaths: number
          games: number
          id: string
          kda: number
          kills: number
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["stats_scope"]
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          assists?: number
          champion_id: number
          deaths?: number
          games: number
          id?: string
          kda: number
          kills?: number
          scope_id?: string | null
          scope_type: Database["public"]["Enums"]["stats_scope"]
          updated_at?: string
          user_id: string
          wins: number
        }
        Update: {
          assists?: number
          champion_id?: number
          deaths?: number
          games?: number
          id?: string
          kda?: number
          kills?: number
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["stats_scope"]
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_champion_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      player_game_stats: {
        Row: {
          assists: number
          champion_id: number
          created_at: string
          cs: number
          cs_per_min: number
          damage_per_min: number
          damage_share: number
          damage_taken: number
          damage_to_champions: number
          deaths: number
          duration_seconds: number
          entrant_id: string
          first_blood: boolean
          game_id: string
          game_role: Database["public"]["Enums"]["player_role"] | null
          gold: number
          gold_per_min: number
          id: string
          is_mvp: boolean
          items: Json
          kda: number
          kill_participation: number
          kills: number
          match_id: string
          objectives: Json
          played_at: string
          puuid: string
          runes: Json
          score: number
          side: Database["public"]["Enums"]["game_side"]
          tournament_id: string
          user_id: string | null
          vision_per_min: number
          vision_score: number
          wards_killed: number
          wards_placed: number
          win: boolean
        }
        Insert: {
          assists: number
          champion_id: number
          created_at?: string
          cs: number
          cs_per_min: number
          damage_per_min: number
          damage_share: number
          damage_taken: number
          damage_to_champions: number
          deaths: number
          duration_seconds: number
          entrant_id: string
          first_blood?: boolean
          game_id: string
          game_role?: Database["public"]["Enums"]["player_role"] | null
          gold: number
          gold_per_min: number
          id?: string
          is_mvp?: boolean
          items?: Json
          kda: number
          kill_participation: number
          kills: number
          match_id: string
          objectives?: Json
          played_at: string
          puuid: string
          runes?: Json
          score: number
          side: Database["public"]["Enums"]["game_side"]
          tournament_id: string
          user_id?: string | null
          vision_per_min: number
          vision_score: number
          wards_killed: number
          wards_placed: number
          win: boolean
        }
        Update: {
          assists?: number
          champion_id?: number
          created_at?: string
          cs?: number
          cs_per_min?: number
          damage_per_min?: number
          damage_share?: number
          damage_taken?: number
          damage_to_champions?: number
          deaths?: number
          duration_seconds?: number
          entrant_id?: string
          first_blood?: boolean
          game_id?: string
          game_role?: Database["public"]["Enums"]["player_role"] | null
          gold?: number
          gold_per_min?: number
          id?: string
          is_mvp?: boolean
          items?: Json
          kda?: number
          kill_participation?: number
          kills?: number
          match_id?: string
          objectives?: Json
          played_at?: string
          puuid?: string
          runes?: Json
          score?: number
          side?: Database["public"]["Enums"]["game_side"]
          tournament_id?: string
          user_id?: string | null
          vision_per_min?: number
          vision_score?: number
          wards_killed?: number
          wards_placed?: number
          win?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "player_game_stats_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_game_stats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_game_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_game_stats_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_game_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          entrant_id: string
          id: string
          recipient_user_id: string | null
          shipping_info_ref: string | null
          status: Database["public"]["Enums"]["prize_delivery_status"]
          tournament_prize_id: string
          tracking: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          entrant_id: string
          id?: string
          recipient_user_id?: string | null
          shipping_info_ref?: string | null
          status?: Database["public"]["Enums"]["prize_delivery_status"]
          tournament_prize_id: string
          tracking?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          entrant_id?: string
          id?: string
          recipient_user_id?: string | null
          shipping_info_ref?: string | null
          status?: Database["public"]["Enums"]["prize_delivery_status"]
          tournament_prize_id?: string
          tracking?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_deliveries_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_deliveries_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_deliveries_tournament_prize_id_fkey"
            columns: ["tournament_prize_id"]
            isOneToOne: false
            referencedRelation: "tournament_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          last_used_at: string | null
          platform: Database["public"]["Enums"]["push_platform"]
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys?: Json
          last_used_at?: string | null
          platform: Database["public"]["Enums"]["push_platform"]
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          last_used_at?: string | null
          platform?: Database["public"]["Enums"]["push_platform"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reschedule_requests: {
        Row: {
          chosen_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          match_id: string
          proposed_at: string[]
          reason: string | null
          requested_by_entrant_id: string
          requested_by_user_id: string
          responded_by: string | null
          status: Database["public"]["Enums"]["reschedule_status"]
          updated_at: string
        }
        Insert: {
          chosen_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          match_id: string
          proposed_at: string[]
          reason?: string | null
          requested_by_entrant_id: string
          requested_by_user_id: string
          responded_by?: string | null
          status?: Database["public"]["Enums"]["reschedule_status"]
          updated_at?: string
        }
        Update: {
          chosen_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          match_id?: string
          proposed_at?: string[]
          reason?: string | null
          requested_by_entrant_id?: string
          requested_by_user_id?: string
          responded_by?: string | null
          status?: Database["public"]["Enums"]["reschedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reschedule_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedule_requests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedule_requests_requested_by_entrant_id_fkey"
            columns: ["requested_by_entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedule_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedule_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      result_reports: {
        Row: {
          evidence_paths: string[]
          game_id: string | null
          games: Json
          id: string
          match_id: string
          reported_by_entrant_id: string
          reported_by_user_id: string
          score_a: number
          score_b: number
          submitted_at: string
          winner_entrant_id: string
        }
        Insert: {
          evidence_paths?: string[]
          game_id?: string | null
          games: Json
          id?: string
          match_id: string
          reported_by_entrant_id: string
          reported_by_user_id: string
          score_a: number
          score_b: number
          submitted_at?: string
          winner_entrant_id: string
        }
        Update: {
          evidence_paths?: string[]
          game_id?: string | null
          games?: Json
          id?: string
          match_id?: string
          reported_by_entrant_id?: string
          reported_by_user_id?: string
          score_a?: number
          score_b?: number
          submitted_at?: string
          winner_entrant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_reports_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_reports_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_reports_reported_by_entrant_id_fkey"
            columns: ["reported_by_entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_reports_reported_by_user_id_fkey"
            columns: ["reported_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_reports_winner_entrant_id_fkey"
            columns: ["winner_entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
        ]
      }
      riot_accounts: {
        Row: {
          created_at: string
          game_name: string
          id: string
          is_primary: boolean
          last_synced_at: string | null
          profile_icon_id: number | null
          puuid: string
          region: Database["public"]["Enums"]["game_region"]
          summoner_level: number | null
          tag_line: string
          unlinked_at: string | null
          updated_at: string
          user_id: string
          verification_method: Database["public"]["Enums"]["riot_verification_method"]
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          game_name: string
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          profile_icon_id?: number | null
          puuid: string
          region: Database["public"]["Enums"]["game_region"]
          summoner_level?: number | null
          tag_line: string
          unlinked_at?: string | null
          updated_at?: string
          user_id: string
          verification_method: Database["public"]["Enums"]["riot_verification_method"]
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          game_name?: string
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          profile_icon_id?: number | null
          puuid?: string
          region?: Database["public"]["Enums"]["game_region"]
          summoner_level?: number | null
          tag_line?: string
          unlinked_at?: string | null
          updated_at?: string
          user_id?: string
          verification_method?: Database["public"]["Enums"]["riot_verification_method"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "riot_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      riot_id_history: {
        Row: {
          game_name: string
          id: string
          riot_account_id: string
          seen_at: string
          tag_line: string
        }
        Insert: {
          game_name: string
          id?: string
          riot_account_id: string
          seen_at?: string
          tag_line: string
        }
        Update: {
          game_name?: string
          id?: string
          riot_account_id?: string
          seen_at?: string
          tag_line?: string
        }
        Relationships: [
          {
            foreignKeyName: "riot_id_history_riot_account_id_fkey"
            columns: ["riot_account_id"]
            isOneToOne: false
            referencedRelation: "riot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      riot_providers: {
        Row: {
          callback_url: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          region: Database["public"]["Enums"]["game_region"]
          riot_provider_id: number
          status: Database["public"]["Enums"]["riot_setup_status"]
        }
        Insert: {
          callback_url: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          region: Database["public"]["Enums"]["game_region"]
          riot_provider_id: number
          status?: Database["public"]["Enums"]["riot_setup_status"]
        }
        Update: {
          callback_url?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          region?: Database["public"]["Enums"]["game_region"]
          riot_provider_id?: number
          status?: Database["public"]["Enums"]["riot_setup_status"]
        }
        Relationships: [
          {
            foreignKeyName: "riot_providers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riot_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      riot_rank_snapshots: {
        Row: {
          captured_at: string
          division: number | null
          id: string
          losses: number
          lp: number
          queue: Database["public"]["Enums"]["rank_queue"]
          riot_account_id: string
          tier: string
          wins: number
        }
        Insert: {
          captured_at?: string
          division?: number | null
          id?: string
          losses?: number
          lp?: number
          queue: Database["public"]["Enums"]["rank_queue"]
          riot_account_id: string
          tier: string
          wins?: number
        }
        Update: {
          captured_at?: string
          division?: number | null
          id?: string
          losses?: number
          lp?: number
          queue?: Database["public"]["Enums"]["rank_queue"]
          riot_account_id?: string
          tier?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "riot_rank_snapshots_riot_account_id_fkey"
            columns: ["riot_account_id"]
            isOneToOne: false
            referencedRelation: "riot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      riot_tournament_codes: {
        Row: {
          allowed_puuids: string[]
          code: string
          game_id: string
          generated_at: string
          id: string
          map: string
          metadata: string
          pick_type: string
          riot_tournament_id: number
          spectator_type: string
          status: Database["public"]["Enums"]["tournament_code_status"]
          team_size: number
          used_at: string | null
        }
        Insert: {
          allowed_puuids?: string[]
          code: string
          game_id: string
          generated_at?: string
          id?: string
          map: string
          metadata: string
          pick_type: string
          riot_tournament_id: number
          spectator_type: string
          status?: Database["public"]["Enums"]["tournament_code_status"]
          team_size: number
          used_at?: string | null
        }
        Update: {
          allowed_puuids?: string[]
          code?: string
          game_id?: string
          generated_at?: string
          id?: string
          map?: string
          metadata?: string
          pick_type?: string
          riot_tournament_id?: number
          spectator_type?: string
          status?: Database["public"]["Enums"]["tournament_code_status"]
          team_size?: number
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "riot_tournament_codes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      riot_tournaments: {
        Row: {
          created_at: string
          id: string
          name: string
          riot_provider_id: string
          riot_tournament_id: number
          status: Database["public"]["Enums"]["riot_setup_status"]
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          riot_provider_id: string
          riot_tournament_id: number
          status?: Database["public"]["Enums"]["riot_setup_status"]
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          riot_provider_id?: string
          riot_tournament_id?: number
          status?: Database["public"]["Enums"]["riot_setup_status"]
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "riot_tournaments_riot_provider_id_fkey"
            columns: ["riot_provider_id"]
            isOneToOne: false
            referencedRelation: "riot_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riot_tournaments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      riot_verification_attempts: {
        Row: {
          created_at: string
          expected_icon_id: number
          expires_at: string
          failure_reason: string | null
          game_name: string
          id: string
          method: Database["public"]["Enums"]["riot_verification_method"]
          puuid: string
          region: Database["public"]["Enums"]["game_region"]
          riot_account_id: string | null
          status: Database["public"]["Enums"]["riot_verification_status"]
          tag_line: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          expected_icon_id: number
          expires_at: string
          failure_reason?: string | null
          game_name: string
          id?: string
          method: Database["public"]["Enums"]["riot_verification_method"]
          puuid: string
          region: Database["public"]["Enums"]["game_region"]
          riot_account_id?: string | null
          status?: Database["public"]["Enums"]["riot_verification_status"]
          tag_line: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          expected_icon_id?: number
          expires_at?: string
          failure_reason?: string | null
          game_name?: string
          id?: string
          method?: Database["public"]["Enums"]["riot_verification_method"]
          puuid?: string
          region?: Database["public"]["Enums"]["game_region"]
          riot_account_id?: string | null
          status?: Database["public"]["Enums"]["riot_verification_status"]
          tag_line?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "riot_verification_attempts_riot_account_id_fkey"
            columns: ["riot_account_id"]
            isOneToOne: false
            referencedRelation: "riot_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riot_verification_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_change_requests: {
        Row: {
          action: Database["public"]["Enums"]["roster_change_action"]
          created_at: string
          decided_at: string | null
          decided_by: string | null
          entrant_id: string
          id: string
          reason: string | null
          replaces_user_id: string | null
          requested_by: string
          status: Database["public"]["Enums"]["roster_change_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["roster_change_action"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          entrant_id: string
          id?: string
          reason?: string | null
          replaces_user_id?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["roster_change_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["roster_change_action"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          entrant_id?: string
          id?: string
          reason?: string | null
          replaces_user_id?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["roster_change_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_change_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_change_requests_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_change_requests_replaces_user_id_fkey"
            columns: ["replaces_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_change_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rulebook_versions: {
        Row: {
          change_summary: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          published_by: string | null
          rulebook_id: string
          updated_at: string
          version: number
        }
        Insert: {
          change_summary?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          published_by?: string | null
          rulebook_id: string
          updated_at?: string
          version: number
        }
        Update: {
          change_summary?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          published_by?: string | null
          rulebook_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rulebook_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rulebook_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rulebook_versions_rulebook_id_fkey"
            columns: ["rulebook_id"]
            isOneToOne: false
            referencedRelation: "rulebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      rulebooks: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          title: string
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          title: string
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          title?: string
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rulebooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rulebooks_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blackouts: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blackouts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_windows: {
        Row: {
          created_at: string
          end_time: string
          id: string
          parallel_matches: number
          phase_id: string | null
          priority: number
          slot_minutes: number
          start_time: string
          timezone: string
          tournament_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          parallel_matches?: number
          phase_id?: string | null
          priority?: number
          slot_minutes?: number
          start_time: string
          timezone: string
          tournament_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          parallel_matches?: number
          phase_id?: string | null
          priority?: number
          slot_minutes?: number
          start_time?: string
          timezone?: string
          tournament_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_windows_phase_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_windows_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          name: string
          organization_id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["season_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          organization_id: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      standing_overrides: {
        Row: {
          created_at: string
          created_by: string
          entrant_id: string
          field: string
          id: string
          phase_id: string
          reason: string
          value: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          entrant_id: string
          field: string
          id?: string
          phase_id: string
          reason: string
          value: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          entrant_id?: string
          field?: string
          id?: string
          phase_id?: string
          reason?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "standing_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standing_overrides_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standing_overrides_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      standings: {
        Row: {
          draws: number
          entrant_id: string
          game_diff: number
          game_losses: number
          game_wins: number
          group_id: string | null
          losses: number
          phase_id: string
          played: number
          points: number
          rank: number
          status: Database["public"]["Enums"]["standing_status"]
          tiebreak_details: Json
          tournament_id: string
          updated_at: string
          wins: number
        }
        Insert: {
          draws?: number
          entrant_id: string
          game_diff?: number
          game_losses?: number
          game_wins?: number
          group_id?: string | null
          losses?: number
          phase_id: string
          played?: number
          points?: number
          rank: number
          status?: Database["public"]["Enums"]["standing_status"]
          tiebreak_details?: Json
          tournament_id: string
          updated_at?: string
          wins?: number
        }
        Update: {
          draws?: number
          entrant_id?: string
          game_diff?: number
          game_losses?: number
          game_wins?: number
          group_id?: string | null
          losses?: number
          phase_id?: string
          played?: number
          points?: number
          rank?: number
          status?: Database["public"]["Enums"]["standing_status"]
          tiebreak_details?: Json
          tournament_id?: string
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "standings_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      stats_jobs: {
        Row: {
          attempts: number
          dead_at: string | null
          last_error: string | null
          locked_until: string | null
          match_id: string
          next_attempt_at: string | null
          processed_at: string | null
          requested_at: string
          tournament_id: string
        }
        Insert: {
          attempts?: number
          dead_at?: string | null
          last_error?: string | null
          locked_until?: string | null
          match_id: string
          next_attempt_at?: string | null
          processed_at?: string | null
          requested_at?: string
          tournament_id: string
        }
        Update: {
          attempts?: number
          dead_at?: string | null
          last_error?: string | null
          locked_until?: string | null
          match_id?: string
          next_attempt_at?: string | null
          processed_at?: string | null
          requested_at?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stats_jobs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stats_jobs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      team_aggregate_stats: {
        Row: {
          avg_barons: number
          avg_dragons: number
          avg_game_duration: number
          avg_kills: number
          avg_towers: number
          first_blood_rate: number
          first_tower_rate: number
          games: number
          id: string
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["stats_scope"]
          team_id: string
          updated_at: string
          wins: number
        }
        Insert: {
          avg_barons: number
          avg_dragons: number
          avg_game_duration: number
          avg_kills: number
          avg_towers: number
          first_blood_rate: number
          first_tower_rate: number
          games: number
          id?: string
          scope_id?: string | null
          scope_type: Database["public"]["Enums"]["stats_scope"]
          team_id: string
          updated_at?: string
          wins: number
        }
        Update: {
          avg_barons?: number
          avg_dragons?: number
          avg_game_duration?: number
          avg_kills?: number
          avg_towers?: number
          first_blood_rate?: number
          first_tower_rate?: number
          games?: number
          id?: string
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["stats_scope"]
          team_id?: string
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_aggregate_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_captaincy_transfers: {
        Row: {
          created_at: string
          decided_at: string | null
          from_user_id: string
          id: string
          status: Database["public"]["Enums"]["captaincy_transfer_status"]
          team_id: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          from_user_id: string
          id?: string
          status?: Database["public"]["Enums"]["captaincy_transfer_status"]
          team_id: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          from_user_id?: string
          id?: string
          status?: Database["public"]["Enums"]["captaincy_transfer_status"]
          team_id?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_captaincy_transfers_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_captaincy_transfers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_captaincy_transfers_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_game_stats: {
        Row: {
          bans: number[]
          barons: number
          created_at: string
          dragons: number
          duration_seconds: number
          entrant_id: string
          first_objectives: Json
          game_id: string
          gold: number
          grubs: number
          heralds: number
          id: string
          inhibitors: number
          kills: number
          match_id: string
          played_at: string
          side: Database["public"]["Enums"]["game_side"]
          team_id: string | null
          tournament_id: string
          towers: number
          win: boolean
        }
        Insert: {
          bans?: number[]
          barons: number
          created_at?: string
          dragons: number
          duration_seconds: number
          entrant_id: string
          first_objectives?: Json
          game_id: string
          gold: number
          grubs: number
          heralds: number
          id?: string
          inhibitors: number
          kills: number
          match_id: string
          played_at: string
          side: Database["public"]["Enums"]["game_side"]
          team_id?: string | null
          tournament_id: string
          towers: number
          win: boolean
        }
        Update: {
          bans?: number[]
          barons?: number
          created_at?: string
          dragons?: number
          duration_seconds?: number
          entrant_id?: string
          first_objectives?: Json
          game_id?: string
          gold?: number
          grubs?: number
          heralds?: number
          id?: string
          inhibitors?: number
          kills?: number
          match_id?: string
          played_at?: string
          side?: Database["public"]["Enums"]["game_side"]
          team_id?: string | null
          tournament_id?: string
          towers?: number
          win?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "team_game_stats_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_game_stats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_game_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_game_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_game_stats_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_by: string | null
          created_at: string
          created_by: string
          decided_at: string | null
          expires_at: string
          id: string
          invite_code: string | null
          invited_user_id: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          team_id: string
          team_role: Database["public"]["Enums"]["team_role"]
          updated_at: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          created_by: string
          decided_at?: string | null
          expires_at: string
          id?: string
          invite_code?: string | null
          invited_user_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          team_id: string
          team_role: Database["public"]["Enums"]["team_role"]
          updated_at?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          invite_code?: string | null
          invited_user_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          team_id?: string
          team_role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          status: Database["public"]["Enums"]["join_request_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["join_request_status"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["join_request_status"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          created_by: string | null
          game_role: Database["public"]["Enums"]["player_role"] | null
          id: string
          joined_at: string
          left_at: string | null
          left_reason: string | null
          team_id: string
          team_role: Database["public"]["Enums"]["team_role"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          game_role?: Database["public"]["Enums"]["player_role"] | null
          id?: string
          joined_at?: string
          left_at?: string | null
          left_reason?: string | null
          team_id: string
          team_role: Database["public"]["Enums"]["team_role"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          game_role?: Database["public"]["Enums"]["player_role"] | null
          id?: string
          joined_at?: string
          left_at?: string | null
          left_reason?: string | null
          team_id?: string
          team_role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_name_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          name: string
          tag: string
          team_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          name: string
          tag: string
          team_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          name?: string
          tag?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_name_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_name_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          approved_at: string | null
          banner_media_id: string | null
          club_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["team_kind"]
          logo_media_id: string | null
          logo_path: string | null
          name: string
          organization_id: string
          owner_user_id: string
          region: Database["public"]["Enums"]["game_region"]
          slug: string
          social_links: Json
          status: Database["public"]["Enums"]["team_status"]
          tag: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          banner_media_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["team_kind"]
          logo_media_id?: string | null
          logo_path?: string | null
          name: string
          organization_id: string
          owner_user_id: string
          region: Database["public"]["Enums"]["game_region"]
          slug: string
          social_links?: Json
          status?: Database["public"]["Enums"]["team_status"]
          tag: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          banner_media_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["team_kind"]
          logo_media_id?: string | null
          logo_path?: string | null
          name?: string
          organization_id?: string
          owner_user_id?: string
          region?: Database["public"]["Enums"]["game_region"]
          slug?: string
          social_links?: Json
          status?: Database["public"]["Enums"]["team_status"]
          tag?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_game_settings: {
        Row: {
          created_at: string
          custom_win_condition: string | null
          map: Database["public"]["Enums"]["game_map"]
          pick_type: Database["public"]["Enums"]["pick_type"]
          spectator_type: Database["public"]["Enums"]["spectator_type"]
          team_size: number
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_win_condition?: string | null
          map?: Database["public"]["Enums"]["game_map"]
          pick_type?: Database["public"]["Enums"]["pick_type"]
          spectator_type?: Database["public"]["Enums"]["spectator_type"]
          team_size?: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_win_condition?: string | null
          map?: Database["public"]["Enums"]["game_map"]
          pick_type?: Database["public"]["Enums"]["pick_type"]
          spectator_type?: Database["public"]["Enums"]["spectator_type"]
          team_size?: number
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_game_settings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_prizes: {
        Row: {
          amount: number | null
          award_type: Database["public"]["Enums"]["prize_award_type"]
          created_at: string
          currency: string | null
          description: string | null
          distribution: Database["public"]["Enums"]["prize_distribution"]
          id: string
          image_media_id: string | null
          label: string | null
          placement_from: number | null
          placement_to: number | null
          position: number
          prize_type: Database["public"]["Enums"]["prize_type"]
          quantity: number
          sponsor_id: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          award_type?: Database["public"]["Enums"]["prize_award_type"]
          created_at?: string
          currency?: string | null
          description?: string | null
          distribution?: Database["public"]["Enums"]["prize_distribution"]
          id?: string
          image_media_id?: string | null
          label?: string | null
          placement_from?: number | null
          placement_to?: number | null
          position: number
          prize_type: Database["public"]["Enums"]["prize_type"]
          quantity?: number
          sponsor_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          award_type?: Database["public"]["Enums"]["prize_award_type"]
          created_at?: string
          currency?: string | null
          description?: string | null
          distribution?: Database["public"]["Enums"]["prize_distribution"]
          id?: string
          image_media_id?: string | null
          label?: string | null
          placement_from?: number | null
          placement_to?: number | null
          position?: number
          prize_type?: Database["public"]["Enums"]["prize_type"]
          quantity?: number
          sponsor_id?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_prizes_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_roster_rules: {
        Row: {
          coach_allowed: boolean
          created_at: string
          leave_cooldown_days: number
          max_roster_changes: number | null
          max_substitutes: number
          min_games_for_playoffs: number | null
          roster_lock_at_phase_id: string | null
          starters: number
          tournament_id: string
          updated_at: string
        }
        Insert: {
          coach_allowed?: boolean
          created_at?: string
          leave_cooldown_days?: number
          max_roster_changes?: number | null
          max_substitutes?: number
          min_games_for_playoffs?: number | null
          roster_lock_at_phase_id?: string | null
          starters?: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          coach_allowed?: boolean
          created_at?: string
          leave_cooldown_days?: number
          max_roster_changes?: number | null
          max_substitutes?: number
          min_games_for_playoffs?: number | null
          roster_lock_at_phase_id?: string | null
          starters?: number
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_roster_rules_lock_phase_fkey"
            columns: ["roster_lock_at_phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_roster_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_staff: {
        Row: {
          created_at: string
          created_by: string | null
          staff_role: Database["public"]["Enums"]["tournament_staff_role"]
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          staff_role: Database["public"]["Enums"]["tournament_staff_role"]
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          staff_role?: Database["public"]["Enums"]["tournament_staff_role"]
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_staff_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_templates: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          schema_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          schema_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          schema_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          capacity: number | null
          costream_delay_seconds: number
          costream_policy: Database["public"]["Enums"]["costream_policy"]
          cover_media_id: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          current_rulebook_version_id: string | null
          deleted_at: string | null
          description: string | null
          ends_at: string | null
          entrant_kind: Database["public"]["Enums"]["entrant_kind"]
          exclusivity_scope: Database["public"]["Enums"]["exclusivity_scope"]
          has_prizes: boolean
          id: string
          max_rosters_per_club: number
          modality: Database["public"]["Enums"]["tournament_modality"]
          name: string
          organization_id: string
          participant_policy: Database["public"]["Enums"]["participant_policy"]
          prize_pool_summary: string | null
          published_at: string | null
          published_by: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          schema_version: number
          season_id: string | null
          settings: Json
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          supervision_level: Database["public"]["Enums"]["supervision_level"]
          team_source: Database["public"]["Enums"]["team_source"]
          template_id: string | null
          tier: number
          timezone: string
          type: Database["public"]["Enums"]["tournament_type"]
          updated_at: string
          updated_by: string | null
          venue: Json | null
          visibility: Database["public"]["Enums"]["tournament_visibility"]
          waitlist_enabled: boolean
        }
        Insert: {
          capacity?: number | null
          costream_delay_seconds?: number
          costream_policy?: Database["public"]["Enums"]["costream_policy"]
          cover_media_id?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          current_rulebook_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          entrant_kind?: Database["public"]["Enums"]["entrant_kind"]
          exclusivity_scope?: Database["public"]["Enums"]["exclusivity_scope"]
          has_prizes?: boolean
          id?: string
          max_rosters_per_club?: number
          modality?: Database["public"]["Enums"]["tournament_modality"]
          name: string
          organization_id: string
          participant_policy?: Database["public"]["Enums"]["participant_policy"]
          prize_pool_summary?: string | null
          published_at?: string | null
          published_by?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          schema_version?: number
          season_id?: string | null
          settings?: Json
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          supervision_level?: Database["public"]["Enums"]["supervision_level"]
          team_source?: Database["public"]["Enums"]["team_source"]
          template_id?: string | null
          tier?: number
          timezone?: string
          type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
          updated_by?: string | null
          venue?: Json | null
          visibility?: Database["public"]["Enums"]["tournament_visibility"]
          waitlist_enabled?: boolean
        }
        Update: {
          capacity?: number | null
          costream_delay_seconds?: number
          costream_policy?: Database["public"]["Enums"]["costream_policy"]
          cover_media_id?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          current_rulebook_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          entrant_kind?: Database["public"]["Enums"]["entrant_kind"]
          exclusivity_scope?: Database["public"]["Enums"]["exclusivity_scope"]
          has_prizes?: boolean
          id?: string
          max_rosters_per_club?: number
          modality?: Database["public"]["Enums"]["tournament_modality"]
          name?: string
          organization_id?: string
          participant_policy?: Database["public"]["Enums"]["participant_policy"]
          prize_pool_summary?: string | null
          published_at?: string | null
          published_by?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          schema_version?: number
          season_id?: string | null
          settings?: Json
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          supervision_level?: Database["public"]["Enums"]["supervision_level"]
          team_source?: Database["public"]["Enums"]["team_source"]
          template_id?: string | null
          tier?: number
          timezone?: string
          type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
          updated_by?: string | null
          venue?: Json | null
          visibility?: Database["public"]["Enums"]["tournament_visibility"]
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_current_rulebook_version_fkey"
            columns: ["current_rulebook_version_id"]
            isOneToOne: false
            referencedRelation: "rulebook_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tournament_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          awarded_at: string
          context: Json
          tournament_id: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          awarded_at?: string
          context?: Json
          tournament_id?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          awarded_at?: string
          context?: Json
          tournament_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_discord_links: {
        Row: {
          discord_user_id: string
          discord_username: string | null
          linked_at: string
          user_id: string
        }
        Insert: {
          discord_user_id: string
          discord_username?: string | null
          linked_at?: string
          user_id: string
        }
        Update: {
          discord_user_id?: string
          discord_username?: string | null
          linked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_discord_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled: boolean
          quiet_hours: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled: boolean
          quiet_hours?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          channel?: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          quiet_hours?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_privacy_settings: {
        Row: {
          field_key: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["privacy_visibility"]
        }
        Insert: {
          field_key: string
          updated_at?: string
          user_id: string
          visibility: Database["public"]["Enums"]["privacy_visibility"]
        }
        Update: {
          field_key?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["privacy_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "user_privacy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_private_data: {
        Row: {
          created_at: string
          gender: Database["public"]["Enums"]["gender"] | null
          gender_declared_at: string | null
          gender_locked: boolean
          guardian_consent_at: string | null
          guardian_contact: string | null
          guardian_name: string | null
          institutional_email: string | null
          institutional_email_verified_at: string | null
          legal_first_name: string | null
          legal_last_name: string | null
          phone_e164: string | null
          phone_verified_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          gender_declared_at?: string | null
          gender_locked?: boolean
          guardian_consent_at?: string | null
          guardian_contact?: string | null
          guardian_name?: string | null
          institutional_email?: string | null
          institutional_email_verified_at?: string | null
          legal_first_name?: string | null
          legal_last_name?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          gender_declared_at?: string | null
          gender_locked?: boolean
          guardian_consent_at?: string | null
          guardian_contact?: string | null
          guardian_name?: string | null
          institutional_email?: string | null
          institutional_email_verified_at?: string | null
          legal_first_name?: string | null
          legal_last_name?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_private_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_social_links: {
        Row: {
          created_at: string
          handle: string | null
          id: string
          platform: Database["public"]["Enums"]["social_platform"]
          position: number
          updated_at: string
          url: string
          user_id: string
          visibility: Database["public"]["Enums"]["privacy_visibility"]
        }
        Insert: {
          created_at?: string
          handle?: string | null
          id?: string
          platform: Database["public"]["Enums"]["social_platform"]
          position?: number
          updated_at?: string
          url: string
          user_id: string
          visibility?: Database["public"]["Enums"]["privacy_visibility"]
        }
        Update: {
          created_at?: string
          handle?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          position?: number
          updated_at?: string
          url?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["privacy_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "user_social_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_media_id: string | null
          avatar_path: string | null
          bio: string | null
          birth_date: string | null
          country_code: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          game_region: Database["public"]["Enums"]["game_region"] | null
          id: string
          is_free_agent: boolean
          locale: string
          platform_role: Database["public"]["Enums"]["platform_role"]
          primary_role: Database["public"]["Enums"]["player_role"] | null
          secondary_role: Database["public"]["Enums"]["player_role"] | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_media_id?: string | null
          avatar_path?: string | null
          bio?: string | null
          birth_date?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          game_region?: Database["public"]["Enums"]["game_region"] | null
          id: string
          is_free_agent?: boolean
          locale?: string
          platform_role?: Database["public"]["Enums"]["platform_role"]
          primary_role?: Database["public"]["Enums"]["player_role"] | null
          secondary_role?: Database["public"]["Enums"]["player_role"] | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_media_id?: string | null
          avatar_path?: string | null
          bio?: string | null
          birth_date?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          game_region?: Database["public"]["Enums"]["game_region"] | null
          id?: string
          is_free_agent?: boolean
          locale?: string
          platform_role?: Database["public"]["Enums"]["platform_role"]
          primary_role?: Database["public"]["Enums"]["player_role"] | null
          secondary_role?: Database["public"]["Enums"]["player_role"] | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      fearless_locks: {
        Row: {
          champion_id: number | null
          entrant_id: string | null
          locked_by_game_id: string | null
          match_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_actions_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_actions_game_id_fkey"
            columns: ["locked_by_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      svc_accept_captaincy_transfer: {
        Args: { p_reason: string; p_transfer_id: string }
        Returns: undefined
      }
      svc_add_team_member: {
        Args: {
          p_actor: string
          p_invitation_id?: string
          p_join_request_id?: string
          p_team_id: string
          p_team_role: Database["public"]["Enums"]["team_role"]
          p_user_id: string
        }
        Returns: string
      }
      svc_attach_game_data: {
        Args: {
          p_actor: string
          p_draft: Json
          p_game: Json
          p_game_id: string
          p_participants: Json
        }
        Returns: undefined
      }
      svc_claim_deliveries: {
        Args: { p_lease_seconds: number; p_limit: number }
        Returns: {
          attempts: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          last_error: string | null
          locked_until: string | null
          next_attempt_at: string
          notification_id: string
          provider_message_id: string | null
          sent_at: string | null
          source_event_id: string
          status: Database["public"]["Enums"]["notification_delivery_status"]
          subject: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      svc_claim_outbox_events: {
        Args: { p_lease_seconds: number; p_limit: number }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          dead_at: string | null
          event_type: string
          id: string
          last_error: string | null
          locked_until: string | null
          next_attempt_at: string | null
          occurred_at: string
          organization_id: string | null
          payload: Json
          published_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "outbox_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      svc_claim_stats_jobs: {
        Args: { p_lease_seconds: number; p_limit: number }
        Returns: {
          attempts: number
          dead_at: string | null
          last_error: string | null
          locked_until: string | null
          match_id: string
          next_attempt_at: string | null
          processed_at: string | null
          requested_at: string
          tournament_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "stats_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      svc_close_temp_channels: {
        Args: { p_match_id: string }
        Returns: string[]
      }
      svc_commit_competition: {
        Args: { p_actor: string; p_change: Json; p_tournament_id: string }
        Returns: undefined
      }
      svc_create_team: {
        Args: {
          p_description: string
          p_name: string
          p_organization_id: string
          p_owner_user_id: string
          p_region: Database["public"]["Enums"]["game_region"]
          p_slug: string
          p_tag: string
        }
        Returns: string
      }
      svc_create_tournament: {
        Args: {
          p_actor: string
          p_config: Json
          p_organization_id: string
          p_slug: string
          p_template_id: string
        }
        Returns: string
      }
      svc_decide_entrant: {
        Args: {
          p_actor: string
          p_audit_action: string
          p_entrant_id: string
          p_event_type: string
          p_from: Database["public"]["Enums"]["entrant_status"]
          p_reason: string
          p_to: Database["public"]["Enums"]["entrant_status"]
        }
        Returns: undefined
      }
      svc_dissolve_team: {
        Args: { p_actor: string; p_reason: string; p_team_id: string }
        Returns: undefined
      }
      svc_enqueue_notifications: {
        Args: { p_event_id: string; p_items: Json }
        Returns: number
      }
      svc_fail_outbox_event: {
        Args: {
          p_dead: boolean
          p_error: string
          p_event_id: string
          p_next_attempt_at: string
        }
        Returns: undefined
      }
      svc_fail_stats_job: {
        Args: {
          p_dead: boolean
          p_error: string
          p_match_id: string
          p_next_attempt_at: string
        }
        Returns: undefined
      }
      svc_link_discord_user: {
        Args: {
          p_discord_user_id: string
          p_discord_username: string
          p_user_id: string
        }
        Returns: undefined
      }
      svc_link_riot_account: {
        Args: {
          p_attempt_id: string
          p_profile_icon_id: number
          p_ranks: Json
          p_summoner_level: number
        }
        Returns: string
      }
      svc_log_inbound_webhook: {
        Args: {
          p_event_type: string
          p_idempotency_key: string
          p_organization_id: string
          p_payload: Json
          p_signature_valid: boolean
          p_source: string
        }
        Returns: boolean
      }
      svc_mark_webhook: {
        Args: {
          p_error: string
          p_idempotency_key: string
          p_source: string
          p_status: Database["public"]["Enums"]["inbound_webhook_status"]
        }
        Returns: undefined
      }
      svc_open_riot_game: {
        Args: {
          p_blue: string
          p_game_number: number
          p_match_id: string
          p_red: string
        }
        Returns: string
      }
      svc_publish_rulebook_version: {
        Args: { p_actor: string; p_tournament_id: string }
        Returns: string
      }
      svc_publish_tournament: {
        Args: { p_actor: string; p_phases: Json; p_tournament_id: string }
        Returns: undefined
      }
      svc_raise_integrity_alert: {
        Args: {
          p_evidence: Json
          p_organization_id: string
          p_severity: number
          p_subject_id: string
          p_subject_type: Database["public"]["Enums"]["subject_type"]
          p_type: Database["public"]["Enums"]["integrity_alert_type"]
        }
        Returns: string
      }
      svc_record_riot_game: {
        Args: {
          p_draft: Json
          p_duration: number
          p_game_id: string
          p_participants: Json
          p_patch: string
          p_payload: Json
          p_riot_match_id: string
          p_winner: string
        }
        Returns: undefined
      }
      svc_record_temp_channel: {
        Args: {
          p_channel_id: string
          p_entrant_id: string
          p_guild_id: string
          p_match_id: string
        }
        Returns: undefined
      }
      svc_register_entrant: {
        Args: {
          p_actor: string
          p_entrant: Json
          p_roster: Json
          p_tournament_id: string
        }
        Returns: string
      }
      svc_replace_social_links: {
        Args: { p_links: Json; p_user_id: string }
        Returns: undefined
      }
      svc_request_tournament_stats: {
        Args: { p_actor: string; p_tournament_id: string }
        Returns: number
      }
      svc_reset_notification_template: {
        Args: {
          p_actor: string
          p_channel: Database["public"]["Enums"]["notification_channel"]
          p_locale: string
          p_organization_id: string
          p_type_key: string
        }
        Returns: undefined
      }
      svc_save_achievement: {
        Args: {
          p_active: boolean
          p_actor: string
          p_criteria: Json
          p_description: string
          p_icon: string
          p_key: string
          p_name: string
          p_organization_id: string
        }
        Returns: undefined
      }
      svc_save_discord_guild: {
        Args: {
          p_actor: string
          p_guild_id: string
          p_name: string
          p_organization_id: string
          p_settings: Json
        }
        Returns: string
      }
      svc_save_match_stats: {
        Args: { p_data: Json; p_match_id: string; p_requested_at: string }
        Returns: number
      }
      svc_save_notification_rule: {
        Args: {
          p_actor: string
          p_channels: Database["public"]["Enums"]["notification_channel"][]
          p_enabled: boolean
          p_organization_id: string
          p_type_key: string
        }
        Returns: undefined
      }
      svc_save_notification_template: {
        Args: {
          p_actor: string
          p_body: string
          p_channel: Database["public"]["Enums"]["notification_channel"]
          p_locale: string
          p_organization_id: string
          p_subject: string
          p_type_key: string
          p_variables: string[]
        }
        Returns: undefined
      }
      svc_save_riot_provider: {
        Args: {
          p_actor: string
          p_callback_url: string
          p_organization_id: string
          p_provider_id: number
          p_region: Database["public"]["Enums"]["game_region"]
        }
        Returns: string
      }
      svc_save_riot_tournament: {
        Args: {
          p_name: string
          p_provider: string
          p_riot_tournament_id: number
          p_tournament_id: string
        }
        Returns: undefined
      }
      svc_save_rulebook_draft: {
        Args: {
          p_actor: string
          p_change_summary: string
          p_content: string
          p_title: string
          p_tournament_id: string
        }
        Returns: string
      }
      svc_save_tournament_code: {
        Args: {
          p_allowed_puuids: string[]
          p_code: string
          p_game_id: string
          p_map: string
          p_metadata: string
          p_pick_type: string
          p_riot_tournament_id: number
          p_spectator_type: string
          p_team_size: number
        }
        Returns: undefined
      }
      svc_set_discord_channel: {
        Args: {
          p_actor: string
          p_channel_id: string
          p_organization_id: string
          p_purpose: Database["public"]["Enums"]["discord_channel_purpose"]
          p_tournament_id: string
        }
        Returns: undefined
      }
      svc_set_seeds: {
        Args: {
          p_actor: string
          p_method: string
          p_seeds: Json
          p_tournament_id: string
        }
        Returns: undefined
      }
      svc_transition_tournament: {
        Args: {
          p_actor: string
          p_audit_action: string
          p_event_type: string
          p_from: Database["public"]["Enums"]["tournament_status"]
          p_reason: string
          p_to: Database["public"]["Enums"]["tournament_status"]
          p_tournament_id: string
        }
        Returns: undefined
      }
      svc_unlink_riot_account: {
        Args: { p_reason: string; p_user_id: string }
        Returns: undefined
      }
      svc_update_tournament: {
        Args: {
          p_actor: string
          p_audit_action: string
          p_changes: Json
          p_config: Json
          p_event_type: string
          p_phases: Json
          p_reason: string
          p_tournament_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      audit_actor_type: "user" | "system" | "agent"
      bracket_side: "upper" | "lower" | "final"
      captaincy_transfer_status:
        | "pending"
        | "accepted"
        | "declined"
        | "canceled"
      checkin_method: "web" | "discord"
      circuit_status: "draft" | "active" | "completed" | "archived"
      club_role: "owner" | "manager" | "coach" | "analyst"
      club_status: "pending" | "active" | "inactive" | "banned"
      costream_policy: "disabled" | "registered_creators" | "approval_required"
      discord_channel_purpose:
        | "announcements"
        | "results"
        | "staff"
        | "match_voice_category"
      dispute_category:
        | "result"
        | "conduct"
        | "technical"
        | "eligibility"
        | "other"
      dispute_status: "open" | "under_review" | "resolved" | "rejected"
      draft_action_type: "pick" | "ban"
      draft_mode: "standard" | "fearless"
      eligibility_target: "player" | "team_average" | "roster"
      entrant_kind: "team" | "solo"
      entrant_status:
        | "pending"
        | "approved"
        | "rejected"
        | "waitlisted"
        | "withdrawn"
        | "disqualified"
      exclusivity_scope: "none" | "tournament" | "circuit" | "season"
      followable_type: "team" | "user" | "tournament" | "organization"
      game_map: "summoners_rift" | "howling_abyss"
      game_region: "la1" | "la2" | "na1" | "br1"
      game_side: "blue" | "red"
      game_status:
        | "pending"
        | "lobby"
        | "live"
        | "completed"
        | "remade"
        | "forfeit"
      gender: "woman" | "man" | "non_binary" | "prefer_not_to_say"
      inbound_webhook_status: "received" | "processed" | "failed" | "skipped"
      integrity_alert_status: "open" | "dismissed" | "actioned"
      integrity_alert_type:
        | "roster_mismatch"
        | "smurf_suspected"
        | "rank_violation"
        | "riot_id_changed"
        | "duplicate_identity"
        | "other"
      invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "expired"
        | "revoked"
      join_request_status: "pending" | "approved" | "declined" | "withdrawn"
      match_official_role: "referee" | "observer" | "caster" | "producer"
      match_slot: "a" | "b"
      match_status:
        | "pending"
        | "scheduled"
        | "checkin"
        | "ready"
        | "live"
        | "awaiting_result"
        | "disputed"
        | "completed"
        | "forfeit"
        | "canceled"
      member_status: "invited" | "active" | "removed"
      mvp_scope: "game" | "match" | "week" | "phase" | "tournament"
      notification_category:
        | "tournaments"
        | "matches"
        | "team"
        | "staff"
        | "announcements"
        | "marketing"
      notification_channel: "in_app" | "email" | "discord" | "push"
      notification_delivery_status: "queued" | "sent" | "delivered" | "failed"
      organization_status: "active" | "suspended"
      participant_policy: "independent_only" | "clubs_only" | "mixed"
      phase_entrant_status: "active" | "eliminated" | "advanced"
      phase_format:
        | "round_robin"
        | "double_round_robin"
        | "groups"
        | "single_elimination"
        | "double_elimination"
        | "swiss"
        | "gauntlet"
      phase_status: "pending" | "in_progress" | "completed"
      pick_type: "tournament_draft" | "blind_pick" | "draft_mode" | "all_random"
      platform_role: "user" | "support" | "super_admin"
      player_role: "top" | "jungle" | "mid" | "adc" | "support"
      privacy_visibility: "public" | "team" | "staff" | "private"
      prize_award_type: "placement" | "mvp" | "special"
      prize_delivery_status: "pending" | "shipped" | "delivered" | "claimed"
      prize_distribution: "team" | "per_player" | "captain"
      prize_type:
        | "cash"
        | "peripheral"
        | "merch"
        | "in_game"
        | "voucher"
        | "prestige"
        | "custom"
      push_platform: "web" | "ios" | "android"
      rank_queue: "solo" | "flex"
      reschedule_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "approved_by_admin"
        | "expired"
        | "canceled"
      result_source:
        | "riot_callback"
        | "dual_report"
        | "referee"
        | "admin_override"
        | "checkin_forfeit"
        | "bye"
      riot_setup_status: "active" | "disabled"
      riot_verification_method: "rso" | "icon"
      riot_verification_status: "pending" | "verified" | "expired" | "failed"
      roster_change_action: "add" | "remove" | "swap"
      roster_change_status: "pending" | "approved" | "rejected" | "canceled"
      roster_role: "starter" | "substitute" | "coach"
      season_status: "upcoming" | "active" | "completed" | "archived"
      series_format: "bo1" | "bo3" | "bo5"
      social_platform:
        | "twitch"
        | "youtube"
        | "tiktok"
        | "x"
        | "instagram"
        | "kick"
        | "other"
      spectator_type: "none" | "lobbyonly" | "all"
      standing_status: "qualified" | "eliminated" | "in_contention"
      stats_scope: "tournament" | "circuit" | "season" | "all_time"
      subject_type: "user" | "team" | "entrant" | "game"
      supervision_level: "automatic" | "dual_report" | "referee" | "broadcast"
      team_kind: "permanent" | "ad_hoc"
      team_role:
        | "captain"
        | "co_captain"
        | "player"
        | "substitute"
        | "coach"
        | "manager"
      team_source: "permanent_only" | "ad_hoc_allowed" | "ad_hoc_only"
      team_status: "active" | "inactive" | "disbanded" | "banned"
      tournament_code_status: "active" | "used" | "revoked"
      tournament_modality: "online" | "onsite" | "hybrid"
      tournament_staff_role: "manager" | "referee" | "producer" | "caster"
      tournament_status:
        | "draft"
        | "published"
        | "registration_open"
        | "registration_closed"
        | "seeding"
        | "in_progress"
        | "completed"
        | "canceled"
        | "archived"
      tournament_type:
        | "league"
        | "flash"
        | "womens"
        | "university"
        | "ranked_tier"
        | "custom"
      tournament_visibility: "public" | "unlisted" | "private"
      user_status: "active" | "suspended" | "banned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_actor_type: ["user", "system", "agent"],
      bracket_side: ["upper", "lower", "final"],
      captaincy_transfer_status: [
        "pending",
        "accepted",
        "declined",
        "canceled",
      ],
      checkin_method: ["web", "discord"],
      circuit_status: ["draft", "active", "completed", "archived"],
      club_role: ["owner", "manager", "coach", "analyst"],
      club_status: ["pending", "active", "inactive", "banned"],
      costream_policy: ["disabled", "registered_creators", "approval_required"],
      discord_channel_purpose: [
        "announcements",
        "results",
        "staff",
        "match_voice_category",
      ],
      dispute_category: [
        "result",
        "conduct",
        "technical",
        "eligibility",
        "other",
      ],
      dispute_status: ["open", "under_review", "resolved", "rejected"],
      draft_action_type: ["pick", "ban"],
      draft_mode: ["standard", "fearless"],
      eligibility_target: ["player", "team_average", "roster"],
      entrant_kind: ["team", "solo"],
      entrant_status: [
        "pending",
        "approved",
        "rejected",
        "waitlisted",
        "withdrawn",
        "disqualified",
      ],
      exclusivity_scope: ["none", "tournament", "circuit", "season"],
      followable_type: ["team", "user", "tournament", "organization"],
      game_map: ["summoners_rift", "howling_abyss"],
      game_region: ["la1", "la2", "na1", "br1"],
      game_side: ["blue", "red"],
      game_status: [
        "pending",
        "lobby",
        "live",
        "completed",
        "remade",
        "forfeit",
      ],
      gender: ["woman", "man", "non_binary", "prefer_not_to_say"],
      inbound_webhook_status: ["received", "processed", "failed", "skipped"],
      integrity_alert_status: ["open", "dismissed", "actioned"],
      integrity_alert_type: [
        "roster_mismatch",
        "smurf_suspected",
        "rank_violation",
        "riot_id_changed",
        "duplicate_identity",
        "other",
      ],
      invitation_status: [
        "pending",
        "accepted",
        "declined",
        "expired",
        "revoked",
      ],
      join_request_status: ["pending", "approved", "declined", "withdrawn"],
      match_official_role: ["referee", "observer", "caster", "producer"],
      match_slot: ["a", "b"],
      match_status: [
        "pending",
        "scheduled",
        "checkin",
        "ready",
        "live",
        "awaiting_result",
        "disputed",
        "completed",
        "forfeit",
        "canceled",
      ],
      member_status: ["invited", "active", "removed"],
      mvp_scope: ["game", "match", "week", "phase", "tournament"],
      notification_category: [
        "tournaments",
        "matches",
        "team",
        "staff",
        "announcements",
        "marketing",
      ],
      notification_channel: ["in_app", "email", "discord", "push"],
      notification_delivery_status: ["queued", "sent", "delivered", "failed"],
      organization_status: ["active", "suspended"],
      participant_policy: ["independent_only", "clubs_only", "mixed"],
      phase_entrant_status: ["active", "eliminated", "advanced"],
      phase_format: [
        "round_robin",
        "double_round_robin",
        "groups",
        "single_elimination",
        "double_elimination",
        "swiss",
        "gauntlet",
      ],
      phase_status: ["pending", "in_progress", "completed"],
      pick_type: ["tournament_draft", "blind_pick", "draft_mode", "all_random"],
      platform_role: ["user", "support", "super_admin"],
      player_role: ["top", "jungle", "mid", "adc", "support"],
      privacy_visibility: ["public", "team", "staff", "private"],
      prize_award_type: ["placement", "mvp", "special"],
      prize_delivery_status: ["pending", "shipped", "delivered", "claimed"],
      prize_distribution: ["team", "per_player", "captain"],
      prize_type: [
        "cash",
        "peripheral",
        "merch",
        "in_game",
        "voucher",
        "prestige",
        "custom",
      ],
      push_platform: ["web", "ios", "android"],
      rank_queue: ["solo", "flex"],
      reschedule_status: [
        "pending",
        "accepted",
        "rejected",
        "approved_by_admin",
        "expired",
        "canceled",
      ],
      result_source: [
        "riot_callback",
        "dual_report",
        "referee",
        "admin_override",
        "checkin_forfeit",
        "bye",
      ],
      riot_setup_status: ["active", "disabled"],
      riot_verification_method: ["rso", "icon"],
      riot_verification_status: ["pending", "verified", "expired", "failed"],
      roster_change_action: ["add", "remove", "swap"],
      roster_change_status: ["pending", "approved", "rejected", "canceled"],
      roster_role: ["starter", "substitute", "coach"],
      season_status: ["upcoming", "active", "completed", "archived"],
      series_format: ["bo1", "bo3", "bo5"],
      social_platform: [
        "twitch",
        "youtube",
        "tiktok",
        "x",
        "instagram",
        "kick",
        "other",
      ],
      spectator_type: ["none", "lobbyonly", "all"],
      standing_status: ["qualified", "eliminated", "in_contention"],
      stats_scope: ["tournament", "circuit", "season", "all_time"],
      subject_type: ["user", "team", "entrant", "game"],
      supervision_level: ["automatic", "dual_report", "referee", "broadcast"],
      team_kind: ["permanent", "ad_hoc"],
      team_role: [
        "captain",
        "co_captain",
        "player",
        "substitute",
        "coach",
        "manager",
      ],
      team_source: ["permanent_only", "ad_hoc_allowed", "ad_hoc_only"],
      team_status: ["active", "inactive", "disbanded", "banned"],
      tournament_code_status: ["active", "used", "revoked"],
      tournament_modality: ["online", "onsite", "hybrid"],
      tournament_staff_role: ["manager", "referee", "producer", "caster"],
      tournament_status: [
        "draft",
        "published",
        "registration_open",
        "registration_closed",
        "seeding",
        "in_progress",
        "completed",
        "canceled",
        "archived",
      ],
      tournament_type: [
        "league",
        "flash",
        "womens",
        "university",
        "ranked_tier",
        "custom",
      ],
      tournament_visibility: ["public", "unlisted", "private"],
      user_status: ["active", "suspended", "banned"],
    },
  },
} as const
