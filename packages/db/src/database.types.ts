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
      [_ in never]: never
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
      svc_dissolve_team: {
        Args: { p_actor: string; p_reason: string; p_team_id: string }
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
      svc_replace_social_links: {
        Args: { p_links: Json; p_user_id: string }
        Returns: undefined
      }
      svc_unlink_riot_account: {
        Args: { p_reason: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      audit_actor_type: "user" | "system" | "agent"
      captaincy_transfer_status:
        | "pending"
        | "accepted"
        | "declined"
        | "canceled"
      club_role: "owner" | "manager" | "coach" | "analyst"
      club_status: "pending" | "active" | "inactive" | "banned"
      game_region: "la1" | "la2" | "na1" | "br1"
      gender: "woman" | "man" | "non_binary" | "prefer_not_to_say"
      invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "expired"
        | "revoked"
      join_request_status: "pending" | "approved" | "declined" | "withdrawn"
      member_status: "invited" | "active" | "removed"
      organization_status: "active" | "suspended"
      platform_role: "user" | "support" | "super_admin"
      player_role: "top" | "jungle" | "mid" | "adc" | "support"
      privacy_visibility: "public" | "team" | "staff" | "private"
      rank_queue: "solo" | "flex"
      riot_verification_method: "rso" | "icon"
      riot_verification_status: "pending" | "verified" | "expired" | "failed"
      social_platform:
        | "twitch"
        | "youtube"
        | "tiktok"
        | "x"
        | "instagram"
        | "kick"
        | "other"
      team_kind: "permanent" | "ad_hoc"
      team_role:
        | "captain"
        | "co_captain"
        | "player"
        | "substitute"
        | "coach"
        | "manager"
      team_status: "active" | "inactive" | "disbanded" | "banned"
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
      captaincy_transfer_status: [
        "pending",
        "accepted",
        "declined",
        "canceled",
      ],
      club_role: ["owner", "manager", "coach", "analyst"],
      club_status: ["pending", "active", "inactive", "banned"],
      game_region: ["la1", "la2", "na1", "br1"],
      gender: ["woman", "man", "non_binary", "prefer_not_to_say"],
      invitation_status: [
        "pending",
        "accepted",
        "declined",
        "expired",
        "revoked",
      ],
      join_request_status: ["pending", "approved", "declined", "withdrawn"],
      member_status: ["invited", "active", "removed"],
      organization_status: ["active", "suspended"],
      platform_role: ["user", "support", "super_admin"],
      player_role: ["top", "jungle", "mid", "adc", "support"],
      privacy_visibility: ["public", "team", "staff", "private"],
      rank_queue: ["solo", "flex"],
      riot_verification_method: ["rso", "icon"],
      riot_verification_status: ["pending", "verified", "expired", "failed"],
      social_platform: [
        "twitch",
        "youtube",
        "tiktok",
        "x",
        "instagram",
        "kick",
        "other",
      ],
      team_kind: ["permanent", "ad_hoc"],
      team_role: [
        "captain",
        "co_captain",
        "player",
        "substitute",
        "coach",
        "manager",
      ],
      team_status: ["active", "inactive", "disbanded", "banned"],
      user_status: ["active", "suspended", "banned"],
    },
  },
} as const
