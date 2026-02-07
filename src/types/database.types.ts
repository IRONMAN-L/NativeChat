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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      channel_users: {
        Row: {
          channel_id: string
          joined_at: string
          role: Database["public"]["Enums"]["user-type"] | null
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["user-type"] | null
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["user-type"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_users_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          id: string
          name: string | null
          type: Database["public"]["Enums"]["channel-type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          type?: Database["public"]["Enums"]["channel-type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          type?: Database["public"]["Enums"]["channel-type"]
        }
        Relationships: []
      }
      message_recipients: {
        Row: {
          ciphertext: string | null
          id: number
          message_id: string | null
          recipient_device_id: number | null
          recipient_user_id: string
          status: Database["public"]["Enums"]["message-status"]
        }
        Insert: {
          ciphertext?: string | null
          id?: number
          message_id?: string | null
          recipient_device_id?: number | null
          recipient_user_id: string
          status?: Database["public"]["Enums"]["message-status"]
        }
        Update: {
          ciphertext?: string | null
          id?: number
          message_id?: string | null
          recipient_device_id?: number | null
          recipient_user_id?: string
          status?: Database["public"]["Enums"]["message-status"]
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_recipient_user_id_recipient_device_id_fkey"
            columns: ["recipient_user_id", "recipient_device_id"]
            isOneToOne: false
            referencedRelation: "signal_devices"
            referencedColumns: ["user_id", "device_id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_id: string | null
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_devices: {
        Row: {
          created_at: string
          device_id: number
          identity_key: string
          registration_id: number
          signed_prekey: string
          signed_prekey_id: number
          signed_prekey_signature: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: number
          identity_key: string
          registration_id: number
          signed_prekey: string
          signed_prekey_id: number
          signed_prekey_signature: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: number
          identity_key?: string
          registration_id?: number
          signed_prekey?: string
          signed_prekey_id?: number
          signed_prekey_signature?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_prekeys: {
        Row: {
          created_at: string
          device_id: number
          prekey: string
          prekey_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: number
          prekey: string
          prekey_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: number
          prekey?: string
          prekey_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_prekeys_user_id_device_id_fkey"
            columns: ["user_id", "device_id"]
            isOneToOne: false
            referencedRelation: "signal_devices"
            referencedColumns: ["user_id", "device_id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email_address: string | null
          expo_push_token: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email_address?: string | null
          expo_push_token?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          updated_at: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email_address?: string | null
          expo_push_token?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_prekey: {
        Args: { target_device_id: number; target_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      "channel-type": "direct" | "group"
      "message-status": "sent" | "delivered" | "read" | "failed"
      "user-type": "admin" | "member"
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
    Enums: {
      "channel-type": ["direct", "group"],
      "message-status": ["sent", "delivered", "read", "failed"],
      "user-type": ["admin", "member"],
    },
  },
} as const
