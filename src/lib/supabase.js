// NeoTopia Supabase client
// Project: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
// Single shared client for the whole app. DB is the authoritative source of truth;
// the Zustand store (src/store/gameStore.js) is only a local mirror.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('NeoTopia: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required in .env.local')
}

export const supabase = createClient(url, key, {
  realtime: {
    // Caps realtime message rate · keeps optimistic-update echoes from flooding clients.
    params: { eventsPerSecond: 10 },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export default supabase
