/* ═══════════════════════════════════════════════════════
   STORAGE — Supabase + localStorage Fallback
   Alle Datenbankzugriffe laufen über dieses Modul.
   Solange kein Supabase konfiguriert ist → localStorage.
═══════════════════════════════════════════════════════ */

let supabaseClient = null;
const isOnline = () => !APP_CONFIG.offlineMode && navigator.onLine && supabaseClient;
const getSupabase = () => supabaseClient;

/* Supabase initialisieren */
function initStorage() {
  if (!APP_CONFIG.offlineMode && typeof window.supabase !== 'undefined') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[Storage] Supabase verbunden');
    } catch (e) {
      console.warn('[Storage] Supabase Fehler, nutze localStorage', e);
    }
  } else {
    console.log('[Storage] Offline-Modus: localStorage aktiv');
  }
  updateSyncIndicator();
  window.addEventListener('online',  () => { updateSyncIndicator(); syncPendingData(); });
  window.addEventListener('offline', () => updateSyncIndicator());
}

function updateSyncIndicator() {
  const dot = document.querySelector('.sync-dot');
  const label = document.querySelector('.sync-label');
  if (!dot) return;
  if (APP_CONFIG.offlineMode) {
    dot.className = 'sync-dot offline';
    if (label) label.textContent = 'Lokal (kein Supabase)';
  } else if (navigator.onLine) {
    dot.className = 'sync-dot online';
    if (label) label.textContent = 'Online';
  } else {
    dot.className = 'sync-dot offline';
    if (label) label.textContent = 'Offline';
  }
}

/* ── localStorage Helfer ── */
const LS = {
  get(key) {
    try { return JSON.parse(localStorage.getItem('mmg_' + key) || '[]'); }
    catch { return []; }
  },
  set(key, data) {
    localStorage.setItem('mmg_' + key, JSON.stringify(data));
  },
  getOne(key) {
    try { return JSON.parse(localStorage.getItem('mmg_' + key) || 'null'); }
    catch { return null; }
  },
  setOne(key, data) {
    localStorage.setItem('mmg_' + key, JSON.stringify(data));
  },
};

/* ── CRUD-Wrapper ── */
const DB = {
  /* Alle Datensätze einer Tabelle holen */
  async getAll(table, filter = {}) {
    if (isOnline()) {
      let q = supabaseClient.from(table).select('*');
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
      const { data, error } = await q.order('erstellt_am', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    let data = LS.get(table);
    for (const [k, v] of Object.entries(filter)) data = data.filter(r => r[k] == v);
    return data.sort((a, b) => new Date(b.erstellt_am) - new Date(a.erstellt_am));
  },

  /* Einen Datensatz per ID holen */
  async getById(table, id) {
    if (isOnline()) {
      const { data, error } = await supabaseClient.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
    return LS.get(table).find(r => r.id === id) || null;
  },

  /* Erstellen */
  async insert(table, record) {
    const newRecord = { ...record, id: record.id || generateId(), erstellt_am: record.erstellt_am || new Date().toISOString() };
    if (isOnline()) {
      const { data, error } = await supabaseClient.from(table).insert(newRecord).select().single();
      if (error) throw error;
      updateLocalCache(table, data, 'insert');
      return data;
    }
    const all = LS.get(table);
    all.unshift(newRecord);
    LS.set(table, all);
    addPendingSync(table, 'insert', newRecord);
    return newRecord;
  },

  /* Aktualisieren */
  async update(table, id, updates) {
    if (isOnline()) {
      const { data, error } = await supabaseClient.from(table).update(updates).eq('id', id).select().single();
      if (error) throw error;
      updateLocalCache(table, data, 'update');
      return data;
    }
    const all = LS.get(table);
    const idx = all.findIndex(r => r.id === id);
    if (idx > -1) {
      all[idx] = { ...all[idx], ...updates };
      LS.set(table, all);
      addPendingSync(table, 'update', { id, ...updates });
    }
    return all[idx];
  },

  /* Löschen */
  async delete(table, id) {
    if (isOnline()) {
      const { error } = await supabaseClient.from(table).delete().eq('id', id);
      if (error) throw error;
      updateLocalCache(table, { id }, 'delete');
      return true;
    }
    const all = LS.get(table).filter(r => r.id !== id);
    LS.set(table, all);
    addPendingSync(table, 'delete', { id });
    return true;
  },

  /* Flexible Abfrage mit Spaltenauswahl und LIKE-Filter */
  async query(table, { select = '*', filter = {}, like = {}, orderBy = 'erstellt_am', ascending = false, limit = null } = {}) {
    if (isOnline()) {
      let q = supabaseClient.from(table).select(select);
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
      for (const [k, v] of Object.entries(like)) q = q.like(k, v);
      q = q.order(orderBy, { ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    }
    let data = LS.get(table);
    for (const [k, v] of Object.entries(filter)) data = data.filter(r => r[k] == v);
    for (const [k, v] of Object.entries(like)) {
      const prefix = v.replace(/%/g, '');
      data = data.filter(r => String(r[k] || '').startsWith(prefix));
    }
    data = data.sort((a, b) => ascending
      ? new Date(a[orderBy]) - new Date(b[orderBy])
      : new Date(b[orderBy]) - new Date(a[orderBy])
    );
    return limit ? data.slice(0, limit) : data;
  },

  /* Suche */
  async search(tables, query) {
    const results = [];
    const q = query.toLowerCase();
    for (const { table, label, fields, icon } of tables) {
      const data = await DB.getAll(table);
      for (const row of data) {
        const match = fields.some(f => String(row[f] || '').toLowerCase().includes(q));
        if (match) results.push({ table, label, icon, row, display: fields.map(f => row[f]).filter(Boolean).join(' · ') });
      }
    }
    return results.slice(0, 20);
  },
};

/* Lokalen Cache nach Supabase-Schreiboperationen aktualisieren */
function updateLocalCache(table, record, op) {
  const all = LS.get(table);
  if (op === 'insert') { all.unshift(record); LS.set(table, all); }
  else if (op === 'update') { const i = all.findIndex(r => r.id === record.id); if (i > -1) { all[i] = record; LS.set(table, all); } }
  else if (op === 'delete') { LS.set(table, all.filter(r => r.id !== record.id)); }
}

/* Offline-Sync Queue */
function addPendingSync(table, op, data) {
  const pending = LS.get('pending_sync');
  pending.push({ table, op, data, ts: Date.now() });
  LS.set('pending_sync', pending);
}

async function syncPendingData() {
  if (!isOnline()) return;
  const pending = LS.get('pending_sync');
  if (!pending.length) return;
  const failed = [];
  for (const item of pending) {
    try {
      if (item.op === 'insert') await supabaseClient.from(item.table).upsert(item.data);
      else if (item.op === 'update') await supabaseClient.from(item.table).update(item.data).eq('id', item.data.id);
      else if (item.op === 'delete') await supabaseClient.from(item.table).delete().eq('id', item.data.id);
    } catch { failed.push(item); }
  }
  LS.set('pending_sync', failed);
  if (!failed.length) showToast('Daten erfolgreich synchronisiert', 'success');
}

/* Einstellungen — lokal + Supabase-Sync */
const Settings = {
  get() { return LS.getOne('einstellungen') || {}; },
  set(data) {
    const merged = { ...Settings.get(), ...data };
    LS.setOne('einstellungen', merged);
    /* In Supabase persistieren */
    if (isOnline()) {
      supabaseClient.from('einstellungen').upsert({ id: 'global', ...merged }).then(() => {});
    }
  },
  async load() {
    if (!isOnline()) return;
    try {
      const { data } = await supabaseClient.from('einstellungen').select('*').eq('id', 'global').single();
      if (data) { const { id, ...rest } = data; LS.setOne('einstellungen', rest); }
    } catch {}
  },
};

/* Hilfsfunktionen */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function formatCurrency(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function getStatusBadge(status) {
  const map = {
    'offen':        ['badge-offen',      'Offen'],
    'angebot':      ['badge-angebot',    'Angebot'],
    'auftrag':      ['badge-auftrag',    'Auftrag'],
    'fertigung':    ['badge-fertigung',  'Fertigung'],
    'montage':      ['badge-montage',    'Montage'],
    'rechnung':     ['badge-rechnung',   'Rechnung'],
    'fertig':       ['badge-fertig',     'Fertig'],
    'abgeschlossen':['badge-fertig',     'Abgeschlossen'],
    'bezahlt':      ['badge-bezahlt',    'Bezahlt'],
    'ueberfaellig': ['badge-ueberfaellig','Überfällig'],
    'abgelehnt':    ['badge-abgelehnt',  'Abgelehnt'],
    'gesendet':     ['badge-gesendet',   'Gesendet'],
    'entwurf':      ['badge-entwurf',    'Entwurf'],
    'angenommen':   ['badge-angenommen', 'Angenommen'],
    'genehmigt':    ['badge-genehmigt',  'Genehmigt'],
    'abwartend':    ['badge-abwartend',  'Ausstehend'],
    'neu':          ['badge-blue',       'Neu'],
    'in_bearbeitung':['badge-orange',    'In Bearbeitung'],
    'erledigt':     ['badge-green',      'Erledigt'],
    'hoch':         ['badge-red',        'Hoch'],
    'normal':       ['badge-orange',     'Normal'],
    'niedrig':      ['badge-blue',       'Niedrig'],
  };
  const [cls, label] = map[status?.toLowerCase()] || ['badge-gray', status || '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}
