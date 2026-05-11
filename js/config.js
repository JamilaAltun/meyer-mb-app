/* ═══════════════════════════════════════════════════════
   SUPABASE KONFIGURATION
   Trage hier deine Supabase-Zugangsdaten ein sobald du
   den Account erstellt hast (supabase.com → Settings → API)
═══════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://jcsumygwbwncfzvjpalq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjc3VteWd3YnduY2Z6dmpwYWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDQ2NjAsImV4cCI6MjA5MzcyMDY2MH0.xl_n6wQ66em8rMUyVdx8-SjXItEuQCKGuTOpNA0rYWk';

/* App-Konfiguration */
const APP_CONFIG = {
  name: 'Meyer Metallbau GmbH',
  version: '1.0.0',
  offlineMode: SUPABASE_URL === 'DEINE_SUPABASE_URL', // true = nur localStorage
};
