/* ═══════════════════════════════════════════════════════
   ZEITERFASSUNG — Stempeluhr, Timer, Tagesprotokoll
═══════════════════════════════════════════════════════ */

const ZeiterfassungModule = {
  timerInterval: null,
  state: null, // { status, startTime, pauseStart, totalPaused, log, projekt_id, projekt_label }
  _projektOpts: [], // temporärer Zwischenspeicher für Projekt-Picker

  /* ── Widget in Sidebar initialisieren ── */
  initWidget() {
    this.loadState();
    this.updateWidget();

    document.getElementById('sidebar-start-btn').addEventListener('click', () => this.start());
    document.getElementById('sidebar-pause-btn').addEventListener('click', () => this.pause());
    document.getElementById('sidebar-stop-btn').addEventListener('click',  () => this.stop());
  },

  /* ── Zustand laden ── */
  loadState() {
    const saved = localStorage.getItem('mmg_zeit_state_' + Auth.userId());
    if (saved) {
      try { this.state = JSON.parse(saved); } catch { this.state = null; }
    }
    if (!this.state || this.state.date !== today()) {
      this.state = { status: 'idle', startTime: null, pauseStart: null, totalPaused: 0, log: [], date: today(), projekt_id: null, projekt_label: null };
    }
  },

  saveState() {
    localStorage.setItem('mmg_zeit_state_' + Auth.userId(), JSON.stringify(this.state));
  },

  /* ── Start ── */
  async start() {
    if (this.state.status !== 'idle' && this.state.status !== 'paused') return;

    if (this.state.status === 'idle') {
      await this.showProjektPicker();
      return;
    }

    // Pause beenden (Projekt bleibt erhalten)
    const now = new Date().toISOString();
    const pauseDuration = new Date() - new Date(this.state.pauseStart);
    this.state.totalPaused += pauseDuration;
    this.state.log.push({ type: 'weiter', time: now });
    this.state.pauseStart = null;
    this.state.status = 'working';
    this.saveState();
    this.startTimer();
    this.updateWidget();
    this.renderIfActive();
  },

  /* ── Projekt-Picker ── */
  async showProjektPicker() {
    let auftraege = [];
    try { auftraege = await DB.getAll('auftraege'); } catch {}
    const aktiveAuftraege = auftraege.filter(a => a.workflow_status !== 'abgeschlossen');
    const kategorien = Settings.get().zeit_kategorien || [];

    this._projektOpts = [{ id: null, label: null }];
    aktiveAuftraege.forEach(a => this._projektOpts.push({ id: a.id, label: `${a.nummer || ''} – ${a.bezeichnung || ''}`.trim().replace(/^–\s*/, '') }));
    kategorien.forEach(k => this._projektOpts.push({ id: null, label: k }));

    const auftragOpts = aktiveAuftraege.map((a, i) =>
      `<option value="${i + 1}">${a.nummer || ''} – ${a.bezeichnung || ''}</option>`).join('');
    const katOpts = kategorien.map((k, i) =>
      `<option value="${aktiveAuftraege.length + 1 + i}">${k}</option>`).join('');

    let selectContent = `<option value="0">— Kein Projekt / Allgemein —</option>`;
    if (auftragOpts) selectContent += `<optgroup label="Aktive Aufträge">${auftragOpts}</optgroup>`;
    if (katOpts) selectContent += `<optgroup label="Sonstige Bereiche">${katOpts}</optgroup>`;

    openModal('Projekt / Bereich wählen',
      `<div class="form-group">
        <label class="form-label">Wofür wird die Zeit heute erfasst?</label>
        <select class="form-select" id="zeit-projekt-select" style="font-size:1rem;padding:.6rem">${selectContent}</select>
      </div>`,
      () => {
        const idx = parseInt(document.getElementById('zeit-projekt-select').value) || 0;
        const opt = this._projektOpts[idx] || { id: null, label: null };
        this._doStart(opt.id, opt.label);
      },
      'Starten'
    );
  },

  /* ── Eigentlicher Start nach Projektauswahl ── */
  _doStart(projekt_id, projekt_label) {
    const now = new Date().toISOString();
    this.state.startTime = now;
    this.state.log.push({ type: 'start', time: now });
    this.state.projekt_id = projekt_id || null;
    this.state.projekt_label = projekt_label || null;
    this.state.status = 'working';
    this.saveState();
    this.startTimer();
    this.updateWidget();
    this.renderIfActive();
  },

  /* ── Pause ── */
  pause() {
    if (this.state.status !== 'working') return;
    const now = new Date().toISOString();
    this.state.status = 'paused';
    this.state.pauseStart = now;
    this.state.log.push({ type: 'pause', time: now });
    this.saveState();
    clearInterval(this.timerInterval);
    this.updateWidget();
    this.renderIfActive();
  },

  /* ── Gehen (Stop) ── */
  async stop() {
    if (this.state.status === 'idle') return;
    const now = new Date().toISOString();

    if (this.state.status === 'paused') {
      const pauseDuration = new Date() - new Date(this.state.pauseStart);
      this.state.totalPaused += pauseDuration;
    }

    const totalMs = new Date() - new Date(this.state.startTime) - this.state.totalPaused;
    const totalMinutes = Math.round(totalMs / 60000);

    this.state.log.push({ type: 'gehen', time: now });
    this.state.status = 'gone';
    this.saveState();
    clearInterval(this.timerInterval);

    /* In DB speichern */
    try {
      await DB.insert('zeiterfassung', {
        user_id: Auth.userId(),
        datum: today(),
        start_zeit: this.state.startTime,
        pausen: this.state.log.filter(l => l.type === 'pause' || l.type === 'weiter'),
        end_zeit: now,
        gesamt_minuten: totalMinutes,
        projekt_id: this.state.projekt_id || null,
        projekt_label: this.state.projekt_label || null,
        sync_status: 'pending',
      });
    } catch (e) { console.warn('Zeiterfassung speichern:', e); }

    this.updateWidget();
    this.renderIfActive();
    showToast(`Guten Feierabend! Heute: ${formatDuration(totalMinutes)}`, 'success', 5000);
  },

  /* ── Timer starten ── */
  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay();
      if (currentModule === 'zeiterfassung') this.updateModuleTimer();
    }, 1000);
    this.updateTimerDisplay();
  },

  /* ── Elapsed berechnen ── */
  getElapsed() {
    if (!this.state.startTime) return 0;
    const now = this.state.status === 'paused' ? new Date(this.state.pauseStart) : new Date();
    return Math.max(0, now - new Date(this.state.startTime) - this.state.totalPaused);
  },

  formatElapsed(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  /* ── Widget-Display aktualisieren ── */
  updateTimerDisplay() {
    const el = document.getElementById('sidebar-timer');
    if (!el) return;
    if (this.state.status === 'idle' || this.state.status === 'gone') {
      el.textContent = this.state.status === 'gone' ? this.formatElapsed(this.getElapsed()) : '00:00:00';
    } else {
      el.textContent = this.formatElapsed(this.getElapsed());
    }
  },

  updateWidget() {
    const dot = document.getElementById('zeit-status-dot');
    const label = document.getElementById('sidebar-zeit-label');
    const startBtn = document.getElementById('sidebar-start-btn');
    const pauseBtn = document.getElementById('sidebar-pause-btn');
    const stopBtn = document.getElementById('sidebar-stop-btn');
    if (!dot) return;

    dot.className = 'zeit-status-dot';
    if (this.state.status === 'working') {
      dot.classList.add('active');
      label.textContent = 'Eingestempelt';
      startBtn.classList.add('hidden');
      pauseBtn.classList.remove('hidden');
      stopBtn.classList.remove('hidden');
      if (!this.timerInterval) this.startTimer();
    } else if (this.state.status === 'paused') {
      dot.classList.add('paused');
      label.textContent = 'Pause';
      startBtn.classList.remove('hidden');
      startBtn.textContent = '▶';
      pauseBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else if (this.state.status === 'gone') {
      label.textContent = 'Feierabend';
      startBtn.classList.add('hidden');
      pauseBtn.classList.add('hidden');
      stopBtn.classList.add('hidden');
    } else {
      label.textContent = 'Nicht eingestempelt';
      startBtn.classList.remove('hidden');
      startBtn.textContent = '▶';
      pauseBtn.classList.add('hidden');
      stopBtn.classList.add('hidden');
    }

    /* Projekt-Label in Sidebar ein-/ausblenden */
    let projektEl = document.getElementById('sidebar-projekt-label');
    if (!projektEl && label) {
      projektEl = document.createElement('div');
      projektEl.id = 'sidebar-projekt-label';
      projektEl.style.cssText = 'font-size:.7rem;color:var(--text-muted);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:.1rem';
      label.insertAdjacentElement('afterend', projektEl);
    }
    if (projektEl) {
      const showProjekt = (this.state.status === 'working' || this.state.status === 'paused') && this.state.projekt_label;
      projektEl.textContent = showProjekt ? `📋 ${this.state.projekt_label}` : '';
    }

    this.updateTimerDisplay();
  },

  renderIfActive() {
    if (currentModule === 'zeiterfassung') this.render();
  },

  updateModuleTimer() {
    const el = document.getElementById('zeit-module-timer');
    if (el) el.textContent = this.formatElapsed(this.getElapsed());
  },

  /* ── Modul-Seite rendern ── */
  async render() {
    this.loadState();
    const user = Auth.currentUser;
    const statusLabel = { idle: 'Nicht eingestempelt', working: 'Eingestempelt', paused: 'Pause', gone: 'Feierabend' };
    const elapsed = this.getElapsed();

    /* Heutige Einträge laden */
    let heutes = [];
    try {
      const all = await DB.getAll('zeiterfassung', { user_id: Auth.userId() });
      heutes = all.filter(e => e.datum === today()).sort((a,b) => new Date(a.start_zeit) - new Date(b.start_zeit));
    } catch (e) { /* offline */ }

    const actionBtns = this.renderActionBtns();

    setContent(`
      <div class="module-header">
        <div class="module-title">Zeiterfassung</div>
        ${Auth.isAdmin() ? `<button class="btn btn-secondary btn-sm" onclick="ZeiterfassungModule.renderAdmin()">Team-Übersicht</button>` : ''}
      </div>
      <div class="zeit-module">
        <div class="zeit-clock-card">
          <div style="font-size:.875rem;opacity:.7">Guten Tag, ${user?.name || ''}!</div>
          <div class="zeit-clock-display" id="zeit-module-timer">${this.formatElapsed(elapsed)}</div>
          <div class="zeit-clock-date">${new Date().toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</div>
          <div class="zeit-clock-status">${statusLabel[this.state.status] || ''}</div>
          ${(this.state.status === 'working' || this.state.status === 'paused') && this.state.projekt_label
            ? `<div style="font-size:.8rem;color:var(--text-muted);margin:.2rem 0">📋 ${this.state.projekt_label}</div>` : ''}
          <div class="zeit-clock-buttons">${actionBtns}</div>
        </div>

        ${heutes.length ? `
        <div class="card">
          <div class="card-header"><span class="card-title">📋 Heutiges Protokoll</span></div>
          ${this.renderTodayLog(heutes)}
        </div>` : this.state.log.length ? `
        <div class="card">
          <div class="card-header"><span class="card-title">📋 Heutiger Tag</span></div>
          ${this.renderCurrentLog()}
        </div>` : ''}

        <div class="card" style="margin-top:1rem">
          <div class="card-header"><span class="card-title">📅 Diese Woche</span></div>
          ${await this.renderWeekSummary()}
        </div>
      </div>
    `);

    /* Buttons verdrahten */
    document.getElementById('mod-start-btn')?.addEventListener('click', () => this.start());
    document.getElementById('mod-pause-btn')?.addEventListener('click', () => this.pause());
    document.getElementById('mod-stop-btn')?.addEventListener('click',  () => this.stop());

    if (this.state.status === 'working') this.startTimer();
  },

  renderActionBtns() {
    const s = this.state.status;
    if (s === 'idle') return `<button class="zeit-big-btn zeit-btn-start-lg" id="mod-start-btn">▶ Start</button>`;
    if (s === 'working') return `
      <button class="zeit-big-btn zeit-btn-pause-lg" id="mod-pause-btn">⏸ Pause</button>
      <button class="zeit-big-btn zeit-btn-gehen-lg" id="mod-stop-btn">🚪 Gehen</button>`;
    if (s === 'paused') return `
      <button class="zeit-big-btn zeit-btn-weiter-lg" id="mod-start-btn">▶ Weiter</button>
      <button class="zeit-big-btn zeit-btn-gehen-lg" id="mod-stop-btn">🚪 Gehen</button>`;
    if (s === 'gone') return `<div style="opacity:.7;font-size:.9rem">Feierabend genossen! 👋</div>`;
    return '';
  },

  renderCurrentLog() {
    if (!this.state.log.length) return '<p style="color:var(--text-muted);padding:1rem">Noch keine Einträge</p>';
    const icons = { start: '▶ Start', pause: '⏸ Pause', weiter: '▶ Weiter', gehen: '🚪 Gehen' };
    return this.state.log.map(l => `
      <div class="zeit-log-item">
        <span class="zeit-log-type">${icons[l.type] || l.type}</span>
        <span class="zeit-log-time">${formatTime(l.time)}</span>
      </div>`).join('');
  },

  renderTodayLog(entries) {
    if (!entries.length) return '<p style="color:var(--text-muted);padding:1rem">Noch keine Einträge</p>';
    return entries.map(e => `
      <div class="zeit-log-item">
        <div>
          <span class="zeit-log-type">⏱ ${formatTime(e.start_zeit)} – ${e.end_zeit ? formatTime(e.end_zeit) : 'laufend'}</span>
          ${e.projekt_label ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem">📋 ${e.projekt_label}</div>` : ''}
        </div>
        <span class="zeit-log-time">${formatDuration(e.gesamt_minuten)}</span>
      </div>`).join('');
  },

  async renderWeekSummary() {
    try {
      const all = await DB.getAll('zeiterfassung', { user_id: Auth.userId() });
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0);
      const week = all.filter(e => new Date(e.datum) >= weekStart);
      const total = week.reduce((s, e) => s + (e.gesamt_minuten || 0), 0);
      if (!week.length) return '<p style="color:var(--text-muted);padding:.5rem 0">Noch keine Stunden diese Woche</p>';
      return `
        <div class="detail-grid">
          <div class="detail-field"><div class="detail-field-label">Gesamt Woche</div><div class="detail-field-value" style="color:var(--navy);font-weight:800">${formatDuration(total)}</div></div>
          <div class="detail-field"><div class="detail-field-label">Arbeitstage</div><div class="detail-field-value">${[...new Set(week.map(e => e.datum))].length} Tage</div></div>
          <div class="detail-field"><div class="detail-field-label">Ø pro Tag</div><div class="detail-field-value">${formatDuration(Math.round(total / Math.max(1, [...new Set(week.map(e => e.datum))].length)))}</div></div>
        </div>`;
    } catch { return '<p style="color:var(--text-muted)">Offline</p>'; }
  },

  /* ── Admin-Übersicht ── */
  adminMonth: new Date().toISOString().slice(0, 7),

  async renderAdmin() {
    const all = await DB.getAll('zeiterfassung');
    const users = await DB.getAll('users');
    const todayEntries = all.filter(e => e.datum === today());
    const monthEntries = all.filter(e => e.datum?.startsWith(this.adminMonth));
    const userMap = {};
    users.forEach(u => userMap[u.id] = u);

    /* Monatsliste für Filter */
    const months = [...new Set(all.map(e => e.datum?.slice(0,7)).filter(Boolean))].sort().reverse();
    const monthLabel = m => {
      const d = new Date(m + '-01');
      return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    };

    setContent(`
      <div class="module-header">
        <div class="module-title">Zeiterfassung — Übersicht</div>
        <div class="module-actions">
          <button class="btn btn-secondary btn-sm" onclick="ZeiterfassungModule.render()">Meine Zeit</button>
          <button class="btn btn-primary btn-sm" onclick="ZeiterfassungModule.exportMonthPdf()">Monatsreport PDF</button>
        </div>
      </div>

      <!-- Heute im Betrieb -->
      <div class="card" style="margin-bottom:1.25rem">
        <div class="card-header"><span class="card-title">Heute im Betrieb — ${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})}</span></div>
        ${users.map(u => {
          const entry = todayEntries.find(e => e.user_id === u.id);
          const isActive = entry && !entry.end_zeit;
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid var(--card-border);flex-wrap:wrap;gap:.3rem">
            <div style="display:flex;align-items:center;gap:.6rem">
              <div style="width:32px;height:32px;border-radius:50%;background:${isActive?'var(--green)':entry?'var(--navy)':'var(--card-border)'};color:${isActive||entry?'#fff':'var(--text-muted)'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem">${u.name.charAt(0)}</div>
              <div>
                <div style="font-weight:600;font-size:.875rem">${u.name}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${u.position||'—'}</div>
              </div>
            </div>
            <div style="text-align:right">
              ${entry ? `
                <div style="font-size:.82rem">${formatTime(entry.start_zeit)} – ${entry.end_zeit ? formatTime(entry.end_zeit) : '<span style="color:var(--green);font-weight:600">aktiv</span>'}</div>
                <div style="font-weight:700;color:${isActive?'var(--green)':'var(--text)'}">${formatDuration(entry.gesamt_minuten)}</div>
              ` : '<div style="font-size:.82rem;color:var(--text-muted)">Nicht eingestempelt</div>'}
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Monatsauswahl -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
        <div style="font-weight:700;font-size:1rem">Monatsübersicht — ${monthLabel(this.adminMonth)}</div>
        <select class="form-select" style="width:auto" onchange="ZeiterfassungModule.adminMonth=this.value;ZeiterfassungModule.renderAdmin()">
          ${months.length ? months.map(m => `<option value="${m}" ${m===this.adminMonth?'selected':''}>${monthLabel(m)}</option>`).join('') : `<option value="${this.adminMonth}">${monthLabel(this.adminMonth)}</option>`}
        </select>
      </div>

      <!-- Zusammenfassung pro Mitarbeiter -->
      <div style="display:grid;gap:.75rem;margin-bottom:1.5rem">
        ${users.map(u => {
          const eintraege = monthEntries.filter(e => e.user_id === u.id);
          const gesamt = eintraege.reduce((s,e) => s+(e.gesamt_minuten||0), 0);
          const lohn = gesamt / 60 * (u.stundensatz || 0);
          return `<div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:${eintraege.length?'.75rem':'0'}">
              <div style="display:flex;align-items:center;gap:.6rem">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">${u.name.charAt(0)}</div>
                <div>
                  <div style="font-weight:700">${u.name}</div>
                  <div style="font-size:.78rem;color:var(--text-muted)">${u.position||'—'} • ${u.stundensatz||0} €/Std</div>
                </div>
              </div>
              <div style="display:flex;gap:1.5rem;text-align:right">
                <div><div style="font-size:.75rem;color:var(--text-muted)">Arbeitsstunden</div><div style="font-weight:700;font-size:1.1rem">${formatDuration(gesamt)}</div></div>
                <div><div style="font-size:.75rem;color:var(--text-muted)">Lohnkosten</div><div style="font-weight:700;font-size:1.1rem">${formatCurrency(lohn)}</div></div>
                <div><div style="font-size:.75rem;color:var(--text-muted)">Einträge</div><div style="font-weight:700;font-size:1.1rem">${eintraege.length}</div></div>
              </div>
            </div>
            ${eintraege.length ? `
            <div style="overflow-x:auto">
              <table style="width:100%;font-size:.8rem;border-collapse:collapse">
                <thead><tr style="background:var(--bg)"><th style="padding:.4rem .6rem;text-align:left">Datum</th><th style="padding:.4rem .6rem;text-align:left">Beginn</th><th style="padding:.4rem .6rem;text-align:left">Ende</th><th style="padding:.4rem .6rem;text-align:left">Projekt/Bereich</th><th style="padding:.4rem .6rem;text-align:left">Gesamt</th></tr></thead>
                <tbody>
                  ${eintraege.sort((a,b)=>a.datum>b.datum?1:-1).map(e=>`
                    <tr style="border-top:1px solid var(--card-border)">
                      <td style="padding:.4rem .6rem">${formatDate(e.datum)}</td>
                      <td style="padding:.4rem .6rem">${formatTime(e.start_zeit)}</td>
                      <td style="padding:.4rem .6rem">${e.end_zeit?formatTime(e.end_zeit):'—'}</td>
                      <td style="padding:.4rem .6rem;color:var(--text-muted)">${e.projekt_label||'—'}</td>
                      <td style="padding:.4rem .6rem;font-weight:600">${formatDuration(e.gesamt_minuten)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>` : '<div style="font-size:.82rem;color:var(--text-muted)">Keine Einträge in diesem Monat</div>'}
          </div>`;
        }).join('')}
      </div>
    `);
  },

  exportMonthPdf() {
    showToast('Monatsreport wird erstellt...', 'info');
    PdfModule.generateMonthReport();
  },
};
