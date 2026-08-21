export type HouseholdRole = "owner" | "member"

export type InvitePreviewStatus = "valid" | "expired" | "revoked" | "unknown"

export type StorageLocation = "fridge" | "freezer" | "pantry"

export type ExpiryType = "best_before" | "use_by" | "unknown"

export type InventorySource = "manual" | "barcode" | "ai" | "batch"

export type ProductSource = "open_food_facts" | "user_confirmed"

export type CaptureMode = "photo" | "batch"

export type CaptureSessionStatus =
  | "draft"
  | "processing"
  | "review"
  | "committed"
  | "cancelled"
  | "expired"

export type CaptureItemStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "review"
  | "failed"
  | "confirmed"

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          created_at?: string
        }
        Update: {
          display_name?: string
        }
        Relationships: []
      }
      households: {
        Row: {
          id: string
          name: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          created_at?: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          household_id: string
          user_id: string
          role: HouseholdRole
          joined_at: string
        }
        Insert: {
          household_id: string
          user_id: string
          role: HouseholdRole
          joined_at?: string
        }
        Update: {
          role?: HouseholdRole
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          id: string
          household_id: string
          token_hash: string
          created_by: string
          expires_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          household_id: string
          token_hash: string
          created_by: string
          expires_at: string
          revoked_at?: string | null
        }
        Update: {
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          id: string
          household_id: string
          display_name: string
          quantity: number
          expiry_date: string
          expiry_type: ExpiryType
          storage_location: StorageLocation
          source: InventorySource
          product_id: string | null
          source_capture_item_id: string | null
          added_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          household_id: string
          display_name: string
          quantity?: number
          expiry_date: string
          expiry_type?: ExpiryType
          storage_location: StorageLocation
          source?: InventorySource
          product_id?: string | null
          source_capture_item_id?: string | null
        }
        Update: {
          display_name?: string
          quantity?: number
          expiry_date?: string
          expiry_type?: ExpiryType
          storage_location?: StorageLocation
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_source_capture_item_id_fkey"
            columns: ["source_capture_item_id"]
            isOneToOne: true
            referencedRelation: "capture_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          id: string
          gtin: string
          display_name: string
          brand: string | null
          variant: string | null
          package_size: string | null
          image_url: string | null
          locale: string | null
          source: ProductSource
          last_refreshed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gtin: string
          display_name: string
          brand?: string | null
          variant?: string | null
          package_size?: string | null
          image_url?: string | null
          locale?: string | null
          source: ProductSource
          last_refreshed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          brand?: string | null
          variant?: string | null
          package_size?: string | null
          image_url?: string | null
          locale?: string | null
          source?: ProductSource
          last_refreshed_at?: string
        }
        Relationships: []
      }
      capture_sessions: {
        Row: {
          id: string
          household_id: string
          created_by: string
          mode: CaptureMode
          status: CaptureSessionStatus
          created_at: string
          updated_at: string
          expires_at: string
          committed_at: string | null
        }
        Insert: {
          id?: string
          household_id: string
          mode: CaptureMode
        }
        Update: {
          status?: CaptureSessionStatus
        }
        Relationships: [
          {
            foreignKeyName: "capture_sessions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_items: {
        Row: {
          id: string
          session_id: string
          position: number
          product_image_path: string | null
          expiry_image_path: string | null
          status: CaptureItemStatus
          proposal: unknown | null
          confirmed_data: unknown | null
          error_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          position: number
          product_image_path?: string | null
          expiry_image_path?: string | null
        }
        Update: {
          product_image_path?: string | null
          expiry_image_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capture_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
          updated_at: string
          last_success_at: string | null
        }
        Insert: {
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
        }
        Update: {
          p256dh?: string
          auth?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          id: string
          inventory_item_id: string
          user_id: string
          push_subscription_id: string
          reminder_offset: 0 | 1 | 3
          expiry_date: string
          delivered_at: string
        }
        Insert: {
          inventory_item_id: string
          user_id: string
          push_subscription_id: string
          reminder_offset: 0 | 1 | 3
          expiry_date: string
        }
        Update: {
          [_ in never]: never
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_push_subscription_id_fkey"
            columns: ["push_subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_household: {
        Args: { p_name: string }
        Returns: string
      }
      rename_household: {
        Args: { p_household_id: string; p_name: string }
        Returns: undefined
      }
      create_invite: {
        Args: { p_household_id: string }
        Returns: string
      }
      revoke_invite: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      get_invite_preview: {
        Args: { p_token: string }
        Returns: {
          household_name: string | null
          expires_at: string | null
          status: InvitePreviewStatus
        }[]
      }
      accept_invite: {
        Args: { p_token: string }
        Returns: string
      }
      leave_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      remove_member: {
        Args: { p_household_id: string; p_user_id: string }
        Returns: undefined
      }
      commit_capture_session: {
        Args: { p_session_id: string; p_confirmed_items: unknown }
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
