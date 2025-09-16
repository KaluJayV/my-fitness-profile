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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      conversation_sessions: {
        Row: {
          analytics_cache: Json | null
          conversation_data: Json | null
          created_at: string
          id: string
          insights: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analytics_cache?: Json | null
          conversation_data?: Json | null
          created_at?: string
          id?: string
          insights?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analytics_cache?: Json | null
          conversation_data?: Json | null
          created_at?: string
          id?: string
          insights?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercise_categories: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category_id: number | null
          gif_url: string | null
          id: number
          name: string
          primary_muscles: string[] | null
          vector_768: string | null
        }
        Insert: {
          category_id?: number | null
          gif_url?: string | null
          id?: number
          name: string
          primary_muscles?: string[] | null
          vector_768?: string | null
        }
        Update: {
          category_id?: number | null
          gif_url?: string | null
          id?: number
          name?: string
          primary_muscles?: string[] | null
          vector_768?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "exercise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string | null
          days_per_week: number | null
          generator_source: string | null
          id: string
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          days_per_week?: number | null
          generator_source?: string | null
          id?: string
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          days_per_week?: number | null
          generator_source?: string | null
          id?: string
          name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          exercise_id: number
          manual_1rm: number | null
          manual_1rm_updated_at: string | null
          notes: string | null
          pump_score: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          exercise_id: number
          manual_1rm?: number | null
          manual_1rm_updated_at?: string | null
          notes?: string | null
          pump_score?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          exercise_id?: number
          manual_1rm?: number | null
          manual_1rm_updated_at?: string | null
          notes?: string | null
          pump_score?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v_core_lifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          id: string
          performed_at: string | null
          reps: number | null
          rir: number | null
          weight: number | null
          workout_exercise_id: string | null
        }
        Insert: {
          id?: string
          performed_at?: string | null
          reps?: number | null
          rir?: number | null
          weight?: number | null
          workout_exercise_id?: string | null
        }
        Update: {
          id?: string
          performed_at?: string | null
          reps?: number | null
          rir?: number | null
          weight?: number | null
          workout_exercise_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          equipment: string[] | null
          experience: string | null
          goal: string | null
          id: string
          injuries: string[] | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          equipment?: string[] | null
          experience?: string | null
          goal?: string | null
          id?: string
          injuries?: string[] | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          equipment?: string[] | null
          experience?: string | null
          goal?: string | null
          id?: string
          injuries?: string[] | null
          username?: string | null
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          exercise_id: number | null
          id: string
          position: number | null
          workout_id: string | null
        }
        Insert: {
          exercise_id?: number | null
          id?: string
          position?: number | null
          workout_id?: string | null
        }
        Update: {
          exercise_id?: number | null
          id?: string
          position?: number | null
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v_core_lifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          completed: boolean | null
          id: string
          json_plan: Json | null
          program_id: string | null
          workout_date: string | null
        }
        Insert: {
          completed?: boolean | null
          id?: string
          json_plan?: Json | null
          program_id?: string | null
          workout_date?: string | null
        }
        Update: {
          completed?: boolean | null
          id?: string
          json_plan?: Json | null
          program_id?: string | null
          workout_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_core_lifts: {
        Row: {
          core_lift_type: string | null
          id: number | null
          name: string | null
        }
        Insert: {
          core_lift_type?: never
          id?: number | null
          name?: string | null
        }
        Update: {
          core_lift_type?: never
          id?: number | null
          name?: string | null
        }
        Relationships: []
      }
      v_progress: {
        Row: {
          estimated_1rm: number | null
          exercise_id: number | null
          exercise_name: string | null
          id: string | null
          performed_at: string | null
          reps: number | null
          rir: number | null
          user_id: string | null
          volume: number | null
          weight: number | null
          workout_date: string | null
          workout_exercise_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v_core_lifts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      analyze_progress: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      get_core_lift_progression: {
        Args: { p_user_id?: string }
        Returns: {
          avg_weight: number
          best_estimated_1rm: number
          core_lift_type: string
          exercise_name: string
          total_sets: number
          total_volume: number
          workout_date: string
        }[]
      }
      get_current_core_lift_maxes: {
        Args: { p_user_id?: string }
        Returns: {
          core_lift_type: string
          current_1rm: number
          exercise_name: string
          improvement_30d: number
          last_performed: string
        }[]
      }
      get_exercise_1rm_data: {
        Args: { p_exercise_id: number; p_user_id: string }
        Returns: {
          estimated_1rm: number
          performed_at: string
          reps: number
          rir: number
          weight: number
        }[]
      }
      get_exercise_history: {
        Args: { p_exercise_id: number; p_limit?: number; p_user_id: string }
        Returns: {
          max_weight: number
          performed_at: string
          reps: number
          rir: number
          weight: number
        }[]
      }
      get_exercise_stats: {
        Args: { p_exercise_id: number; p_user_id: string }
        Returns: {
          avg_reps: number
          avg_weight: number
          best_1rm: number
          calculated_1rm: number
          exercise_id: number
          exercise_name: string
          last_performed: string
          manual_1rm: number
          manual_1rm_updated_at: string
          notes: string
          pump_score: number
          total_sets: number
        }[]
      }
      get_user_history: {
        Args: { p_user: string }
        Returns: {
          avg_reps: number
          avg_weight: number
          exercise_name: string
          last_performed: string
          total_sets: number
        }[]
      }
      get_user_progress: {
        Args: { p_user_id?: string }
        Returns: {
          avg_reps: number
          avg_weight: number
          exercise: string
          user_id: string
          week: string
        }[]
      }
      get_workout_frequency_stats: {
        Args: { p_user_id?: string }
        Returns: {
          avg_workouts_per_week: number
          current_streak: number
          last_workout_date: string
          longest_streak: number
          total_workouts: number
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
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
