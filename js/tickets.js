const TicketsModule = {
  async render() {
    const userId = Auth.userId();
    const tickets = Auth.isAdmin() ? await DB.getAll('tickets') : await DB.getAll('tickets', { erstellt_von: userId });
    const users = await DB.getAll('users');
    const um = {}; users.forEach(u => um[u.id] = u);

    setContent(`
      <div class="module-header">
        <div class="module-title">Tickets & Feedback</div>
        <div class="module-actions"><button class="btn btn-primary btn-sm" onclick="TicketsModule.openForm()">+ Neues Ticket</button></div>
      </div>
      <div id="tickets-list">
        ${tickets.length ? tickets.map(t => `
          <div class="ticket-card prio-${t.prioritaet}" onclick="TicketsModule.openDetail('${t.id}')">
            <div class="ticket-header">
              <span class="ticket-title">${t.titel}</span>
              <div style="display:flex;gap:.4rem">${getStatusBadge(t.prioritaet)} ${getStatusBadge(t.status)}</div>
            </div>
            <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.4rem">${t.beschreibung?.substring(0,100)||''}</p>
            <div class="ticket-meta">
              <span>${um[t.erstellt_von]?.name||'—'}</span>
              <span>${formatDate(t.erstellt_am)}</span>
            </div>
          </div>`).join('') : '<div class="table-empty"><div class="table-empty-text">Keine Tickets vorhanden</div></div>'}
      </div>`);
  },

  async openDetail(id) {
    const t = await DB.getById('tickets', id);
    if (!t) return;
    const users = await DB.getAll('users');
    const um = {}; users.forEach(u => um[u.id] = u);
    openModal(`${t.titel}`, `
      <div style="margin-bottom:1rem">${getStatusBadge(t.prioritaet)} ${getStatusBadge(t.status)}</div>
      <p style="color:var(--text-muted);font-size:.82rem;margin-bottom:.5rem">Von: ${um[t.erstellt_von]?.name||'—'} • ${formatDate(t.erstellt_am)}</p>
      <div class="detail-field" style="margin-bottom:1rem"><div class="detail-field-label">Beschreibung</div><div class="detail-field-value" style="white-space:pre-line">${t.beschreibung||'—'}</div></div>
      ${t.admin_antwort ? `<div class="detail-field" style="border-left:3px solid var(--blue);margin-bottom:1rem"><div class="detail-field-label">Admin-Antwort</div><div class="detail-field-value">${t.admin_antwort}</div></div>` : ''}
      ${Auth.isAdmin() ? `
        <div class="form-group"><label class="form-label">Status ändern</label>
          <select class="form-select" id="t-status" onchange="TicketsModule.updateStatus('${id}',this.value)">
            ${['offen','in_bearbeitung','erledigt'].map(s => `<option value="${s}" ${t.status===s?'selected':''}>${s==='in_bearbeitung'?'In Bearbeitung':s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Antwort</label>
          <textarea class="form-textarea" id="t-antwort">${t.admin_antwort||''}</textarea></div>
        <button class="btn btn-primary btn-sm" onclick="TicketsModule.saveAnswer('${id}')">Antwort speichern</button>
      ` : ''}
    `);
  },

  async updateStatus(id, status) {
    await DB.update('tickets', id, { status });
    showToast('Status aktualisiert', 'success');
    updateBadges();
    closeModal();
    this.render();
  },

  async saveAnswer(id) {
    const antwort = document.getElementById('t-antwort').value.trim();
    const status = document.getElementById('t-status').value;
    await DB.update('tickets', id, { admin_antwort: antwort, status });
    closeModal(); showToast('Antwort gespeichert', 'success'); this.render();
  },

  async openForm() {
    openModal('Neues Ticket', `
      <div class="form-group"><label class="form-label">Titel<span class="required">*</span></label>
        <input class="form-input" id="t-titel" placeholder="Kurze Beschreibung des Problems/Wunsches" /></div>
      <div class="form-group"><label class="form-label">Beschreibung<span class="required">*</span></label>
        <textarea class="form-textarea" id="t-beschreibung" placeholder="Was soll verbessert werden? Was funktioniert nicht?"></textarea></div>
      <div class="form-group"><label class="form-label">Priorität</label>
        <select class="form-select" id="t-prio">
          <option value="niedrig">Niedrig – schön wenn es geht</option>
          <option value="normal" selected>Normal – würde helfen</option>
          <option value="hoch">Hoch – blockiert meine Arbeit</option>
        </select></div>
    `, async () => {
      const titel = document.getElementById('t-titel').value.trim();
      const beschreibung = document.getElementById('t-beschreibung').value.trim();
      if (!titel || !beschreibung) { showToast('Titel und Beschreibung sind Pflichtfelder', 'error'); return; }
      await DB.insert('tickets', { titel, beschreibung, prioritaet: document.getElementById('t-prio').value, status: 'offen', erstellt_von: Auth.userId() });
      closeModal(); showToast('Ticket erstellt — Danke für dein Feedback!', 'success'); this.render();
    }, 'Senden');
  },
};
