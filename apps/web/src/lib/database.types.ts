// Types générés depuis le schéma Supabase
// Regénérer avec : npx supabase gen types typescript --local > src/lib/database.types.ts

import type {
  Profile,
  Beneficiary,
  SessionSchedule,
  Call,
  ConversationMemory,
} from '@modect/shared'

export type { Profile, Beneficiary, SessionSchedule, Call, ConversationMemory }

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      beneficiaries: {
        Row: Beneficiary
        Insert: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Beneficiary, 'id' | 'caregiver_id' | 'created_at'>>
      }
      session_schedules: {
        Row: SessionSchedule
        Insert: Omit<SessionSchedule, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SessionSchedule, 'id' | 'created_at'>>
      }
      calls: {
        Row: Call
        Insert: Omit<Call, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Call, 'id' | 'created_at'>>
      }
      conversation_memory: {
        Row: ConversationMemory
        Insert: Omit<ConversationMemory, 'id' | 'created_at'>
        Update: Partial<Omit<ConversationMemory, 'id' | 'beneficiary_id' | 'created_at'>>
      }
    }
  }
}
