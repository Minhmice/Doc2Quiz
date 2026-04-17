// Hand-written DB types (not generated).
// Keep in sync with `supabase/migrations/*_doc2quiz_cloud_schema.sql`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Uuid = string;
type Timestamptz = string;

export type Database = {
  public: {
    Enums: {
      media_asset_kind: "page_image" | "attachment";
    };
    Tables: {
      study_sets: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          title: string;
          description: string | null;
          slug: string | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          title: string;
          description?: string | null;
          slug?: string | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          user_id?: Uuid;
          title?: string;
          description?: string | null;
          slug?: string | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      study_set_documents: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          source_file_name: string | null;
          page_count: number | null;
          extracted_text: string;
          extracted_at: Timestamptz;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          source_file_name?: string | null;
          page_count?: number | null;
          extracted_text: string;
          extracted_at?: Timestamptz;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          user_id?: Uuid;
          study_set_id?: Uuid;
          source_file_name?: string | null;
          page_count?: number | null;
          extracted_text?: string;
          extracted_at?: Timestamptz;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      approved_questions: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          prompt: string;
          choices: string[];
          correct_index: number;
          explanation: string | null;
          tags: string[];
          source: Json;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          prompt: string;
          choices: string[];
          correct_index: number;
          explanation?: string | null;
          tags?: string[];
          source?: Json;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          user_id?: Uuid;
          study_set_id?: Uuid;
          prompt?: string;
          choices?: string[];
          correct_index?: number;
          explanation?: string | null;
          tags?: string[];
          source?: Json;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      approved_flashcards: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          front: string;
          back: string;
          tags: string[];
          source: Json;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          front: string;
          back: string;
          tags?: string[];
          source?: Json;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          user_id?: Uuid;
          study_set_id?: Uuid;
          front?: string;
          back?: string;
          tags?: string[];
          source?: Json;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          document_id: Uuid | null;
          kind: Database["public"]["Enums"]["media_asset_kind"];
          bucket: string;
          object_path: string;
          original_file_name: string | null;
          mime_type: string | null;
          byte_size: number | null;
          sha256: string | null;
          page_number: number | null;
          width: number | null;
          height: number | null;
          metadata: Json;
          created_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          document_id?: Uuid | null;
          kind: Database["public"]["Enums"]["media_asset_kind"];
          bucket: string;
          object_path: string;
          original_file_name?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          sha256?: string | null;
          page_number?: number | null;
          width?: number | null;
          height?: number | null;
          metadata?: Json;
          created_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          user_id?: Uuid;
          study_set_id?: Uuid;
          document_id?: Uuid | null;
          kind?: Database["public"]["Enums"]["media_asset_kind"];
          bucket?: string;
          object_path?: string;
          original_file_name?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          sha256?: string | null;
          page_number?: number | null;
          width?: number | null;
          height?: number | null;
          metadata?: Json;
          created_at?: Timestamptz;
        };
        Relationships: [];
      };
      ocr_results: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          asset_id: Uuid;
          engine: string | null;
          result: Json;
          created_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          asset_id: Uuid;
          engine?: string | null;
          result: Json;
          created_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          user_id?: Uuid;
          asset_id?: Uuid;
          engine?: string | null;
          result?: Json;
          created_at?: Timestamptz;
        };
        Relationships: [];
      };
      quiz_sessions: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          mode: string;
          settings: Json;
          started_at: Timestamptz;
          ended_at: Timestamptz | null;
          created_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          study_set_id: Uuid;
          mode?: string;
          settings?: Json;
          started_at?: Timestamptz;
          ended_at?: Timestamptz | null;
          created_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          user_id?: Uuid;
          study_set_id?: Uuid;
          mode?: string;
          settings?: Json;
          started_at?: Timestamptz;
          ended_at?: Timestamptz | null;
          created_at?: Timestamptz;
        };
        Relationships: [];
      };
      quiz_session_items: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          session_id: Uuid;
          question_id: Uuid;
          ordinal: number;
          chosen_index: number | null;
          correct: boolean | null;
          answered_at: Timestamptz | null;
          created_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          session_id: Uuid;
          question_id: Uuid;
          ordinal: number;
          chosen_index?: number | null;
          correct?: boolean | null;
          answered_at?: Timestamptz | null;
          created_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          user_id?: Uuid;
          session_id?: Uuid;
          question_id?: Uuid;
          ordinal?: number;
          chosen_index?: number | null;
          correct?: boolean | null;
          answered_at?: Timestamptz | null;
          created_at?: Timestamptz;
        };
        Relationships: [];
      };
      wrong_history: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          question_id: Uuid;
          session_id: Uuid | null;
          session_item_id: Uuid | null;
          chosen_index: number | null;
          correct_index: number | null;
          occurred_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          question_id: Uuid;
          session_id?: Uuid | null;
          session_item_id?: Uuid | null;
          chosen_index?: number | null;
          correct_index?: number | null;
          occurred_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          user_id?: Uuid;
          question_id?: Uuid;
          session_id?: Uuid | null;
          session_item_id?: Uuid | null;
          chosen_index?: number | null;
          correct_index?: number | null;
          occurred_at?: Timestamptz;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableRow<
  TName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TName]["Row"];

export type TableInsert<
  TName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TName]["Insert"];

export type TableUpdate<
  TName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TName]["Update"];

