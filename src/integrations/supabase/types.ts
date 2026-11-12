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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          guard_id: string | null
          id: string
          message: string
          severity: Database["public"]["Enums"]["alert_severity"]
          shift_id: string | null
          status: Database["public"]["Enums"]["alert_status"]
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          guard_id?: string | null
          id?: string
          message: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          shift_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          guard_id?: string | null
          id?: string
          message?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          shift_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          accuracy: number | null
          created_at: string
          event_id: string | null
          gps_override_by: string | null
          guard_id: string
          id: string
          latitude: number | null
          longitude: number | null
          sign_off_method: string | null
          sign_on_method: string
          signed_off_at: string | null
          signed_on_at: string
          signed_on_by: string | null
          slot_id: string | null
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          event_id?: string | null
          gps_override_by?: string | null
          guard_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          sign_off_method?: string | null
          sign_on_method?: string
          signed_off_at?: string | null
          signed_on_at?: string
          signed_on_by?: string | null
          slot_id?: string | null
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          event_id?: string | null
          gps_override_by?: string | null
          guard_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          sign_off_method?: string | null
          sign_on_method?: string
          signed_off_at?: string | null
          signed_on_at?: string
          signed_on_by?: string | null
          slot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "roster_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_details: Json
          event_type: string
          guard_id: string | null
          id: string
          incident_id: string | null
          shift_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_details?: Json
          event_type: string
          guard_id?: string | null
          id?: string
          incident_id?: string | null
          shift_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_details?: Json
          event_type?: string
          guard_id?: string | null
          id?: string
          incident_id?: string | null
          shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_members: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_members_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          contact_name: string | null
          created_at: string
          email: string | null
          gps_required: boolean | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          gps_required?: boolean | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          gps_required?: boolean | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_details: {
        Row: {
          briefing: string
          client_contact: string | null
          client_name: string | null
          created_at: string
          emergency_procedures: string
          end_time: string
          entry_instructions: string | null
          event_name: string
          expected_attendance: number
          id: string
          site_id: string | null
          start_time: string
          status: string
          supervisor_name: string
          supervisor_phone: string
          updated_at: string
          venue_name: string
        }
        Insert: {
          briefing: string
          client_contact?: string | null
          client_name?: string | null
          created_at?: string
          emergency_procedures: string
          end_time: string
          entry_instructions?: string | null
          event_name: string
          expected_attendance?: number
          id?: string
          site_id?: string | null
          start_time: string
          status?: string
          supervisor_name: string
          supervisor_phone: string
          updated_at?: string
          venue_name: string
        }
        Update: {
          briefing?: string
          client_contact?: string | null
          client_name?: string | null
          created_at?: string
          emergency_procedures?: string
          end_time?: string
          entry_instructions?: string | null
          event_name?: string
          expected_attendance?: number
          id?: string
          site_id?: string | null
          start_time?: string
          status?: string
          supervisor_name?: string
          supervisor_phone?: string
          updated_at?: string
          venue_name?: string
        }
        Relationships: []
      }
      event_location_settings: {
        Row: {
          enabled: boolean
          event_id: string
          fresh_s: number
          low_accuracy_m: number
          notice_version: string
          stale_s: number
          updated_at: string
          updated_by_name: string | null
          upload_interval_s: number
        }
        Insert: {
          enabled?: boolean
          event_id: string
          fresh_s?: number
          low_accuracy_m?: number
          notice_version?: string
          stale_s?: number
          updated_at?: string
          updated_by_name?: string | null
          upload_interval_s?: number
        }
        Update: {
          enabled?: boolean
          event_id?: string
          fresh_s?: number
          low_accuracy_m?: number
          notice_version?: string
          stale_s?: number
          updated_at?: string
          updated_by_name?: string | null
          upload_interval_s?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_location_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_scope_changes: {
        Row: {
          additional_guards: number
          additional_supervisors: number
          client_reference: string | null
          cost_breakdown: Json
          created_at: string
          currency: string
          equipment_required: string | null
          id: string
          operational_reason: string
          requested_at: string
          requested_by_name: string
          requested_by_user_id: string | null
          required_from: string | null
          required_until: string | null
          scope_detail: string
          senior_leader_name: string | null
          senior_leader_role: string | null
          shift_id: string | null
          signed_off_at: string | null
          signoff_notes: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["scope_change_status"]
          title: string
          total_cost: number
          updated_at: string
        }
        Insert: {
          additional_guards?: number
          additional_supervisors?: number
          client_reference?: string | null
          cost_breakdown?: Json
          created_at?: string
          currency?: string
          equipment_required?: string | null
          id?: string
          operational_reason: string
          requested_at?: string
          requested_by_name: string
          requested_by_user_id?: string | null
          required_from?: string | null
          required_until?: string | null
          scope_detail: string
          senior_leader_name?: string | null
          senior_leader_role?: string | null
          shift_id?: string | null
          signed_off_at?: string | null
          signoff_notes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["scope_change_status"]
          title: string
          total_cost?: number
          updated_at?: string
        }
        Update: {
          additional_guards?: number
          additional_supervisors?: number
          client_reference?: string | null
          cost_breakdown?: Json
          created_at?: string
          currency?: string
          equipment_required?: string | null
          id?: string
          operational_reason?: string
          requested_at?: string
          requested_by_name?: string
          requested_by_user_id?: string | null
          required_from?: string | null
          required_until?: string | null
          scope_detail?: string
          senior_leader_name?: string | null
          senior_leader_role?: string | null
          shift_id?: string | null
          signed_off_at?: string | null
          signoff_notes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["scope_change_status"]
          title?: string
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_scope_changes_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_scope_changes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sms_settings: {
        Row: {
          account_name: string | null
          connection_status: string
          credential_id: string | null
          credentials_updated_at: string | null
          enabled: boolean
          environment: string
          event_id: string
          last_test: Json | null
          last_test_at: string | null
          last_test_ok_at: string | null
          provider: string
          sender_id: string | null
          updated_at: string
          updated_by_name: string | null
        }
        Insert: {
          account_name?: string | null
          connection_status?: string
          credential_id?: string | null
          credentials_updated_at?: string | null
          enabled?: boolean
          environment?: string
          event_id: string
          last_test?: Json | null
          last_test_at?: string | null
          last_test_ok_at?: string | null
          provider?: string
          sender_id?: string | null
          updated_at?: string
          updated_by_name?: string | null
        }
        Update: {
          account_name?: string | null
          connection_status?: string
          credential_id?: string | null
          credentials_updated_at?: string | null
          enabled?: boolean
          environment?: string
          event_id?: string
          last_test?: Json | null
          last_test_at?: string | null
          last_test_ok_at?: string | null
          provider?: string
          sender_id?: string | null
          updated_at?: string
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sms_settings_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "sms_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sms_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_date: string | null
          gps_required: boolean
          id: string
          name: string
          status: string
          timezone: string
          updated_at: string
          venue: string
          venue_lat: number | null
          venue_lng: number | null
          venue_radius_m: number
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          gps_required?: boolean
          id?: string
          name: string
          status?: string
          timezone?: string
          updated_at?: string
          venue?: string
          venue_lat?: number | null
          venue_lng?: number | null
          venue_radius_m?: number
        }
        Update: {
          created_at?: string
          event_date?: string | null
          gps_required?: boolean
          id?: string
          name?: string
          status?: string
          timezone?: string
          updated_at?: string
          venue?: string
          venue_lat?: number | null
          venue_lng?: number | null
          venue_radius_m?: number
        }
        Relationships: []
      }
      guard_group_members: {
        Row: {
          group_id: string
          guard_id: string
        }
        Insert: {
          group_id: string
          guard_id: string
        }
        Update: {
          group_id?: string
          guard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "guard_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_group_members_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_groups: {
        Row: {
          contractor_id: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          filter: Json
          id: string
          kind: string
          name: string
        }
        Insert: {
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          filter?: Json
          id?: string
          kind?: string
          name: string
        }
        Update: {
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          filter?: Json
          id?: string
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_groups_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_latest_locations: {
        Row: {
          accuracy: number | null
          captured_at: string
          contractor_id: string | null
          event_id: string
          guard_id: string
          latitude: number
          longitude: number
          received_at: string
          sample_id: string | null
          session_id: string
          source: string
        }
        Insert: {
          accuracy?: number | null
          captured_at: string
          contractor_id?: string | null
          event_id: string
          guard_id: string
          latitude: number
          longitude: number
          received_at?: string
          sample_id?: string | null
          session_id: string
          source?: string
        }
        Update: {
          accuracy?: number | null
          captured_at?: string
          contractor_id?: string | null
          event_id?: string
          guard_id?: string
          latitude?: number
          longitude?: number
          received_at?: string
          sample_id?: string | null
          session_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_latest_locations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_latest_locations_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_latest_locations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "guard_tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_location_consents: {
        Row: {
          accepted_at: string
          event_id: string
          guard_id: string
          id: string
          notice_version: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string
          event_id: string
          guard_id: string
          id?: string
          notice_version: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string
          event_id?: string
          guard_id?: string
          id?: string
          notice_version?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guard_location_consents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_location_consents_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_tracking_sessions: {
        Row: {
          attendance_id: string
          consent_id: string | null
          contractor_id: string | null
          device_id: string
          event_id: string
          expires_at: string
          guard_id: string
          id: string
          slot_id: string | null
          started_at: string
          stop_reason: string | null
          stopped_at: string | null
        }
        Insert: {
          attendance_id: string
          consent_id?: string | null
          contractor_id?: string | null
          device_id: string
          event_id: string
          expires_at: string
          guard_id: string
          id?: string
          slot_id?: string | null
          started_at?: string
          stop_reason?: string | null
          stopped_at?: string | null
        }
        Update: {
          attendance_id?: string
          consent_id?: string | null
          contractor_id?: string | null
          device_id?: string
          event_id?: string
          expires_at?: string
          guard_id?: string
          id?: string
          slot_id?: string | null
          started_at?: string
          stop_reason?: string | null
          stopped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guard_tracking_sessions_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_tracking_sessions_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "guard_location_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_tracking_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_tracking_sessions_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_tracking_sessions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "roster_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      guards: {
        Row: {
          contractor_id: string | null
          created_at: string
          email: string
          emergency_contact: string
          employee_id: string
          id: string
          licence_number: string
          name: string
          phone: string
          profile_photo: string | null
          status: Database["public"]["Enums"]["guard_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contractor_id?: string | null
          created_at?: string
          email: string
          emergency_contact: string
          employee_id: string
          id?: string
          licence_number: string
          name: string
          phone: string
          profile_photo?: string | null
          status?: Database["public"]["Enums"]["guard_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contractor_id?: string | null
          created_at?: string
          email?: string
          emergency_contact?: string
          employee_id?: string
          id?: string
          licence_number?: string
          name?: string
          phone?: string
          profile_photo?: string | null
          status?: Database["public"]["Enums"]["guard_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guards_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_media: {
        Row: {
          created_at: string
          file_type: string
          file_url: string
          id: string
          incident_id: string
          uploaded_by_user_id: string
        }
        Insert: {
          created_at?: string
          file_type: string
          file_url: string
          id?: string
          incident_id: string
          uploaded_by_user_id: string
        }
        Update: {
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          incident_id?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_media_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          action_taken: string | null
          admin_notes: string | null
          created_at: string
          description: string
          guard_id: string
          id: string
          incident_type: string
          latitude: number | null
          longitude: number | null
          media_files: Json
          persons_involved: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          shift_id: string
          site_id: string
          status: Database["public"]["Enums"]["incident_status"]
          updated_at: string
          witness_notes: string | null
        }
        Insert: {
          action_taken?: string | null
          admin_notes?: string | null
          created_at?: string
          description: string
          guard_id: string
          id?: string
          incident_type: string
          latitude?: number | null
          longitude?: number | null
          media_files?: Json
          persons_involved?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          shift_id: string
          site_id: string
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
          witness_notes?: string | null
        }
        Update: {
          action_taken?: string | null
          admin_notes?: string | null
          created_at?: string
          description?: string
          guard_id?: string
          id?: string
          incident_type?: string
          latitude?: number | null
          longitude?: number | null
          media_files?: Json
          persons_involved?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          shift_id?: string
          site_id?: string
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
          witness_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      location_updates: {
        Row: {
          accuracy: number | null
          guard_id: string
          id: string
          latitude: number
          longitude: number
          shift_id: string
          status: Database["public"]["Enums"]["location_status"]
          timestamp: string
        }
        Insert: {
          accuracy?: number | null
          guard_id: string
          id?: string
          latitude: number
          longitude: number
          shift_id: string
          status?: Database["public"]["Enums"]["location_status"]
          timestamp?: string
        }
        Update: {
          accuracy?: number | null
          guard_id?: string
          id?: string
          latitude?: number
          longitude?: number
          shift_id?: string
          status?: Database["public"]["Enums"]["location_status"]
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_updates_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_updates_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_invites: {
        Row: {
          assigned_role: string | null
          company_name: string
          created_at: string
          event_name: string | null
          expires_at: string | null
          id: string
          invite_code: string
          site_id: string | null
          status: Database["public"]["Enums"]["invite_status"]
          updated_at: string
          used_by_user_id: string | null
        }
        Insert: {
          assigned_role?: string | null
          company_name?: string
          created_at?: string
          event_name?: string | null
          expires_at?: string | null
          id?: string
          invite_code: string
          site_id?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
          used_by_user_id?: string | null
        }
        Update: {
          assigned_role?: string | null
          company_name?: string
          created_at?: string
          event_name?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          site_id?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
          used_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_invites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_positions: {
        Row: {
          assigned_guard_id: string | null
          created_at: string
          id: string
          label: string
          latitude: number
          longitude: number
          plan_file_id: string | null
          radius_meters: number
          required_from: string | null
          required_until: string | null
          site_id: string
          source_reference: string | null
          status: Database["public"]["Enums"]["planned_position_status"]
          updated_at: string
          zone: string
        }
        Insert: {
          assigned_guard_id?: string | null
          created_at?: string
          id?: string
          label: string
          latitude: number
          longitude: number
          plan_file_id?: string | null
          radius_meters?: number
          required_from?: string | null
          required_until?: string | null
          site_id: string
          source_reference?: string | null
          status?: Database["public"]["Enums"]["planned_position_status"]
          updated_at?: string
          zone: string
        }
        Update: {
          assigned_guard_id?: string | null
          created_at?: string
          id?: string
          label?: string
          latitude?: number
          longitude?: number
          plan_file_id?: string | null
          radius_meters?: number
          required_from?: string | null
          required_until?: string | null
          site_id?: string
          source_reference?: string | null
          status?: Database["public"]["Enums"]["planned_position_status"]
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_positions_assigned_guard_id_fkey"
            columns: ["assigned_guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_positions_plan_file_id_fkey"
            columns: ["plan_file_id"]
            isOneToOne: false
            referencedRelation: "position_plan_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_positions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      position_plan_files: {
        Row: {
          created_at: string
          extracted_positions_count: number
          file_name: string
          file_type: string
          file_url: string
          id: string
          notes: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["plan_file_status"]
          updated_at: string
          uploaded_by_user_id: string
        }
        Insert: {
          created_at?: string
          extracted_positions_count?: number
          file_name: string
          file_type: string
          file_url: string
          id?: string
          notes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["plan_file_status"]
          updated_at?: string
          uploaded_by_user_id: string
        }
        Update: {
          created_at?: string
          extracted_positions_count?: number
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          notes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["plan_file_status"]
          updated_at?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_plan_files_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      roster_change_log: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          change_type: string
          created_at: string
          event_id: string
          id: string
          slot_id: string | null
          summary: string
          variation_id: string | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          change_type: string
          created_at?: string
          event_id: string
          id?: string
          slot_id?: string | null
          summary: string
          variation_id?: string | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          change_type?: string
          created_at?: string
          event_id?: string
          id?: string
          slot_id?: string | null
          summary?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_change_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_change_log_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "roster_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_change_log_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_slot_costs: {
        Row: {
          created_at: string
          event_id: string
          hourly_rate: number
          paid_hours: number | null
          slot_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          hourly_rate?: number
          paid_hours?: number | null
          slot_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          hourly_rate?: number
          paid_hours?: number | null
          slot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_slot_costs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_slot_costs_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: true
            referencedRelation: "roster_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_slots: {
        Row: {
          assigned_guard_id: string | null
          assigned_guard_name: string | null
          contractor_id: string | null
          created_at: string
          current_end: string
          current_start: string
          event_id: string
          id: string
          is_additional: boolean
          notes: string | null
          original_contractor_id: string | null
          original_end: string | null
          original_position: string | null
          original_role: string | null
          original_scope: string | null
          original_start: string | null
          original_zone: string | null
          position: string
          required: boolean
          role: string
          scope: string
          shift_ref: string
          source_variation_id: string | null
          status: string
          temp_redeploy: Json | null
          updated_at: string
          version: number
          zone: string
        }
        Insert: {
          assigned_guard_id?: string | null
          assigned_guard_name?: string | null
          contractor_id?: string | null
          created_at?: string
          current_end: string
          current_start: string
          event_id: string
          id?: string
          is_additional?: boolean
          notes?: string | null
          original_contractor_id?: string | null
          original_end?: string | null
          original_position?: string | null
          original_role?: string | null
          original_scope?: string | null
          original_start?: string | null
          original_zone?: string | null
          position?: string
          required?: boolean
          role?: string
          scope?: string
          shift_ref: string
          source_variation_id?: string | null
          status?: string
          temp_redeploy?: Json | null
          updated_at?: string
          version?: number
          zone?: string
        }
        Update: {
          assigned_guard_id?: string | null
          assigned_guard_name?: string | null
          contractor_id?: string | null
          created_at?: string
          current_end?: string
          current_start?: string
          event_id?: string
          id?: string
          is_additional?: boolean
          notes?: string | null
          original_contractor_id?: string | null
          original_end?: string | null
          original_position?: string | null
          original_role?: string | null
          original_scope?: string | null
          original_start?: string | null
          original_zone?: string | null
          position?: string
          required?: boolean
          role?: string
          scope?: string
          shift_ref?: string
          source_variation_id?: string | null
          status?: string
          temp_redeploy?: Json | null
          updated_at?: string
          version?: number
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_slots_assigned_guard_id_fkey"
            columns: ["assigned_guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_slots_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_variations: {
        Row: {
          approver_name: string | null
          approver_role: string | null
          approver_user_id: string | null
          cost_delta: number
          created_at: string
          currency: string
          guard_id: string
          id: string
          original_cost: number | null
          original_end_time: string | null
          original_location: string | null
          original_start_time: string | null
          proposed_cost: number | null
          proposed_end_time: string | null
          proposed_location: string | null
          proposed_start_time: string | null
          requested_by_user_id: string
          roster_upload_id: string | null
          shift_id: string
          signed_off_at: string | null
          signoff_notes: string | null
          status: Database["public"]["Enums"]["roster_variation_status"]
          updated_at: string
          variation_reason: string
        }
        Insert: {
          approver_name?: string | null
          approver_role?: string | null
          approver_user_id?: string | null
          cost_delta?: number
          created_at?: string
          currency?: string
          guard_id: string
          id?: string
          original_cost?: number | null
          original_end_time?: string | null
          original_location?: string | null
          original_start_time?: string | null
          proposed_cost?: number | null
          proposed_end_time?: string | null
          proposed_location?: string | null
          proposed_start_time?: string | null
          requested_by_user_id: string
          roster_upload_id?: string | null
          shift_id: string
          signed_off_at?: string | null
          signoff_notes?: string | null
          status?: Database["public"]["Enums"]["roster_variation_status"]
          updated_at?: string
          variation_reason: string
        }
        Update: {
          approver_name?: string | null
          approver_role?: string | null
          approver_user_id?: string | null
          cost_delta?: number
          created_at?: string
          currency?: string
          guard_id?: string
          id?: string
          original_cost?: number | null
          original_end_time?: string | null
          original_location?: string | null
          original_start_time?: string | null
          proposed_cost?: number | null
          proposed_end_time?: string | null
          proposed_location?: string | null
          proposed_start_time?: string | null
          requested_by_user_id?: string
          roster_upload_id?: string | null
          shift_id?: string
          signed_off_at?: string | null
          signoff_notes?: string | null
          status?: Database["public"]["Enums"]["roster_variation_status"]
          updated_at?: string
          variation_reason?: string
        }
        Relationships: []
      }
      roster_versions: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          kind: string
          label: string
          slot_count: number
          source_file_name: string | null
          variation_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          kind?: string
          label: string
          slot_count?: number
          source_file_name?: string | null
          variation_id?: string | null
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          kind?: string
          label?: string
          slot_count?: number
          source_file_name?: string | null
          variation_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "roster_versions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      security_roster_uploads: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          imported_rows: number
          notes: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["roster_upload_status"]
          updated_at: string
          uploaded_by_user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          imported_rows?: number
          notes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["roster_upload_status"]
          updated_at?: string
          uploaded_by_user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          imported_rows?: number
          notes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["roster_upload_status"]
          updated_at?: string
          uploaded_by_user_id?: string
        }
        Relationships: []
      }
      shift_extensions: {
        Row: {
          approved_at: string | null
          approved_by_name: string | null
          approved_by_user_id: string | null
          created_at: string
          decision_notes: string | null
          estimated_cost: number
          guard_id: string
          id: string
          reason: string
          requested_by_user_id: string
          requested_until: string
          shift_id: string
          status: Database["public"]["Enums"]["shift_extension_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          decision_notes?: string | null
          estimated_cost?: number
          guard_id: string
          id?: string
          reason: string
          requested_by_user_id: string
          requested_until: string
          shift_id: string
          status?: Database["public"]["Enums"]["shift_extension_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          decision_notes?: string | null
          estimated_cost?: number
          guard_id?: string
          id?: string
          reason?: string
          requested_by_user_id?: string
          requested_until?: string
          shift_id?: string
          status?: Database["public"]["Enums"]["shift_extension_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_extensions_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_extensions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          briefing: string
          briefing_acknowledged_at: string | null
          created_at: string
          emergency_procedures: string | null
          end_shift_notes: string | null
          end_time: string
          guard_id: string
          id: string
          key_instructions: string | null
          log_off_location: Json | null
          log_on_location: Json | null
          logged_off_at: string | null
          logged_on_at: string | null
          notes: string | null
          role: string
          roster_cost: number
          roster_currency: string
          roster_hourly_rate: number | null
          roster_location: string | null
          roster_planned_hours: number | null
          roster_row_reference: string | null
          roster_upload_id: string | null
          roster_variation_status: Database["public"]["Enums"]["roster_variation_status"]
          site_id: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
          updated_at: string
          zone: string
        }
        Insert: {
          briefing: string
          briefing_acknowledged_at?: string | null
          created_at?: string
          emergency_procedures?: string | null
          end_shift_notes?: string | null
          end_time: string
          guard_id: string
          id?: string
          key_instructions?: string | null
          log_off_location?: Json | null
          log_on_location?: Json | null
          logged_off_at?: string | null
          logged_on_at?: string | null
          notes?: string | null
          role: string
          roster_cost?: number
          roster_currency?: string
          roster_hourly_rate?: number | null
          roster_location?: string | null
          roster_planned_hours?: number | null
          roster_row_reference?: string | null
          roster_upload_id?: string | null
          roster_variation_status?: Database["public"]["Enums"]["roster_variation_status"]
          site_id: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
          zone: string
        }
        Update: {
          briefing?: string
          briefing_acknowledged_at?: string | null
          created_at?: string
          emergency_procedures?: string | null
          end_shift_notes?: string | null
          end_time?: string
          guard_id?: string
          id?: string
          key_instructions?: string | null
          log_off_location?: Json | null
          log_on_location?: Json | null
          logged_off_at?: string | null
          logged_on_at?: string | null
          notes?: string | null
          role?: string
          roster_cost?: number
          roster_currency?: string
          roster_hourly_rate?: number | null
          roster_location?: string | null
          roster_planned_hours?: number | null
          roster_row_reference?: string | null
          roster_upload_id?: string | null
          roster_variation_status?: Database["public"]["Enums"]["roster_variation_status"]
          site_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string
          created_at: string
          geo_fence_coordinates: Json
          id: string
          map_reference: string | null
          name: string
          supervisor_name: string
          supervisor_phone: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          geo_fence_coordinates?: Json
          id?: string
          map_reference?: string | null
          name: string
          supervisor_name: string
          supervisor_phone: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          geo_fence_coordinates?: Json
          id?: string
          map_reference?: string | null
          name?: string
          supervisor_name?: string
          supervisor_phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_credentials: {
        Row: {
          ciphertext: string
          created_at: string
          created_by: string | null
          environment: string
          id: string
          iv: string
          provider: string
          updated_at: string
          webhook_token_hash: string | null
          webhooks_registered_at: string | null
        }
        Insert: {
          ciphertext: string
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          iv: string
          provider?: string
          updated_at?: string
          webhook_token_hash?: string | null
          webhooks_registered_at?: string | null
        }
        Update: {
          ciphertext?: string
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          iv?: string
          provider?: string
          updated_at?: string
          webhook_token_hash?: string | null
          webhooks_registered_at?: string | null
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          audience_label: string
          body: string
          claimed_at: string | null
          client_key: string | null
          contractor_id: string | null
          created_at: string
          credential_id: string | null
          error: string | null
          event_id: string | null
          id: string
          provider: string
          provider_account: string | null
          provider_reference: string | null
          recipient_count: number
          sender_id: string | null
          sent_at: string | null
          sent_by_name: string | null
          sent_by_user: string | null
          status: string
          variation_id: string | null
        }
        Insert: {
          audience_label: string
          body: string
          claimed_at?: string | null
          client_key?: string | null
          contractor_id?: string | null
          created_at?: string
          credential_id?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          provider?: string
          provider_account?: string | null
          provider_reference?: string | null
          recipient_count?: number
          sender_id?: string | null
          sent_at?: string | null
          sent_by_name?: string | null
          sent_by_user?: string | null
          status?: string
          variation_id?: string | null
        }
        Update: {
          audience_label?: string
          body?: string
          claimed_at?: string | null
          client_key?: string | null
          contractor_id?: string | null
          created_at?: string
          credential_id?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          provider?: string
          provider_account?: string | null
          provider_reference?: string | null
          recipient_count?: number
          sender_id?: string | null
          sent_at?: string | null
          sent_by_name?: string | null
          sent_by_user?: string | null
          status?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "sms_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_recipients: {
        Row: {
          error: string | null
          guard_id: string | null
          id: string
          message_id: string
          phone: string | null
          provider_sms_id: string | null
          status: string
          submission_status: string
          to_number: string | null
          updated_at: string
        }
        Insert: {
          error?: string | null
          guard_id?: string | null
          id?: string
          message_id: string
          phone?: string | null
          provider_sms_id?: string | null
          status?: string
          submission_status?: string
          to_number?: string | null
          updated_at?: string
        }
        Update: {
          error?: string | null
          guard_id?: string | null
          id?: string
          message_id?: string
          phone?: string | null
          provider_sms_id?: string | null
          status?: string
          submission_status?: string
          to_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_recipients_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "sms_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_webhook_events: {
        Row: {
          credential_id: string | null
          event_type: string | null
          id: string
          payload: Json
          provider_event_id: string
          received_at: string
        }
        Insert: {
          credential_id?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          provider_event_id: string
          received_at?: string
        }
        Update: {
          credential_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          provider_event_id?: string
          received_at?: string
        }
        Relationships: []
      }
      staff_email_alerts: {
        Row: {
          attempts: number
          by_name: string | null
          claimed_at: string | null
          contractor_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          kind: string
          last_error: string | null
          link: string | null
          ref: string | null
          sent_at: string | null
          shift_count: number
          sms_message_id: string | null
          status: string
          type_label: string | null
          user_id: string | null
          variation_id: string | null
        }
        Insert: {
          attempts?: number
          by_name?: string | null
          claimed_at?: string | null
          contractor_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          kind: string
          last_error?: string | null
          link?: string | null
          ref?: string | null
          sent_at?: string | null
          shift_count?: number
          sms_message_id?: string | null
          status?: string
          type_label?: string | null
          user_id?: string | null
          variation_id?: string | null
        }
        Update: {
          attempts?: number
          by_name?: string | null
          claimed_at?: string | null
          contractor_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          link?: string | null
          ref?: string | null
          sent_at?: string | null
          shift_count?: number
          sms_message_id?: string | null
          status?: string
          type_label?: string | null
          user_id?: string | null
          variation_id?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variation_costs: {
        Row: {
          cost_delta: number | null
          created_at: string
          event_id: string
          hourly_rate: number
          original_cost: number
          original_hours: number
          proposed_cost: number
          proposed_hours: number
          variation_id: string
        }
        Insert: {
          cost_delta?: number | null
          created_at?: string
          event_id: string
          hourly_rate?: number
          original_cost?: number
          original_hours?: number
          proposed_cost?: number
          proposed_hours?: number
          variation_id: string
        }
        Update: {
          cost_delta?: number | null
          created_at?: string
          event_id?: string
          hourly_rate?: number
          original_cost?: number
          original_hours?: number
          proposed_cost?: number
          proposed_hours?: number
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variation_costs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variation_costs_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: true
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      variations: {
        Row: {
          ack_at: string | null
          ack_by_name: string | null
          ack_by_user: string | null
          ack_comments: string | null
          applied_at: string | null
          approved_at: string | null
          approved_by_name: string | null
          approved_by_user: string | null
          contractor_id: string | null
          created_at: string
          decision_notes: string | null
          event_id: string
          group_id: string | null
          id: string
          notes: string | null
          original: Json
          proposed: Json
          reason: string
          ref: string
          requested_by_name: string
          requested_by_user: string | null
          slot_id: string | null
          status: string
          updated_at: string
          variation_type: string
        }
        Insert: {
          ack_at?: string | null
          ack_by_name?: string | null
          ack_by_user?: string | null
          ack_comments?: string | null
          applied_at?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_user?: string | null
          contractor_id?: string | null
          created_at?: string
          decision_notes?: string | null
          event_id: string
          group_id?: string | null
          id?: string
          notes?: string | null
          original?: Json
          proposed?: Json
          reason: string
          ref?: string
          requested_by_name: string
          requested_by_user?: string | null
          slot_id?: string | null
          status?: string
          updated_at?: string
          variation_type: string
        }
        Update: {
          ack_at?: string | null
          ack_by_name?: string | null
          ack_by_user?: string | null
          ack_comments?: string | null
          applied_at?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_user?: string | null
          contractor_id?: string | null
          created_at?: string
          decision_notes?: string | null
          event_id?: string
          group_id?: string | null
          id?: string
          notes?: string | null
          original?: Json
          proposed?: Json
          reason?: string
          ref?: string
          requested_by_name?: string
          requested_by_user?: string | null
          slot_id?: string | null
          status?: string
          updated_at?: string
          variation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "variations_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variations_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "roster_slots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_variation: {
        Args: { _comments?: string; _id: string }
        Returns: undefined
      }
      acknowledge_variation_group: {
        Args: { _comments?: string; _group_id: string }
        Returns: number
      }
      actor_name: { Args: never; Returns: string }
      allocate_guard: {
        Args: { _attendance_id: string; _slot_id: string }
        Returns: undefined
      }
      approve_variation: {
        Args: { _id: string; _notes?: string }
        Returns: undefined
      }
      approve_variation_group: {
        Args: { _group_id: string; _notes?: string }
        Returns: number
      }
      assign_guard_to_slot: {
        Args: { _guard_id: string; _slot_id: string }
        Returns: undefined
      }
      auto_complete_due_shifts: { Args: never; Returns: number }
      auto_sign_off_due: { Args: never; Returns: number }
      can_access_contractor: {
        Args: { _contractor_id: string }
        Returns: boolean
      }
      can_approve_variations: { Args: { _user_id: string }; Returns: boolean }
      can_read_contractor: {
        Args: { _contractor_id: string }
        Returns: boolean
      }
      can_read_event_location_settings: {
        Args: { _event_id: string }
        Returns: boolean
      }
      can_view_costs: { Args: { _user_id: string }; Returns: boolean }
      claim_sms_messages: { Args: { _limit?: number }; Returns: string[] }
      claim_staff_email_alerts: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          by_name: string | null
          claimed_at: string | null
          contractor_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          kind: string
          last_error: string | null
          link: string | null
          ref: string | null
          sent_at: string | null
          shift_count: number
          sms_message_id: string | null
          status: string
          type_label: string | null
          user_id: string | null
          variation_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "staff_email_alerts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_expired_tracking_sessions: { Args: never; Returns: number }
      close_tracking_session: {
        Args: { _reason: string; _session_id: string }
        Returns: undefined
      }
      decide_variation: {
        Args: { _decision: string; _id: string; _notes?: string }
        Returns: undefined
      }
      decide_variation_group: {
        Args: { _decision: string; _group_id: string; _notes?: string }
        Returns: number
      }
      guard_on_slot: { Args: { _slot_id: string }; Returns: boolean }
      guard_owns_guard: { Args: { _guard_id: string }; Returns: boolean }
      guard_owns_shift: { Args: { _shift_id: string }; Returns: boolean }
      guard_sign_on: {
        Args: { _accuracy?: number; _lat?: number; _lng?: number }
        Returns: string
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_role: { Args: { _user_id: string }; Returns: boolean }
      is_contractor_member: {
        Args: { _contractor_id: string; _user_id: string }
        Returns: boolean
      }
      is_event_staff: { Args: { _user_id: string }; Returns: boolean }
      is_roster_manager: { Args: { _user_id: string }; Returns: boolean }
      list_signup_providers: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      manager_sign_on: {
        Args: { _guard_id: string; _slot_id?: string }
        Returns: string
      }
      queue_variation_staff_alert: {
        Args: { _contractor_id: string; _key: string; _kind: string }
        Returns: undefined
      }
      reset_event_roster: { Args: { _event_id: string }; Returns: number }
      roll_demo_shifts: { Args: never; Returns: number }
      save_event_location_settings: {
        Args: {
          _enabled: boolean
          _event_id: string
          _fresh_s: number
          _low_accuracy_m: number
          _stale_s: number
          _upload_interval_s: number
        }
        Returns: undefined
      }
      set_user_mobile: {
        Args: { _phone: string; _user_id: string }
        Returns: undefined
      }
      shares_contractor: {
        Args: { _user: string; _viewer: string }
        Returns: boolean
      }
      sign_off_attendance: {
        Args: { _attendance_id: string }
        Returns: undefined
      }
      start_location_sharing: {
        Args: { _device_id: string; _notice_version: string }
        Returns: string
      }
      stop_location_sharing: {
        Args: { _reason?: string; _withdraw_consent?: boolean }
        Returns: undefined
      }
      submit_guard_location: {
        Args: {
          _accuracy: number
          _captured_at: string
          _lat: number
          _lng: number
          _sample_id?: string
          _session_id: string
        }
        Returns: Json
      }
      sync_staff_email_retry: { Args: never; Returns: undefined }
      variation_alert_recipients: {
        Args: { _contractor_id: string; _exclude: string; _kind: string }
        Returns: {
          email: string
          full_name: string
          phone: string
          user_id: string
        }[]
      }
      wake_sms_dispatch: { Args: never; Returns: undefined }
      wake_staff_email_alerts: { Args: never; Returns: undefined }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      alert_status: "open" | "acknowledged" | "resolved"
      app_role:
        | "super_admin"
        | "operations_manager"
        | "site_supervisor"
        | "security_guard"
        | "event_manager"
        | "contractor_manager"
        | "security_manager"
        | "senior_management"
        | "event_control_assistant"
        | "security_zone_manager"
        | "security_sign_in"
      guard_status: "active" | "suspended" | "pending"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status: "draft" | "submitted" | "reviewed" | "closed"
      invite_status: "unused" | "used" | "expired"
      location_status: "in_zone" | "moving" | "outside_zone" | "offline"
      plan_file_status: "uploaded" | "processing" | "processed" | "failed"
      planned_position_status: "planned" | "filled" | "unfilled" | "inactive"
      roster_upload_status: "uploaded" | "processing" | "processed" | "failed"
      roster_variation_status:
        | "draft"
        | "pending_signoff"
        | "approved"
        | "rejected"
      scope_change_status:
        | "draft"
        | "submitted"
        | "pending_leadership_signoff"
        | "approved"
        | "rejected"
        | "completed"
      shift_extension_status: "requested" | "approved" | "rejected" | "expired"
      shift_status: "scheduled" | "briefing" | "active" | "completed" | "missed"
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
      alert_severity: ["info", "warning", "critical"],
      alert_status: ["open", "acknowledged", "resolved"],
      app_role: [
        "super_admin",
        "operations_manager",
        "site_supervisor",
        "security_guard",
        "event_manager",
        "contractor_manager",
        "security_manager",
        "senior_management",
        "event_control_assistant",
        "security_zone_manager",
        "security_sign_in",
      ],
      guard_status: ["active", "suspended", "pending"],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: ["draft", "submitted", "reviewed", "closed"],
      invite_status: ["unused", "used", "expired"],
      location_status: ["in_zone", "moving", "outside_zone", "offline"],
      plan_file_status: ["uploaded", "processing", "processed", "failed"],
      planned_position_status: ["planned", "filled", "unfilled", "inactive"],
      roster_upload_status: ["uploaded", "processing", "processed", "failed"],
      roster_variation_status: [
        "draft",
        "pending_signoff",
        "approved",
        "rejected",
      ],
      scope_change_status: [
        "draft",
        "submitted",
        "pending_leadership_signoff",
        "approved",
        "rejected",
        "completed",
      ],
      shift_extension_status: ["requested", "approved", "rejected", "expired"],
      shift_status: ["scheduled", "briefing", "active", "completed", "missed"],
    },
  },
} as const
