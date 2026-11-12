import type { Session } from '@supabase/supabase-js'
import type { ProfileRow } from './types'

export const app = $state({
  session: null as Session | null,
  profileId: null as string | null,
  profile: null as ProfileRow | null,
  sync: 'idle' as 'idle' | 'syncing' | 'error' | 'offline',
  syncError: '',
  lastSync: null as string | null,
  ready: false
})
