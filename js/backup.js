/* ═══════════════════════════════════════════════════════
   BACKUP — Automatische Datensicherung in Supabase
   Jede Minute · Max 100 Backups · Geräteübergreifend
═══════════════════════════════════════════════════════ */

const BackupModule = {
  MAX: 100,
  INTERVAL: 60000,
  TABLES: [
    'users','kunden','auftraege','angebote','rechnungen',
    'aufgaben','kalender_events','chat_nachrichten',
    'urlaub','tickets','zeiterfassung'
  ],

  /* ── Backup erstellen ── */
  async create(label) {
    const data = {};
    for (const t of this.TABLES) {
      try { data[t] = await DB.getAll(t); } catch { data[t] = LS.get(t) || []; }
    }
    data['_einstellungen'] = Settings.get();

    try {
      const record = await DB.insert('backups', { label: label || 'Auto', data });
      await this._trim();
      return record;
    } catch (e) {
      /* Offline-Fallback: lokal speichern */
      this._saveLocal({ id: generateId(), erstellt_am: new Date().toISOString(), label: label || 'Auto', data });
    }
  },

  /* ── Alle Backups laden (nur Metadaten für die Liste) ── */
  async getAll() {
    try {
      const online = await DB.query('backups', { select: 'id, erstellt_am, label', orderBy: 'erstellt_am', ascending: false });
      if (online.length) return online;
    } catch {}
    return this._getLocal().map(({ id, erstellt_am, label }) => ({ id, erstellt_am, label }));
  },

  /* ── Backup wiederherstellen ── */
  async restore(id) {
    let backup = null;
    try {
      backup = await DB.getById('backups', id);
    } catch {}
    if (!backup) {
      backup = this._getLocal().find(b => b.id === id);
    }
    if (!backup?.data) return false;

    const { data } = backup;
    for (const t of this.TABLES) {
      if (Array.isArray(data[t])) LS.set(t, data[t]);
    }
    if (data['_einstellungen']) LS.setOne('einstellungen', data['_einstellungen']);
    return true;
  },

  /* ── Backup löschen ── */
  async delete(id) {
    try { await DB.delete('backups', id); } catch {}
    this._saveLocal(this._getLocal().filter(b => b.id !== id));
  },

  /* ── Älteste Backups löschen wenn > MAX ── */
  async _trim() {
    try {
      const all = await DB.query('backups', { select: 'id, erstellt_am', orderBy: 'erstellt_am', ascending: false });
      if (all.length > this.MAX) {
        for (const old of all.slice(this.MAX)) {
          await DB.delete('backups', old.id);
        }
      }
    } catch {}
  },

  /* ── Lokaler Fallback (Offline) ── */
  _getLocal() {
    try { return JSON.parse(localStorage.getItem('mmg_backups_local') || '[]'); }
    catch { return []; }
  },
  _saveLocal(entry) {
    const isArray = Array.isArray(entry);
    if (isArray) {
      try { localStorage.setItem('mmg_backups_local', JSON.stringify(entry)); } catch {}
      return;
    }
    const list = this._getLocal();
    list.unshift(entry);
    while (list.length > this.MAX) list.pop();
    try { localStorage.setItem('mmg_backups_local', JSON.stringify(list)); } catch {}
  },

  /* ── Auto-Backup starten ── */
  startAuto() {
    setTimeout(() => this.create(), 5000);
    setInterval(() => this.create(), this.INTERVAL);
  },

  /* ── UI ── */
  async renderTab() {
    document.getElementById('einst-tab-content').innerHTML = `
      <div class="card" style="max-width:700px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
          <div>
            <div style="font-weight:700;font-size:1rem">Datensicherungen</div>
            <div style="font-size:.82rem;color:var(--text-muted)">Automatisch jede Minute · in Supabase gespeichert · auf allen Geräten verfügbar</div>
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
          <div style="font-size:.78rem;color:var(--text-muted)">${fmt(b.erstellt_am)}</div>
        </div>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-secondary btn-sm" onclick="BackupModule.confirmRestore('${b.id}','${fmt(b.erstellt_am)}')">Wiederherstellen</button>
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
         Die lokalen Daten werden durch diese Sicherung ersetzt. Die App wird danach neu geladen.
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
