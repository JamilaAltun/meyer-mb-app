/* ═══════════════════════════════════════════════════════
   BACKUP — Automatische Datensicherung (jede Minute, max 100)
═══════════════════════════════════════════════════════ */

const BackupModule = {
  MAX: 100,
  INTERVAL: 60000,
  KEY: 'mmg_backups',
  TABLES: [
    'users','kunden','auftraege','angebote','rechnungen',
    'aufgaben','kalender_events','chat_nachrichten',
    'urlaub','tickets','zeiterfassung_eintraege'
  ],

  getAll() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
    catch { return []; }
  },

  _save(list) {
    try { localStorage.setItem(this.KEY, JSON.stringify(list)); }
    catch (e) {
      /* localStorage voll: älteste Hälfte löschen und nochmal versuchen */
      const trimmed = list.slice(0, Math.floor(list.length / 2));
      try { localStorage.setItem(this.KEY, JSON.stringify(trimmed)); } catch {}
    }
  },

  async create(label) {
    const data = {};
    for (const t of this.TABLES) {
      try { data[t] = await DB.getAll(t); } catch { data[t] = LS.get(t) || []; }
    }
    data['_einstellungen'] = Settings.get();

    const backup = {
      id: generateId(),
      ts: new Date().toISOString(),
      label: label || 'Auto',
      data,
    };

    const list = this.getAll();
    list.unshift(backup);
    while (list.length > this.MAX) list.pop();
    this._save(list);
    return backup;
  },

  restore(id) {
    const backup = this.getAll().find(b => b.id === id);
    if (!backup) return false;
    const { data } = backup;
    for (const t of this.TABLES) {
      if (Array.isArray(data[t])) LS.set(t, data[t]);
    }
    if (data['_einstellungen']) LS.setOne('einstellungen', data['_einstellungen']);
    return true;
  },

  delete(id) {
    this._save(this.getAll().filter(b => b.id !== id));
  },

  startAuto() {
    /* Erstes Backup sofort, danach jede Minute */
    setTimeout(() => this.create(), 5000);
    setInterval(() => this.create(), this.INTERVAL);
  },

  /* ── UI ── */
  renderTab() {
    const list = this.getAll();
    const fmt = ts => new Date(ts).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    document.getElementById('einst-tab-content').innerHTML = `
      <div class="card" style="max-width:700px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
          <div>
            <div style="font-weight:700;font-size:1rem">Datensicherungen</div>
            <div style="font-size:.82rem;color:var(--text-muted)">Automatisch jede Minute · ${list.length}/100 Sicherungen</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="BackupModule.manualBackup()">Jetzt sichern</button>
        </div>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem;line-height:1.5">
          Alle lokalen Daten werden jede Minute gesichert. Maximal 100 Sicherungen werden gespeichert — die älteste wird automatisch gelöscht, sobald das Limit erreicht ist.
        </p>
        <div id="backup-list" style="max-height:500px;overflow-y:auto;display:flex;flex-direction:column;gap:.35rem">
          ${list.length ? list.map((b, i) => `
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
          : '<p style="color:var(--text-muted);font-size:.875rem;padding:.5rem 0">Noch keine Sicherungen vorhanden. Die erste wird in wenigen Sekunden erstellt.</p>'}
        </div>
      </div>`;
  },

  async manualBackup() {
    await this.create('Manuell');
    showToast('Sicherung erstellt', 'success');
    if (document.getElementById('backup-list')) this.renderTab();
  },

  confirmRestore(id, label) {
    openModal('Sicherung wiederherstellen',
      `<p>Sicherung vom <strong>${label}</strong> wiederherstellen?</p>
       <p style="margin-top:.75rem;color:var(--orange);font-size:.875rem">
         Die lokalen Daten werden durch diese Sicherung ersetzt. Die App wird danach neu geladen.
       </p>`,
      () => {
        const ok = this.restore(id);
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
    confirmDelete('diese Sicherung', () => {
      this.delete(id);
      if (document.getElementById('backup-list')) this.renderTab();
    });
  },
};
