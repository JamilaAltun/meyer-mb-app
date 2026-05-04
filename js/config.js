/* ═══════════════════════════════════════════════════════
   SUPABASE KONFIGURATION
   Trage hier deine Supabase-Zugangsdaten ein sobald du
   den Account erstellt hast (supabase.com → Settings → API)
═══════════════════════════════════════════════════════ */

const SUPABASE_URL = 'DEINE_SUPABASE_URL';       // z.B. https://abcdefgh.supabase.co
const SUPABASE_ANON_KEY = 'DEIN_SUPABASE_ANON_KEY'; // langer Key aus Settings → API

/* App-Konfiguration */
const APP_CONFIG = {
  name: 'Meyer Metallbau GmbH',
  version: '1.0.0',
  offlineMode: SUPABASE_URL === 'DEINE_SUPABASE_URL', // true = nur localStorage
};
