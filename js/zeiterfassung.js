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
    /* Browser-Neustart / Refresh ohne Logout: laufenden Timer pausieren */
    if (this.state.status === 'working') {
      const now = new Date().toISOString();
      this.state.status = 'paused';
      this.state.pauseStart = now;
      if (this.state.log) this.state.log.push({ type: 'pause', time: now });
      this.saveState();
    }
    /* Beim Schließen/Reload: Status sofort in localStorage einfrieren */
    window.onbeforeunload = () => {
      if (this.state?.status === 'working') {
        const now = new Date().toISOString();
        this.state.status = 'paused';
        this.state.pauseStart = now;
        if (this.state.log) this.state.log.push({ type: 'pause', time: now });
        this.saveState();
      }
    };
    this.updateWidget();
    /* .onclick statt addEventListener — kein Stapeln bei mehrfachem initWidget-Aufruf */
    document.getElementById('sidebar-start-btn').onclick = () => this.start();
    document.getElementById('sidebar-pause-btn').onclick = () => this.pause();
    document.getElementById('sidebar-stop-btn').onclick  = () => this.stop();
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
    if (this.state.status !== 'idle' && this.state.status !== 'paused' && this.state.status !== 'gone') return;

    if (this.state.status === 'gone') {
      /* Neue Schicht nach Feierabend: State zurücksetzen */
      this._resetStateLS();
    }

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
    /* Interval läuft weiter — zeigt live Pausendauer an */
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

  /* ── Pausendauer berechnen ── */
  getPauseDuration() {
    if (!this.state.pauseStart) return 0;
    return Math.max(0, Date.now() - new Date(this.state.pauseStart).getTime());
  },

  /* ── Elapsed berechnen ── */
  getElapsed() {
    if (!this.state.startTime) return 0;
    let now;
    if (this.state.status === 'paused') {
      now = new Date(this.state.pauseStart);
    } else if (this.state.status === 'gone') {
      /* Eingefroren auf den Gehen-Zeitpunkt, nicht current time */
      const gehenEvent = (this.state.log || []).slice().reverse().find(l => l.type === 'gehen');
      now = gehenEvent ? new Date(gehenEvent.time) : new Date(this.state.startTime);
    } else {
      now = new Date();
    }
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
    if (this.state.status === 'idle') {
      el.textContent = '00:00:00';
    } else if (this.state.status === 'gone') {
      el.textContent = this.formatElapsed(this.getElapsed());
    } else if (this.state.status === 'paused') {
      el.textContent = this.formatElapsed(this.getPauseDuration());
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
      if (!this.timerInterval) this.startTimer();
    } else if (this.state.status === 'gone') {
      label.textContent = 'Feierabend';
      startBtn.classList.remove('hidden');
      startBtn.textContent = '▶';
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
      projektEl.textContent = showProjekt ? this.state.projekt_label : '';
    }

    this.updateTimerDisplay();
  },

  renderIfActive() {
    if (currentModule === 'zeiterfassung') this.render();
  },

  updateModuleTimer() {
    const el = document.getElementById('zeit-module-timer');
    if (!el) return;
    if (this.state.status === 'paused') {
      el.textContent = this.formatElapsed(this.getPauseDuration());
    } else {
      el.textContent = this.formatElapsed(this.getElapsed());
    }
  },

  /* ── Tabs ── */
  userTab: null,
  userMonth: new Date().toISOString().slice(0, 7),
  _allEntries: [],
  _teamRefreshInterval: null,

  /* ── Modul-Seite rendern ── */
  async render() {
    this.loadState();
    if (this.userTab === null) this.userTab = Auth.isAdmin() ? 'team' : 'heute';
    try { this._allEntries = await DB.getAll('zeiterfassung', { user_id: Auth.userId() }); } catch { this._allEntries = []; }

    const tabs = Auth.isAdmin()
      ? [['team','Team'],['heute','Meine Zeit'],['woche','Diese Woche'],['monat','Monat'],['projekte','Projekte']]
      : [['heute','Heute'],['woche','Diese Woche'],['monat','Monat'],['projekte','Projekte']];

    setContent(`
      <div class="module-header">
        <div class="module-title">Zeiterfassung</div>
        <div class="module-actions">
          <button class="btn btn-primary btn-sm" onclick="ZeiterfassungModule.showAddEntryModal()">+ Eintrag hinzufügen</button>
        </div>
      </div>
      <div class="tabs">
        ${tabs.map(([k,l]) =>
          `<div class="tab-btn ${this.userTab===k?'active':''}" onclick="ZeiterfassungModule.userTab='${k}';ZeiterfassungModule.renderUserTab()">${l}</div>`
        ).join('')}
      </div>
      <div id="zeit-user-tab" style="margin-top:1.25rem"></div>
    `);

    this.renderUserTab();
  },

  renderUserTab() {
    clearInterval(this._teamRefreshInterval);
    const allTabs = ['team','heute','woche','monat','projekte'];
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', allTabs.some(t =>
        b.getAttribute('onclick')?.includes(`'${t}'`) && this.userTab === t));
    });
    const map = {
      team:     () => this.renderTeamTab(),
      heute:    () => this.renderHeuteTab(),
      woche:    () => this.renderWocheTab(),
      monat:    () => this.renderMonatTab(),
      projekte: () => this.renderProjekteTab(),
    };
    map[this.userTab]?.();
  },

  /* ── Tab: Team (Admin) ── */
  async renderTeamTab() {
    let users = [], entries = [];
    try {
      [users, entries] = await Promise.all([
        DB.getAll('users'),
        DB.getAll('zeiterfassung'),
      ]);
    } catch {}

    const todayStr = today();
    const todayEntries = entries.filter(e => e.datum === todayStr);

    const cards = users.map(u => {
      const entry = todayEntries.find(e => e.user_id === u.id);
      const active = entry && !entry.end_zeit;
      const done   = entry && !!entry.end_zeit;

      let statusColor, statusText, zeitInfo;
      if (active) {
        statusColor = 'var(--green)';
        statusText  = 'Eingestempelt';
        zeitInfo    = `Seit ${formatTime(entry.start_zeit)}${entry.projekt_label ? '<br>' + entry.projekt_label : ''}`;
      } else if (done) {
        statusColor = 'var(--navy)';
        statusText  = 'Feierabend';
        zeitInfo    = `${formatTime(entry.start_zeit)} – ${formatTime(entry.end_zeit)}<br><strong>${formatDuration(entry.gesamt_minuten)}</strong>`;
      } else {
        statusColor = 'var(--red)';
        statusText  = 'Nicht eingestempelt';
        zeitInfo    = '—';
      }

      return `
        <div style="background:var(--card);border-radius:14px;border:2px solid ${statusColor};padding:1.25rem 1rem;display:flex;flex-direction:column;align-items:center;gap:.6rem;text-align:center;box-shadow:var(--shadow)">
          <!-- Avatar -->
          <div style="width:56px;height:56px;border-radius:50%;background:${statusColor};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.4rem">${u.name.charAt(0).toUpperCase()}</div>
          <!-- Name & Position -->
          <div>
            <div style="font-weight:700;font-size:.95rem">${u.name}</div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:.1rem">${u.position || '—'}</div>
          </div>
          <!-- Status-Badge -->
          <div style="display:inline-flex;align-items:center;gap:.35rem;background:${statusColor}22;color:${statusColor};font-weight:700;font-size:.78rem;padding:.25rem .65rem;border-radius:99px">
            <span style="width:7px;height:7px;border-radius:50%;background:${statusColor};display:inline-block${active ? ';animation:pulse 1.5s infinite' : ''}"></span>
            ${statusText}
          </div>
          <!-- Zeit-Info -->
          <div style="font-size:.78rem;color:var(--text-muted);line-height:1.5">${zeitInfo}</div>
        </div>`;
    }).join('');

    const aktiv  = users.filter(u => todayEntries.find(e => e.user_id === u.id && !e.end_zeit)).length;
    const fertig = users.filter(u => todayEntries.find(e => e.user_id === u.id && !!e.end_zeit)).length;
    const fehlt  = users.length - aktiv - fertig;

    document.getElementById('zeit-user-tab').innerHTML = `
      <!-- Heute-Status Übersicht -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.25rem">
        <div class="card" style="text-align:center;padding:1rem .5rem;border-top:3px solid var(--green)">
          <div style="font-size:1.8rem;font-weight:800;color:var(--green)">${aktiv}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">Eingestempelt</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem;border-top:3px solid var(--red)">
          <div style="font-size:1.8rem;font-weight:800;color:var(--red)">${fehlt}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">Fehlen noch</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem;border-top:3px solid var(--navy)">
          <div style="font-size:1.8rem;font-weight:800;color:var(--navy)">${fertig}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">Feierabend</div>
        </div>
      </div>

      <!-- Mitarbeiter-Karten -->
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.75rem">${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} · Aktualisierung alle 60 Sek.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem">
        ${cards || '<p style="color:var(--text-muted)">Keine Mitarbeiter vorhanden</p>'}
      </div>`;

    /* Alle 60 Sekunden automatisch aktualisieren */
    this._teamRefreshInterval = setInterval(() => {
      if (this.userTab === 'team') this.renderTeamTab();
    }, 60000);
  },

  /* ── Tab: Heute ── */
  renderHeuteTab() {
    const user = Auth.currentUser;
    const statusLabel = { idle: 'Nicht eingestempelt', working: 'Eingestempelt', paused: 'Pause', gone: 'Feierabend' };
    const elapsed = this.getElapsed();
    const heutes = this._allEntries
      .filter(e => e.datum === today())
      .sort((a,b) => new Date(a.start_zeit) - new Date(b.start_zeit));
    const totalHeute = heutes.reduce((s, e) => s + (e.gesamt_minuten || 0), 0);

    document.getElementById('zeit-user-tab').innerHTML = `
      <div class="zeit-module">
        <div class="zeit-clock-card">
          <div style="font-size:.875rem;opacity:.7">Guten Tag, ${user?.name || ''}!</div>
          <div class="zeit-clock-display" id="zeit-module-timer">${this.formatElapsed(elapsed)}</div>
          <div class="zeit-clock-date">${new Date().toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</div>
          <div class="zeit-clock-status">${statusLabel[this.state.status] || ''}</div>
          ${(this.state.status === 'working' || this.state.status === 'paused') && this.state.projekt_label
            ? `<div style="font-size:.8rem;color:var(--text-muted);margin:.2rem 0">${this.state.projekt_label}</div>` : ''}
          <div class="zeit-clock-buttons">${this.renderActionBtns()}</div>
        </div>

        ${heutes.length ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Heutiges Protokoll</span>
            ${totalHeute ? `<span style="font-weight:700;color:var(--navy)">${formatDuration(totalHeute)}</span>` : ''}
          </div>
          ${this.renderTodayLog(heutes)}
        </div>` : (this.state.log.length && this.state.status !== 'idle' && this.state.status !== 'gone') ? `
        <div class="card">
          <div class="card-header"><span class="card-title">Heutiger Tag</span></div>
          ${this.renderCurrentLog()}
        </div>` : ''}
      </div>`;

    document.getElementById('mod-start-btn')?.addEventListener('click', () => this.start());
    document.getElementById('mod-pause-btn')?.addEventListener('click', () => this.pause());
    document.getElementById('mod-stop-btn')?.addEventListener('click',  () => this.stop());
    if (this.state.status === 'working') this.startTimer();
  },

  /* ── Tab: Diese Woche ── */
  renderWocheTab() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const wochenEintraege = this._allEntries.filter(e => {
      const d = new Date(e.datum);
      return d >= weekStart && d <= weekEnd;
    });

    const total = wochenEintraege.reduce((s, e) => s + (e.gesamt_minuten || 0), 0);
    const arbeitstage = [...new Set(wochenEintraege.map(e => e.datum))].length;
    const schnitt = arbeitstage ? Math.round(total / arbeitstage) : 0;
    const sollDiff = total - 2400; // Soll 40h = 2400 min

    const dayNames = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const entries = wochenEintraege.filter(e => e.datum === dateStr);
      const mins = entries.reduce((s, e) => s + (e.gesamt_minuten || 0), 0);
      return { d, dateStr, entries, mins, name: dayNames[i] };
    });
    const maxMins = Math.max(...days.map(d => d.mins), 480);

    document.getElementById('zeit-user-tab').innerHTML = `
      <!-- Stat-Karten -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin-bottom:1.25rem">
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Gesamt Woche</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${formatDuration(total)}</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Arbeitstage</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${arbeitstage} <span style="font-size:.85rem;font-weight:400">Tage</span></div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Ø pro Tag</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${formatDuration(schnitt)}</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Soll (40h)</div>
          <div style="font-size:1.4rem;font-weight:800;color:${sollDiff >= 0 ? 'var(--green)' : 'var(--orange)'}">${sollDiff >= 0 ? '+' : ''}${formatDuration(Math.abs(sollDiff))}</div>
        </div>
      </div>

      <!-- Wochen-Balkendiagramm -->
      <div class="card" style="margin-bottom:1.25rem">
        <div class="card-header"><span class="card-title">Wochenverlauf</span></div>
        <div style="display:flex;gap:.4rem;align-items:flex-end;height:110px;padding:.25rem 0 0">
          ${days.map(day => {
            const pct = day.mins ? Math.max(5, Math.round(day.mins / maxMins * 100)) : 0;
            const isToday = day.dateStr === today();
            return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:.25rem">
              <div style="font-size:.68rem;color:var(--text-muted);font-weight:${day.mins?'600':'400'};white-space:nowrap">${day.mins ? formatDuration(day.mins) : ''}</div>
              <div style="width:100%;flex:1;display:flex;align-items:flex-end">
                <div style="width:100%;height:${pct}%;min-height:${pct?'4px':'0'};background:${isToday?'var(--navy)':day.mins?'var(--blue-light)':'var(--card-border)'};border-radius:4px 4px 0 0"></div>
              </div>
              <div style="font-size:.75rem;font-weight:${isToday?'700':'400'};color:${isToday?'var(--navy)':'var(--text-muted)'}">${day.name}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Tagesdetails -->
      <div class="card">
        <div class="card-header"><span class="card-title">Details</span></div>
        ${days.filter(d => d.entries.length).length === 0
          ? '<p style="color:var(--text-muted);padding:.5rem 0">Noch keine Einträge diese Woche</p>'
          : days.filter(d => d.entries.length).map(day => `
          <div style="padding:.65rem 0;border-bottom:1px solid var(--card-border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
              <span style="font-weight:600;font-size:.875rem">${day.d.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit'})}</span>
              <span style="font-weight:700;color:var(--navy)">${formatDuration(day.mins)}</span>
            </div>
            ${day.entries.map(e => `
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:.78rem;color:var(--text-muted);padding:.1rem 0">
                <span>${formatTime(e.start_zeit)} – ${e.end_zeit?formatTime(e.end_zeit):'laufend'}${e.projekt_label?' · '+e.projekt_label:''}</span>
                <div style="display:flex;align-items:center;gap:.2rem">
                  <span>${formatDuration(e.gesamt_minuten)}</span>
                  <button onclick="ZeiterfassungModule.editEntry('${e.id}')" style="background:none;border:none;cursor:pointer;padding:.1rem .25rem;border-radius:4px;color:var(--text-muted);font-size:.8rem" title="Bearbeiten">✎</button>
                  <button onclick="ZeiterfassungModule.deleteEntry('${e.id}')" style="background:none;border:none;cursor:pointer;padding:.1rem .25rem;border-radius:4px;color:var(--red);font-size:.8rem" title="Löschen">✕</button>
                </div>
              </div>`).join('')}
          </div>`).join('')}
      </div>`;
  },

  /* ── Tab: Monat ── */
  renderMonatTab() {
    const monatsEintraege = this._allEntries
      .filter(e => e.datum?.startsWith(this.userMonth))
      .sort((a,b) => a.datum > b.datum ? 1 : -1);
    const total = monatsEintraege.reduce((s, e) => s + (e.gesamt_minuten || 0), 0);
    const arbeitstage = [...new Set(monatsEintraege.map(e => e.datum))].length;

    const months = [...new Set(this._allEntries.map(e => e.datum?.slice(0,7)).filter(Boolean))].sort().reverse();
    if (!months.includes(this.userMonth)) months.unshift(this.userMonth);
    const monthLabel = m => new Date(m + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    document.getElementById('zeit-user-tab').innerHTML = `
      <!-- Monatsfilter -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
        <div style="font-weight:700;font-size:1rem">${monthLabel(this.userMonth)}</div>
        <select class="form-select" style="width:auto" onchange="ZeiterfassungModule.userMonth=this.value;ZeiterfassungModule.renderUserTab()">
          ${months.map(m => `<option value="${m}" ${m===this.userMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}
        </select>
      </div>

      <!-- Stat-Karten -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin-bottom:1.25rem">
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Gesamt</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${formatDuration(total)}</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Arbeitstage</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${arbeitstage}</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Ø pro Tag</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${arbeitstage ? formatDuration(Math.round(total/arbeitstage)) : '—'}</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Einträge</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${monatsEintraege.length}</div>
        </div>
      </div>

      <!-- Monatstabelle -->
      <div class="card">
        <div class="card-header"><span class="card-title">Alle Einträge</span></div>
        ${monatsEintraege.length ? `
        <div style="overflow-x:auto">
          <table style="width:100%;font-size:.82rem;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg)">
                <th style="padding:.5rem .6rem;text-align:left;font-weight:600">Datum</th>
                <th style="padding:.5rem .6rem;text-align:left;font-weight:600">Beginn</th>
                <th style="padding:.5rem .6rem;text-align:left;font-weight:600">Ende</th>
                <th style="padding:.5rem .6rem;text-align:left;font-weight:600">Projekt / Bereich</th>
                <th style="padding:.5rem .6rem;text-align:right;font-weight:600">Stunden</th>
                <th style="padding:.5rem .6rem"></th>
              </tr>
            </thead>
            <tbody>
              ${monatsEintraege.map(e => `
                <tr style="border-top:1px solid var(--card-border)">
                  <td style="padding:.5rem .6rem">${formatDate(e.datum)}</td>
                  <td style="padding:.5rem .6rem">${formatTime(e.start_zeit)}</td>
                  <td style="padding:.5rem .6rem">${e.end_zeit?formatTime(e.end_zeit):'—'}</td>
                  <td style="padding:.5rem .6rem;color:var(--text-muted)">${e.projekt_label||'—'}</td>
                  <td style="padding:.5rem .6rem;text-align:right;font-weight:600">${formatDuration(e.gesamt_minuten)}</td>
                  <td style="padding:.5rem .4rem;white-space:nowrap">
                    <button onclick="ZeiterfassungModule.editEntry('${e.id}')" style="background:none;border:none;cursor:pointer;padding:.2rem .35rem;border-radius:4px;color:var(--text-muted);font-size:.85rem" title="Bearbeiten">✎</button>
                    <button onclick="ZeiterfassungModule.deleteEntry('${e.id}')" style="background:none;border:none;cursor:pointer;padding:.2rem .35rem;border-radius:4px;color:var(--red);font-size:.85rem" title="Löschen">✕</button>
                  </td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--card-border);background:var(--bg)">
                <td colspan="4" style="padding:.5rem .6rem;font-weight:700">Gesamt</td>
                <td style="padding:.5rem .6rem;text-align:right;font-weight:800;color:var(--navy)">${formatDuration(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>` : '<p style="color:var(--text-muted);padding:.5rem 0">Keine Einträge in diesem Monat</p>'}
      </div>`;
  },

  /* ── Tab: Projekte ── */
  renderProjekteTab() {
    const projektMap = {};
    this._allEntries.forEach(e => {
      const key = e.projekt_label || '— Kein Projekt';
      if (!projektMap[key]) projektMap[key] = { label: key, minuten: 0, eintraege: 0 };
      projektMap[key].minuten += e.gesamt_minuten || 0;
      projektMap[key].eintraege++;
    });

    const projekte = Object.values(projektMap).sort((a,b) => b.minuten - a.minuten);
    const gesamtMinuten = projekte.reduce((s, p) => s + p.minuten, 0);
    const maxMins = projekte[0]?.minuten || 1;

    document.getElementById('zeit-user-tab').innerHTML = `
      <!-- Gesamtübersicht -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin-bottom:1.25rem">
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Gesamt (alle Zeit)</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${formatDuration(gesamtMinuten)}</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Projekte / Bereiche</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${projekte.length}</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem .5rem">
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem">Buchungen gesamt</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--navy)">${this._allEntries.length}</div>
        </div>
      </div>

      <!-- Stunden pro Projekt -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Stunden nach Projekt / Bereich</span>
        </div>
        ${projekte.length ? projekte.map(p => {
          const pct = Math.round(p.minuten / maxMins * 100);
          const anteil = gesamtMinuten ? Math.round(p.minuten / gesamtMinuten * 100) : 0;
          return `
          <div style="padding:.75rem 0;border-bottom:1px solid var(--card-border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
              <span style="font-weight:600;font-size:.875rem">${p.label}</span>
              <span style="font-weight:700;color:var(--navy)">${formatDuration(p.minuten)} <span style="font-weight:400;color:var(--text-muted);font-size:.75rem">${anteil}%</span></span>
            </div>
            <div style="background:var(--card-border);border-radius:4px;height:7px;overflow:hidden;margin-bottom:.25rem">
              <div style="width:${pct}%;height:100%;background:var(--navy);border-radius:4px"></div>
            </div>
            <div style="font-size:.75rem;color:var(--text-muted)">${p.eintraege} Buchung${p.eintraege!==1?'en':''}</div>
          </div>`;
        }).join('') : '<p style="color:var(--text-muted)">Noch keine Daten vorhanden</p>'}
      </div>`;
  },

  renderActionBtns() {
    const s = this.state.status;
    if (s === 'idle') return `<button class="zeit-big-btn zeit-btn-start-lg" id="mod-start-btn">▶ Start</button>`;
    if (s === 'working') return `
      <button class="zeit-big-btn zeit-btn-pause-lg" id="mod-pause-btn">⏸ Pause</button>
      <button class="zeit-big-btn zeit-btn-gehen-lg" id="mod-stop-btn">Gehen</button>`;
    if (s === 'paused') return `
      <button class="zeit-big-btn zeit-btn-weiter-lg" id="mod-start-btn">▶ Weiter</button>
      <button class="zeit-big-btn zeit-btn-gehen-lg" id="mod-stop-btn">Gehen</button>`;
    if (s === 'gone') return `<button class="zeit-big-btn zeit-btn-start-lg" id="mod-start-btn">▶ Neue Schicht</button>`;
    return '';
  },

  renderCurrentLog() {
    if (!this.state.log.length) return '<p style="color:var(--text-muted);padding:1rem">Noch keine Einträge</p>';
    const items = [];
    for (let i = 0; i < this.state.log.length; i++) {
      const l = this.state.log[i];
      if (l.type === 'pause') {
        const nextWeiter = this.state.log.slice(i + 1).find(x => x.type === 'weiter');
        const pauseEnd = nextWeiter ? new Date(nextWeiter.time) : (this.state.status === 'paused' ? new Date() : null);
        const pauseMs = pauseEnd ? pauseEnd - new Date(l.time) : null;
        const pauseLabel = pauseMs !== null ? formatDuration(Math.round(pauseMs / 60000)) : 'läuft...';
        items.push(`<div class="zeit-log-item">
          <span class="zeit-log-type">⏸ Pause</span>
          <span class="zeit-log-time">${pauseLabel}</span>
        </div>`);
      } else if (l.type === 'weiter') {
        /* wird in der Pause-Zeile angezeigt */
      } else {
        const icons = { start: '▶ Start', gehen: 'Gehen' };
        items.push(`<div class="zeit-log-item">
          <span class="zeit-log-type">${icons[l.type] || l.type}</span>
          <span class="zeit-log-time">${formatTime(l.time)}</span>
        </div>`);
      }
    }
    return items.join('');
  },

  renderTodayLog(entries) {
    if (!entries.length) return '<p style="color:var(--text-muted);padding:1rem">Noch keine Einträge</p>';
    return entries.map(e => `
      <div class="zeit-log-item">
        <div>
          <span class="zeit-log-type">⏱ ${formatTime(e.start_zeit)} – ${e.end_zeit ? formatTime(e.end_zeit) : 'laufend'}</span>
          ${e.projekt_label ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem">${e.projekt_label}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:.3rem">
          <span class="zeit-log-time">${formatDuration(e.gesamt_minuten)}</span>
          <button onclick="ZeiterfassungModule.editEntry('${e.id}')" style="background:none;border:none;cursor:pointer;padding:.2rem .3rem;border-radius:4px;color:var(--text-muted);font-size:.85rem" title="Bearbeiten">✎</button>
          <button onclick="ZeiterfassungModule.deleteEntry('${e.id}')" style="background:none;border:none;cursor:pointer;padding:.2rem .3rem;border-radius:4px;color:var(--red);font-size:.85rem" title="Löschen">✕</button>
        </div>
      </div>`).join('');
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

  /* ── Beim Logout: Timer stoppen, Zustand sofort zurücksetzen, DB im Hintergrund ── */
  _saveSessionOnLogout() {
    if (!this.state || this.state.status === 'idle' || this.state.status === 'gone') {
      this._resetStateLS();
      return;
    }
    /* Alle Werte synchron auslesen bevor state genullt wird */
    const now      = new Date().toISOString();
    const userId   = Auth.userId();
    const datum    = this.state.date || today();
    const start    = this.state.startTime;
    let paused     = this.state.totalPaused || 0;
    if (this.state.status === 'paused') paused += Math.max(0, new Date() - new Date(this.state.pauseStart));
    const mins     = Math.round(Math.max(0, new Date() - new Date(start) - paused) / 60000);
    const pausen   = (this.state.log || []).filter(l => l.type === 'pause' || l.type === 'weiter');
    const pid      = this.state.projekt_id || null;
    const plabel   = this.state.projekt_label || null;

    /* Zustand sofort zurücksetzen — Logout wartet nicht auf DB */
    this._resetStateLS(userId);

    /* DB-Eintrag im Hintergrund speichern (fire-and-forget) */
    DB.insert('zeiterfassung', {
      user_id: userId, datum, start_zeit: start, pausen,
      end_zeit: now, gesamt_minuten: mins,
      projekt_id: pid, projekt_label: plabel, sync_status: 'pending',
    }).catch(() => {});
  },

  _resetStateLS(userId) {
    const uid   = userId || Auth.userId();
    const fresh = { status: 'idle', startTime: null, pauseStart: null,
      totalPaused: 0, log: [], date: today(), projekt_id: null, projekt_label: null };
    this.state = fresh;
    try { if (uid) localStorage.setItem('mmg_zeit_state_' + uid, JSON.stringify(fresh)); } catch {}
  },

  exportMonthPdf() {
    showToast('Monatsreport wird erstellt...', 'info');
    PdfModule.generateMonthReport();
  },

  /* ── Eintrag bearbeiten ── */
  async editEntry(id) {
    const entry = this._allEntries.find(e => e.id === id);
    if (!entry) return;

    let auftraege = [];
    try { auftraege = await DB.getAll('auftraege'); } catch {}
    const aktiveAuftraege = auftraege.filter(a => a.workflow_status !== 'abgeschlossen');
    const kategorien = Settings.get().zeit_kategorien || [];

    const projektOpts = [{ id: null, label: null }];
    aktiveAuftraege.forEach(a => projektOpts.push({ id: a.id, label: `${a.nummer || ''} – ${a.bezeichnung || ''}`.trim().replace(/^–\s*/, '') }));
    kategorien.forEach(k => projektOpts.push({ id: null, label: k }));
    this._editProjektOpts = projektOpts;
    this._editEntryId = id;

    let currentIdx = 0;
    if (entry.projekt_id) {
      const i = projektOpts.findIndex(p => p.id === entry.projekt_id);
      if (i > 0) currentIdx = i;
    } else if (entry.projekt_label) {
      const i = projektOpts.findIndex(p => p.label === entry.projekt_label);
      if (i > 0) currentIdx = i;
    }

    let selectContent = `<option value="0" ${currentIdx===0?'selected':''}>— Kein Projekt / Allgemein —</option>`;
    const auftragOpts = aktiveAuftraege.map((a, i) =>
      `<option value="${i+1}" ${currentIdx===i+1?'selected':''}>${a.nummer||''} – ${a.bezeichnung||''}</option>`).join('');
    const katOpts = kategorien.map((k, i) =>
      `<option value="${aktiveAuftraege.length+1+i}" ${currentIdx===aktiveAuftraege.length+1+i?'selected':''}>${k}</option>`).join('');
    if (auftragOpts) selectContent += `<optgroup label="Aktive Aufträge">${auftragOpts}</optgroup>`;
    if (katOpts) selectContent += `<optgroup label="Sonstige Bereiche">${katOpts}</optgroup>`;

    const startTime = entry.start_zeit ? new Date(entry.start_zeit).toTimeString().slice(0, 5) : '';
    const endTime = entry.end_zeit ? new Date(entry.end_zeit).toTimeString().slice(0, 5) : '';

    openModal('Eintrag bearbeiten', `
      <div class="form-group">
        <label class="form-label">Datum</label>
        <input type="date" class="form-input" id="edit-datum" value="${entry.datum}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group">
          <label class="form-label">Beginn</label>
          <input type="time" class="form-input" id="edit-start" value="${startTime}">
        </div>
        <div class="form-group">
          <label class="form-label">Ende</label>
          <input type="time" class="form-input" id="edit-end" value="${endTime}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Projekt / Bereich</label>
        <select class="form-select" id="edit-projekt">${selectContent}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Notiz</label>
        <input type="text" class="form-input" id="edit-notiz" value="${entry.notiz || ''}">
      </div>
    `, () => this._saveEditEntry(), 'Speichern');
  },

  async _saveEditEntry() {
    const datum = document.getElementById('edit-datum').value;
    const startStr = document.getElementById('edit-start').value;
    const endStr = document.getElementById('edit-end').value;
    const projektIdx = parseInt(document.getElementById('edit-projekt').value) || 0;
    const notiz = document.getElementById('edit-notiz').value.trim();

    if (!datum || !startStr) { showToast('Datum und Beginn sind Pflichtfelder', 'error'); return false; }

    const start_zeit = new Date(`${datum}T${startStr}:00`).toISOString();
    const end_zeit = endStr ? new Date(`${datum}T${endStr}:00`).toISOString() : null;
    let gesamt_minuten = 0;
    if (end_zeit) {
      gesamt_minuten = Math.max(0, Math.round((new Date(end_zeit) - new Date(start_zeit)) / 60000));
    }

    const opt = this._editProjektOpts?.[projektIdx] || { id: null, label: null };

    try {
      await DB.update('zeiterfassung', this._editEntryId, {
        datum, start_zeit, end_zeit, gesamt_minuten,
        projekt_id: opt.id || null,
        projekt_label: opt.label || null,
        notiz: notiz || null,
      });
      showToast('Eintrag aktualisiert', 'success');
      this._allEntries = await DB.getAll('zeiterfassung', { user_id: Auth.userId() });
      this.renderUserTab();
    } catch (e) { showToast('Fehler: ' + e.message, 'error'); }
  },

  /* ── Eintrag löschen ── */
  deleteEntry(id) {
    const entry = this._allEntries.find(e => e.id === id);
    if (!entry) return;
    confirmDelete(`Eintrag vom ${formatDate(entry.datum)} (${formatTime(entry.start_zeit)})`, async () => {
      try {
        await DB.delete('zeiterfassung', id);
        closeModal();
        showToast('Eintrag gelöscht', 'success');
        this._allEntries = await DB.getAll('zeiterfassung', { user_id: Auth.userId() });

        /* Wenn der gelöschte Eintrag von heute war und keine weiteren Einträge
           für heute existieren: State auf idle zurücksetzen → Timer zeigt 0 */
        const nochHeuteEintraege = this._allEntries.filter(e => e.datum === today());
        if (entry.datum === today() && nochHeuteEintraege.length === 0) {
          this._resetStateLS();
          this.updateWidget();
        }

        this.renderUserTab();
      } catch (e) {
        closeModal();
        showToast('Fehler: ' + e.message, 'error');
      }
    });
  },

  /* ── Eintrag manuell hinzufügen ── */
  async showAddEntryModal() {
    let auftraege = [], users = [];
    try { auftraege = await DB.getAll('auftraege'); } catch {}

    const aktiveAuftraege = auftraege.filter(a => a.workflow_status !== 'abgeschlossen');
    const kategorien = Settings.get().zeit_kategorien || [];

    this._addProjektOpts = [{ id: null, label: null }];
    aktiveAuftraege.forEach(a => this._addProjektOpts.push({ id: a.id, label: `${a.nummer || ''} – ${a.bezeichnung || ''}`.trim().replace(/^–\s*/, '') }));
    kategorien.forEach(k => this._addProjektOpts.push({ id: null, label: k }));

    let selectContent = `<option value="0">— Kein Projekt / Allgemein —</option>`;
    const auftragOpts = aktiveAuftraege.map((a, i) =>
      `<option value="${i+1}">${a.nummer||''} – ${a.bezeichnung||''}</option>`).join('');
    const katOpts = kategorien.map((k, i) =>
      `<option value="${aktiveAuftraege.length+1+i}">${k}</option>`).join('');
    if (auftragOpts) selectContent += `<optgroup label="Aktive Aufträge">${auftragOpts}</optgroup>`;
    if (katOpts) selectContent += `<optgroup label="Sonstige Bereiche">${katOpts}</optgroup>`;

    let userSelect = '';
    if (Auth.isAdmin()) {
      try { users = await DB.getAll('users'); } catch {}
      userSelect = `
      <div class="form-group">
        <label class="form-label">Mitarbeiter</label>
        <select class="form-select" id="add-user">
          ${users.map(u => `<option value="${u.id}" ${u.id === Auth.userId() ? 'selected' : ''}>${u.name}</option>`).join('')}
        </select>
      </div>`;
    }

    openModal('Eintrag manuell hinzufügen', `
      ${userSelect}
      <div class="form-group">
        <label class="form-label">Datum</label>
        <input type="date" class="form-input" id="add-datum" value="${today()}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group">
          <label class="form-label">Beginn</label>
          <input type="time" class="form-input" id="add-start">
        </div>
        <div class="form-group">
          <label class="form-label">Ende (optional)</label>
          <input type="time" class="form-input" id="add-end">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Projekt / Bereich</label>
        <select class="form-select" id="add-projekt">${selectContent}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Notiz (optional)</label>
        <input type="text" class="form-input" id="add-notiz" placeholder="z.B. Vergessen einzustempeln">
      </div>
    `, () => this._saveNewEntry(), 'Hinzufügen');
  },

  async _saveNewEntry() {
    const datum = document.getElementById('add-datum').value;
    const startStr = document.getElementById('add-start').value;
    const endStr = document.getElementById('add-end').value;
    const projektIdx = parseInt(document.getElementById('add-projekt').value) || 0;
    const notiz = document.getElementById('add-notiz').value.trim();
    const user_id = document.getElementById('add-user')?.value || Auth.userId();

    if (!datum || !startStr) { showToast('Datum und Beginn sind Pflichtfelder', 'error'); return false; }

    const start_zeit = new Date(`${datum}T${startStr}:00`).toISOString();
    const end_zeit = endStr ? new Date(`${datum}T${endStr}:00`).toISOString() : null;
    let gesamt_minuten = 0;
    if (end_zeit) {
      gesamt_minuten = Math.max(0, Math.round((new Date(end_zeit) - new Date(start_zeit)) / 60000));
    }

    const opt = this._addProjektOpts?.[projektIdx] || { id: null, label: null };

    try {
      await DB.insert('zeiterfassung', {
        user_id, datum, start_zeit, end_zeit, gesamt_minuten,
        projekt_id: opt.id || null,
        projekt_label: opt.label || null,
        notiz: notiz || null,
        sync_status: 'pending',
      });
      showToast('Eintrag hinzugefügt', 'success');
      this._allEntries = await DB.getAll('zeiterfassung', { user_id: Auth.userId() });
      this.renderUserTab();
    } catch (e) { showToast('Fehler: ' + e.message, 'error'); }
  },
};
