/* ═══════════════════════════════════════════════════════
   BACKUP — Automatische Datensicherung
   Speichert in der bestehenden einstellungen-Tabelle.
   Kein neues Schema nötig — funktioniert sofort.
   Jede Minute · Max 100 · Geräteübergreifend
═══════════════════════════════════════════════════════ */

const BackupModule = {
  MAX: 100,
  INTERVAL: 60000,
  INDEX_ID: 'bk_index',
  PREFIX: 'bk_',
  TABLES: [
    'users','kunden','auftraege','angebote','rechnungen',
    'aufgaben','chat_nachrichten','urlaub','tickets','zeiterfassung','kalender_events'
  ],

  /* ── Backup-Index (Metadaten-Liste) lesen ── */
  async _getIndex() {
    try {
      if (isOnline()) {
        const { data } = await getSupabase()
          .from('einstellungen')
          .select('logo_url')
          .eq('id', this.INDEX_ID)
          .maybeSingle();
        if (data?.logo_url) return JSON.parse(data.logo_url);
      }
    } catch {}
    try { return JSON.parse(localStorage.getItem('mmg_bk_index') || '[]'); }
    catch { return []; }
  },

  /* ── Backup-Index speichern ── */
  async _setIndex(list) {
    const json = JSON.stringify(list);
    try {
      if (isOnline()) {
        await getSupabase().from('einstellungen').upsert({ id: this.INDEX_ID, logo_url: json });
      }
    } catch {}
    localStorage.setItem('mmg_bk_index', json);
  },

  /* ── Backup erstellen ── */
  async create(label) {
    const data = {};
    for (const t of this.TABLES) {
      try { data[t] = await DB.getAll(t); } catch { data[t] = LS.get(t) || []; }
    }
    /* Einstellungen ohne Logo (das wäre zu groß) */
    const s = { ...Settings.get() };
    delete s.logo_url;
    data['_einstellungen'] = s;

    const id = this.PREFIX + generateId();
    const ts = new Date().toISOString();
    const lbl = label || 'Auto';

    /* Backup-Daten speichern */
    try {
      if (isOnline()) {
        await getSupabase().from('einstellungen').upsert({
          id,
          firma_name: lbl,
          skonto_text: ts,
          logo_url: JSON.stringify(data),
        });
      } else {
        localStorage.setItem('mmg_' + id, JSON.stringify({ id, ts, label: lbl, data }));
      }
    } catch { return; }

    /* Index aktualisieren */
    const index = await this._getIndex();
    index.unshift({ id, ts, label: lbl });
    while (index.length > this.MAX) {
      const old = index.pop();
      try {
        if (isOnline()) await getSupabase().from('einstellungen').delete().eq('id', old.id);
        localStorage.removeItem('mmg_' + old.id);
      } catch {}
    }
    await this._setIndex(index);
  },

  /* ── Alle Backups laden (nur Metadaten) ── */
  async getAll() {
    return this._getIndex();
  },

  /* ── Backup wiederherstellen ── */
  async restore(id) {
    let data = null;
    try {
      if (isOnline()) {
        const { data: row } = await getSupabase()
          .from('einstellungen')
          .select('logo_url')
          .eq('id', id)
          .maybeSingle();
        if (row?.logo_url) data = JSON.parse(row.logo_url);
      }
    } catch {}
    if (!data) {
      try {
        const local = localStorage.getItem('mmg_' + id);
        if (local) data = JSON.parse(local).data;
      } catch {}
    }
    if (!data) return false;

    for (const t of this.TABLES) {
      if (Array.isArray(data[t])) LS.set(t, data[t]);
    }
    if (data['_einstellungen']) {
      const current = Settings.get();
      LS.setOne('einstellungen', { ...data['_einstellungen'], logo_url: current.logo_url });
    }
    return true;
  },

  /* ── Backup löschen ── */
  async delete(id) {
    try {
      if (isOnline()) await getSupabase().from('einstellungen').delete().eq('id', id);
      localStorage.removeItem('mmg_' + id);
    } catch {}
    const index = (await this._getIndex()).filter(b => b.id !== id);
    await this._setIndex(index);
  },

  /* ── Auto-Backup starten ── */
  startAuto() {
    setTimeout(() => this.create(), 8000);
    setInterval(() => this.create(), this.INTERVAL);
  },

  /* ── UI ── */
  async renderTab() {
    document.getElementById('einst-tab-content').innerHTML = `
      <div class="card" style="max-width:700px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
          <div>
            <div style="font-weight:700;font-size:1rem">Datensicherungen</div>
            <div style="font-size:.82rem;color:var(--text-muted)">Automatisch jede Minute · Supabase · auf allen Geräten verfügbar</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="BackupModule.manualBackup()">Jetzt sichern</button>
        </div>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem;line-height:1.5">
          Alle Daten werden jede Minute automatisch gesichert. Maximal 100 Sicherungen — älteste wird automatisch gelöscht.
        </p>
        <div id="backup-list" style="min-height:60px;display:flex;align-items:center;justify-content:center">
          <div class="spinner" style="width:24px;height:24px"></div>
        </div>
      </div>`;
    await this._renderList();
  },

  async _renderList() {
    const container = document.getElementById('backup-list');
    if (!container) return;
    const list = await this.getAll();
    const fmt = ts => new Date(ts).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    container.style = 'max-height:500px;overflow-y:auto;display:flex;flex-direction:column;gap:.35rem';
    container.innerHTML = list.length ? list.map((b, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.65rem .85rem;
        background:${i === 0 ? 'var(--green-light)' : 'var(--bg)'};
        border:1px solid ${i === 0 ? 'var(--green)' : 'var(--card-border)'};
        border-radius:var(--radius)">
        <div>
          <div style="font-weight:600;font-size:.9rem">
            ${b.label === 'Auto' ? 'Automatisch' : b.label}
            ${i === 0 ? '<span style="font-size:.7rem;background:var(--green);color:#fff;padding:.1rem .45rem;border-radius:4px;margin-left:.4rem">Neueste</span>' : ''}
          </div>
          <div style="font-size:.78rem;color:var(--text-muted)">${fmt(b.ts)}</div>
        </div>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-secondary btn-sm" onclick="BackupModule.confirmRestore('${b.id}','${fmt(b.ts)}')">Wiederherstellen</button>
          <button class="btn btn-danger btn-sm" onclick="BackupModule.confirmDelete('${b.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>`).join('')
    : '<p style="color:var(--text-muted);font-size:.875rem;padding:.5rem 0">Noch keine Sicherungen vorhanden. Die erste wird in wenigen Sekunden erstellt.</p>';
  },

  async manualBackup() {
    await this.create('Manuell');
    showToast('Sicherung erstellt', 'success');
    if (document.getElementById('backup-list')) await this._renderList();
  },

  confirmRestore(id, label) {
    openModal('Sicherung wiederherstellen',
      `<p>Sicherung vom <strong>${label}</strong> wiederherstellen?</p>
       <p style="margin-top:.75rem;color:var(--orange);font-size:.875rem">
         Die Daten werden durch diese Sicherung ersetzt. Die App wird danach neu geladen.
       </p>`,
      async () => {
        const ok = await this.restore(id);
        closeModal();
        if (ok) {
          showToast('Sicherung wiederhergestellt — App wird neu geladen', 'success');
          setTimeout(() => location.reload(), 1500);
        } else {
          showToast('Sicherung konnte nicht wiederhergestellt werden', 'error');
        }
      }, 'Wiederherstellen'
    );
  },

  confirmDelete(id) {
    confirmDelete('diese Sicherung', async () => {
      await this.delete(id);
      if (document.getElementById('backup-list')) await this._renderList();
    });
  },
};
