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
      assessments: {
        Row: {
          ai_draft_output: string | null
          ai_generated_at: string | null
          approved_at: string | null
          assessment_date: string | null
          assessment_type: string | null
          consultant_name: string | null
          created_at: string
          created_by: string | null
          form_data: Json
          id: string
          psychologist_notes: string | null
          psychologist_status: string
          student_id: string
        }
        Insert: {
          ai_draft_output?: string | null
          ai_generated_at?: string | null
          approved_at?: string | null
          assessment_date?: string | null
          assessment_type?: string | null
          consultant_name?: string | null
          created_at?: string
          created_by?: string | null
          form_data?: Json
          id?: string
          psychologist_notes?: string | null
          psychologist_status?: string
          student_id: string
        }
        Update: {
          ai_draft_output?: string | null
          ai_generated_at?: string | null
          approved_at?: string | null
          assessment_date?: string | null
          assessment_type?: string | null
          consultant_name?: string | null
          created_at?: string
          created_by?: string | null
          form_data?: Json
          id?: string
          psychologist_notes?: string | null
          psychologist_status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          attention_level: number | null
          attention_minutes: number | null
          behavioral_incidents: number
          context_trigger: string | null
          created_at: string
          created_by: string | null
          domain: string | null
          emotional_regulation: number | null
          emotional_trigger: string | null
          id: string
          incident_description: string | null
          incident_yes_no: boolean | null
          intervention_effectiveness: number | null
          intervention_used: string | null
          log_date: string
          non_compliance_reason: string | null
          prompt_dependency: string | null
          rating: number | null
          session_time: string | null
          skill_performance: string | null
          skill_practiced: string | null
          strategy_used: string | null
          student_id: string
          teacher_notes: string | null
        }
        Insert: {
          attention_level?: number | null
          attention_minutes?: number | null
          behavioral_incidents?: number
          context_trigger?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          emotional_regulation?: number | null
          emotional_trigger?: string | null
          id?: string
          incident_description?: string | null
          incident_yes_no?: boolean | null
          intervention_effectiveness?: number | null
          intervention_used?: string | null
          log_date?: string
          non_compliance_reason?: string | null
          prompt_dependency?: string | null
          rating?: number | null
          session_time?: string | null
          skill_performance?: string | null
          skill_practiced?: string | null
          strategy_used?: string | null
          student_id: string
          teacher_notes?: string | null
        }
        Update: {
          attention_level?: number | null
          attention_minutes?: number | null
          behavioral_incidents?: number
          context_trigger?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          emotional_regulation?: number | null
          emotional_trigger?: string | null
          id?: string
          incident_description?: string | null
          incident_yes_no?: boolean | null
          intervention_effectiveness?: number | null
          intervention_used?: string | null
          log_date?: string
          non_compliance_reason?: string | null
          prompt_dependency?: string | null
          rating?: number | null
          session_time?: string | null
          skill_performance?: string | null
          skill_practiced?: string | null
          strategy_used?: string | null
          student_id?: string
          teacher_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_progress_scores: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          period_month: string
          priority_domain: string
          score: number
          student_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_month: string
          priority_domain: string
          score: number
          student_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_month?: string
          priority_domain?: string
          score?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_progress_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_plans: {
        Row: {
          approved_by: string | null
          assessment_id: string
          change_count: number
          content: string | null
          created_at: string
          created_by: string | null
          cycle_length_days: number
          generated_at: string
          id: string
          plan_type: string
          plan_version: number
          priority_domain: string | null
          replaced_at: string | null
          selected_strategy: string | null
          start_date: string | null
          status: string | null
          student_id: string
          title: string | null
        }
        Insert: {
          approved_by?: string | null
          assessment_id: string
          change_count?: number
          content?: string | null
          created_at?: string
          created_by?: string | null
          cycle_length_days?: number
          generated_at?: string
          id?: string
          plan_type: string
          plan_version?: number
          priority_domain?: string | null
          replaced_at?: string | null
          selected_strategy?: string | null
          start_date?: string | null
          status?: string | null
          student_id: string
          title?: string | null
        }
        Update: {
          approved_by?: string | null
          assessment_id?: string
          change_count?: number
          content?: string | null
          created_at?: string
          created_by?: string | null
          cycle_length_days?: number
          generated_at?: string
          id?: string
          plan_type?: string
          plan_version?: number
          priority_domain?: string | null
          replaced_at?: string | null
          selected_strategy?: string | null
          start_date?: string | null
          status?: string | null
          student_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_plans_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_communications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          challenge_observation: string | null
          communication_method: string | null
          created_at: string
          created_by: string | null
          home_action: string | null
          id: string
          parent_response: string | null
          positive_highlight: string | null
          progress_report_id: string | null
          response_type: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          student_id: string
          summary_english: string
          summary_urdu: string
          week_end: string
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          challenge_observation?: string | null
          communication_method?: string | null
          created_at?: string
          created_by?: string | null
          home_action?: string | null
          id?: string
          parent_response?: string | null
          positive_highlight?: string | null
          progress_report_id?: string | null
          response_type?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          student_id: string
          summary_english: string
          summary_urdu: string
          week_end: string
          week_start: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          challenge_observation?: string | null
          communication_method?: string | null
          created_at?: string
          created_by?: string | null
          home_action?: string | null
          id?: string
          parent_response?: string | null
          positive_highlight?: string | null
          progress_report_id?: string | null
          response_type?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          student_id?: string
          summary_english?: string
          summary_urdu?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_communications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_progress_report_id_fkey"
            columns: ["progress_report_id"]
            isOneToOne: false
            referencedRelation: "progress_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      progress_reports: {
        Row: {
          ai_analysis_output: string
          avg_rating: number | null
          baseline_comparison: number | null
          confidence_level: string | null
          created_at: string
          created_by: string | null
          dominant_trigger: string | null
          id: string
          incident_rate: number | null
          intervention_plan_id: string | null
          priority_domain: string
          psychologist_status: string | null
          rating_trend: string | null
          recommended_action: string | null
          report_week_end: string
          report_week_start: string
          reviewed_at: string | null
          reviewed_by: string | null
          strategy_compliance: number | null
          student_id: string
          teacher_reported_issue: string | null
        }
        Insert: {
          ai_analysis_output: string
          avg_rating?: number | null
          baseline_comparison?: number | null
          confidence_level?: string | null
          created_at?: string
          created_by?: string | null
          dominant_trigger?: string | null
          id?: string
          incident_rate?: number | null
          intervention_plan_id?: string | null
          priority_domain: string
          psychologist_status?: string | null
          rating_trend?: string | null
          recommended_action?: string | null
          report_week_end: string
          report_week_start: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          strategy_compliance?: number | null
          student_id: string
          teacher_reported_issue?: string | null
        }
        Update: {
          ai_analysis_output?: string
          avg_rating?: number | null
          baseline_comparison?: number | null
          confidence_level?: string | null
          created_at?: string
          created_by?: string | null
          dominant_trigger?: string | null
          id?: string
          incident_rate?: number | null
          intervention_plan_id?: string | null
          priority_domain?: string
          psychologist_status?: string | null
          rating_trend?: string | null
          recommended_action?: string | null
          report_week_end?: string
          report_week_start?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          strategy_compliance?: number | null
          student_id?: string
          teacher_reported_issue?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          assessment_status: string
          class_section: string | null
          comorbid_conditions: string[]
          complexity_flag: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string
          enrollment_date: string | null
          first_name: string
          gender: string | null
          id: string
          intervention_status: string | null
          observation_notes: string | null
          primary_condition: string
          priority_domain: string | null
          priority_domain_start_date: string | null
          school_section: string | null
          severity: string | null
          status: string
          student_code: string
          sub_category: string | null
          under_observation: string[]
        }
        Insert: {
          assessment_status?: string
          class_section?: string | null
          comorbid_conditions?: string[]
          complexity_flag?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth: string
          enrollment_date?: string | null
          first_name: string
          gender?: string | null
          id?: string
          intervention_status?: string | null
          observation_notes?: string | null
          primary_condition: string
          priority_domain?: string | null
          priority_domain_start_date?: string | null
          school_section?: string | null
          severity?: string | null
          status?: string
          student_code?: string
          sub_category?: string | null
          under_observation?: string[]
        }
        Update: {
          assessment_status?: string
          class_section?: string | null
          comorbid_conditions?: string[]
          complexity_flag?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string
          enrollment_date?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          intervention_status?: string | null
          observation_notes?: string | null
          primary_condition?: string
          priority_domain?: string | null
          priority_domain_start_date?: string | null
          school_section?: string | null
          severity?: string | null
          status?: string
          student_code?: string
          sub_category?: string | null
          under_observation?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
