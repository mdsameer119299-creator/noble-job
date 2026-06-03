/**
 * Supabase Database types for Noble Job.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: string
          status: string
          email_verified: boolean
          phone: string | null
          phone_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: string
          status?: string
          email_verified?: boolean
          phone?: string | null
          phone_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: string
          status?: string
          email_verified?: boolean
          phone?: string | null
          phone_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          id: string
          employer_id: string | null
          title: string
          company: string | null
          description: string | null
          location: string
          salary_min: number | null
          salary_max: number | null
          currency: string
          job_type: string
          category: string | null
          skills: string[]
          experience_required: string | null
          status: string
          job_status: string | null
          board: string
          source: string | null
          apply_url: string | null
          is_verified: boolean
          badge: string | null
          posted_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          employer_id?: string | null
          title: string
          company?: string | null
          description?: string | null
          location: string
          salary_min?: number | null
          salary_max?: number | null
          currency?: string
          job_type?: string
          category?: string | null
          skills?: string[]
          experience_required?: string | null
          status?: string
          job_status?: string | null
          board?: string
          source?: string | null
          apply_url?: string | null
          is_verified?: boolean
          badge?: string | null
          posted_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          employer_id?: string | null
          title?: string
          company?: string | null
          description?: string | null
          location?: string
          salary_min?: number | null
          salary_max?: number | null
          currency?: string
          job_type?: string
          category?: string | null
          skills?: string[]
          experience_required?: string | null
          status?: string
          job_status?: string | null
          board?: string
          source?: string | null
          apply_url?: string | null
          is_verified?: boolean
          badge?: string | null
          posted_at?: string
          expires_at?: string | null
        }
        Relationships: []
      }
      employers: {
        Row: { id: string; user_id: string; company_name: string; verified: boolean; status: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; company_name: string; verified?: boolean; status?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; company_name?: string; verified?: boolean; status?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      candidates: {
        Row: {
          id: string
          user_id: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          city: string | null
          state: string | null
          experience_years: string | null
          category: string | null
          expected_salary: number | null
          skills: string[]
          resume_url: string | null
          profile_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          city?: string | null
          state?: string | null
          experience_years?: string | null
          category?: string | null
          expected_salary?: number | null
          skills?: string[]
          resume_url?: string | null
          profile_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          city?: string | null
          state?: string | null
          experience_years?: string | null
          category?: string | null
          expected_salary?: number | null
          skills?: string[]
          resume_url?: string | null
          profile_score?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidate_experience: {
        Row: { id: string; candidate_id: string }
        Insert: { id?: string; candidate_id: string }
        Update: { id?: string; candidate_id?: string }
        Relationships: []
      }
      candidate_education: {
        Row: { id: string; candidate_id: string }
        Insert: { id?: string; candidate_id: string }
        Update: { id?: string; candidate_id?: string }
        Relationships: []
      }
      govt_jobs: {
        Row: {
          id: string
          title: string
          org: string
          short: string
          post: string
          vacancies: string
          qualification: string
          age_range: string
          fee: string
          last_date: string
          salary: string
          location: string
          state: string | null
          tab: string
          status: string
          sort_order: number
          slug: string | null
          color: string
          badge: string | null
        }
        Insert: { id: string; title: string; status?: string; tab?: string }
        Update: { id?: string; title?: string; status?: string; tab?: string }
        Relationships: []
      }
      wfh_jobs: {
        Row: {
          id: string
          title: string
          company: string
          logo: string
          color: string
          type: string
          experience: string
          salary: string
          cat: string
          qualification: string
          skills: string[]
          badge: string
          badge_type: string
          applicants: number
          description: string
          apply_url: string
          status: string
          posted_at: string
        }
        Insert: { id: string; title: string; company: string; status?: string }
        Update: { id?: string; title?: string; status?: string }
        Relationships: []
      }
      abroad_jobs: {
        Row: {
          id: string
          title: string
          company: string
          logo: string
          country: string
          location: string
          type: string
          salary: string
          experience: string
          category: string
          description: string
          apply_url: string
          skills: string[]
          status: string
          posted_at: string
        }
        Insert: { id: string; title: string; company: string; country: string; status?: string }
        Update: { id?: string; title?: string; country?: string; status?: string }
        Relationships: []
      }
      applications: {
        Row: { id: string; job_id: string; candidate_id: string; employer_id: string | null; status: string; applied_at: string; notes: string | null; board: string }
        Insert: { id?: string; job_id: string; candidate_id: string; employer_id?: string | null; status?: string; applied_at?: string; notes?: string | null; board?: string }
        Update: { id?: string; job_id?: string; candidate_id?: string; employer_id?: string | null; status?: string; applied_at?: string; notes?: string | null; board?: string }
        Relationships: []
      }
      contact_messages: {
        Row: { id: string; first_name: string; last_name: string; email: string; phone: string | null; subject: string; message: string; inquiry_type: string; user_type: string; routed_to_email: string; status: string; created_at: string }
        Insert: { id?: string; first_name: string; last_name: string; email: string; phone?: string | null; subject: string; message: string; inquiry_type?: string; user_type?: string; routed_to_email?: string; status?: string; created_at?: string }
        Update: { id?: string; first_name?: string; last_name?: string; email?: string; phone?: string | null; subject?: string; message?: string; inquiry_type?: string; user_type?: string; routed_to_email?: string; status?: string; created_at?: string }
        Relationships: []
      }
      job_alerts: {
        Row: { id: string; email: string; user_id: string | null; keywords: string | null; location: string | null; category: string | null; job_type: string | null; board: string; frequency: string; is_active: boolean; created_at: string }
        Insert: { id?: string; email: string; user_id?: string | null; keywords?: string | null; location?: string | null; category?: string | null; job_type?: string | null; board?: string; frequency?: string; is_active?: boolean; created_at?: string }
        Update: { id?: string; email?: string; user_id?: string | null; keywords?: string | null; location?: string | null; category?: string | null; job_type?: string | null; board?: string; frequency?: string; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      bookmarks: {
        Row: { id: string; user_id: string; job_id: string; board: string }
        Insert: { id?: string; user_id: string; job_id: string; board?: string }
        Update: { id?: string; user_id?: string; job_id?: string; board?: string }
        Relationships: []
      }
      saved_jobs: {
        Row: { id: string; candidate_id: string; job_id: string; board: string }
        Insert: { id?: string; candidate_id: string; job_id: string; board?: string }
        Update: { id?: string; candidate_id?: string; job_id?: string; board?: string }
        Relationships: []
      }
      ratings: {
        Row: { id: string; score: number; page: string; user_id: string | null }
        Insert: { id?: string; score: number; page?: string; user_id?: string | null }
        Update: { id?: string; score?: number; page?: string; user_id?: string | null }
        Relationships: []
      }
      otp_tokens: {
        Row: { id: string; email: string; otp_hash: string; type: string; is_used: boolean; expires_at: string }
        Insert: { id?: string; email: string; otp_hash: string; type: string; is_used?: boolean; expires_at: string }
        Update: { id?: string; email?: string; otp_hash?: string; type?: string; is_used?: boolean; expires_at?: string }
        Relationships: []
      }
      interviews: {
        Row: { id: string; status: string; employer_id: string }
        Insert: { id?: string; status?: string; employer_id: string }
        Update: { id?: string; status?: string; employer_id?: string }
        Relationships: []
      }
      skill_tests: {
        Row: { id: string; title: string; category: string }
        Insert: { id?: string; title: string; category: string }
        Update: { id?: string; title?: string; category?: string }
        Relationships: []
      }
      candidate_test_results: {
        Row: { id: string; candidate_id: string; test_id: string; score: number; passed: boolean; taken_at: string }
        Insert: { id?: string; candidate_id: string; test_id: string; score: number; passed?: boolean; taken_at?: string }
        Update: { id?: string; candidate_id?: string; test_id?: string; score?: number; passed?: boolean; taken_at?: string }
        Relationships: []
      }
      messages: {
        Row: { id: string; sender_id: string; recipient_id: string; content: string; is_read: boolean; application_id: string | null }
        Insert: { id?: string; sender_id: string; recipient_id: string; content: string; is_read?: boolean; application_id?: string | null }
        Update: { id?: string; sender_id?: string; recipient_id?: string; content?: string; is_read?: boolean; application_id?: string | null }
        Relationships: []
      }
      notifications: {
        Row: { id: string; user_id: string; type: string; title: string; message: string; is_read: boolean }
        Insert: { id?: string; user_id: string; type: string; title: string; message: string; is_read?: boolean }
        Update: { id?: string; user_id?: string; type?: string; title?: string; message?: string; is_read?: boolean }
        Relationships: []
      }
      site_content: {
        Row: { key: string; value: string }
        Insert: { key: string; value: string }
        Update: { key?: string; value?: string }
        Relationships: []
      }
      admin_settings: {
        Row: { key: string; value: string }
        Insert: { key: string; value: string }
        Update: { key?: string; value?: string }
        Relationships: []
      }
      employer_plans: {
        Row: { id: string; employer_id: string }
        Insert: { id?: string; employer_id: string }
        Update: { id?: string; employer_id?: string }
        Relationships: []
      }
      employer_settings: {
        Row: { id: string; employer_id: string; notify_applications: boolean; notify_interviews: boolean; notify_messages: boolean }
        Insert: { id?: string; employer_id: string; notify_applications?: boolean; notify_interviews?: boolean; notify_messages?: boolean }
        Update: { id?: string; employer_id?: string; notify_applications?: boolean; notify_interviews?: boolean; notify_messages?: boolean }
        Relationships: []
      }
      himalayas_jobs_cache: {
        Row: {
          id: string
          external_id: string
          title: string
          company: string
          logo_url: string | null
          location: string | null
          salary_text: string | null
          category: string | null
          seniority: string | null
          apply_url: string | null
          source_data_json: Json
          fetched_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          external_id: string
          title: string
          company: string
          logo_url?: string | null
          location?: string | null
          salary_text?: string | null
          category?: string | null
          seniority?: string | null
          apply_url?: string | null
          source_data_json?: Json
          fetched_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          external_id?: string
          title?: string
          company?: string
          logo_url?: string | null
          location?: string | null
          salary_text?: string | null
          category?: string | null
          seniority?: string | null
          apply_url?: string | null
          source_data_json?: Json
          fetched_at?: string
          expires_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
