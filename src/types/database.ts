// Tipos que reflejan el esquema de Postgres. Se amplía en cada fase a medida
// que se agregan tablas (ver docs/ARQUITECTURA.md, sección 4).

export type FinancialGoalPriority = 'baja' | 'media' | 'alta' | 'muy_alta'

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  base_currency: string
  birth_date: string | null
  employer: string | null
  employment_start_date: string | null
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  entity_type: string
  entity_id: string
  action: 'create' | 'update' | 'delete'
  previous_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { user_id: string }
        Update: Partial<Profile>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Partial<AuditLog> & {
          user_id: string
          entity_type: string
          entity_id: string
          action: AuditLog['action']
        }
        Update: Partial<AuditLog>
      }
    }
  }
}
