/* ═══════════════════════════════════════════════════════
   AUFTRÄGE — Auftragsverwaltung mit Workflow
═══════════════════════════════════════════════════════ */

const WORKFLOW = ['angebot','auftrag','fertigung','montage','rechnung','abgeschlossen'];
const WORKFLOW_LABELS = { angebot:'Angebot', auftrag:'Auftrag', fertigung:'Fertigung', montage:'Montage', rechnung:'Rechnung', abgeschlossen:'Abgeschlossen' };
const WORKFLOW_COLORS = { angebot:'badge-angebot', auftrag:'badge-auftrag', fertigung:'badge-fertigung', montage:'badge-montage', rechnung:'badge-rechnung', abgeschlossen:'badge-fertig' };

const AuftraegeModule = {
  filterStatus: 'alle',
  filterText: '',

  async render() {
    const auftraege = await DB.getAll('auftraege');
    const kunden = await DB.getAll('kunden');
    const kundenMap = {};
    kunden.forEach(k => kundenMap[k.id] = k);

    let filtered = auftraege;
    if (this.filterStatus !== 'alle') filtered = filtered.filter(a => a.workflow_status === this.filterStatus);
    if (this.filterText) filtered = filtered.filter(a =>
      [a.nummer, a.bezeichnung, kundenMap[a.kunde_id]?.name, kundenMap[a.kunde_id]?.firma].some(f => (f||'').toLowerCase().includes(this.filterText))
    );

    setContent(`
      <div class="module-header">
        <div class="module-title">Aufträge</div>
        <div class="module-actions">
          <button class="btn btn-primary btn-sm" onclick="AuftraegeModule.openForm()">+ Neuer Auftrag</button>
        </div>
      </div>
      <div class="table-wrapper">
        <div class="table-toolbar">
          <div class="table-search">🔍 <input type="text" placeholder="Auftrag suchen..." value="${this.filterText}"
            oninput="AuftraegeModule.filterText=this.value.toLowerCase();AuftraegeModule.render()" /></div>
          <div class="filter-chips">
            ${['alle',...WORKFLOW].map(s => `<div class="chip${this.filterStatus===s?' active':''}" onclick="AuftraegeModule.filterStatus='${s}';AuftraegeModule.render()">${s==='alle'?'Alle':WORKFLOW_LABELS[s]}</div>`).join('')}
          </div>
        </div>
        <table>
          <thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Kunde</th><th>Liefertermin</th><th>Status</th><th>Wert</th><th></th></tr></thead>
          <tbody>
            ${filtered.length ? filtered.map(a => {
              const k = kundenMap[a.kunde_id];
              return `<tr onclick="AuftraegeModule.openDetail('${a.id}')">
                <td><strong>${a.nummer || '—'}</strong></td>
                <td>${a.bezeichnung || '—'}</td>
                <td>${k ? (k.firma || k.name) : '—'}</td>
                <td>${formatDate(a.fertigstellung)}</td>
                <td>${getStatusBadge(a.workflow_status)}</td>
                <td>${a.auftragswert ? formatCurrency(a.auftragswert) : '—'}</td>
                <td onclick="event.stopPropagation()">
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="AuftraegeModule.openForm('${a.id}')" title="Bearbeiten">✏️</button>
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="AuftraegeModule.delete('${a.id}','${(a.nummer||'Auftrag').replace(/'/g,'')}')" title="Löschen">🗑️</button>
                  </div>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="7"><div class="table-empty"><div class="table-empty-icon">📋</div><div class="table-empty-text">Keine Aufträge gefunden</div></div></td></tr>`}
          </tbody>
        </table>
      </div>
    `);
  },

  async openDetail(id) {
    const a = await DB.getById('auftraege', id);
    if (!a) return;
    const kunden = await DB.getAll('kunden');
    const kundeObj = kunden.find(k => k.id === a.kunde_id);

    openModal(`📋 Auftrag ${a.nummer || ''}`, `
      <!-- Workflow Bar -->
      <div class="workflow-bar" style="margin-bottom:1rem;overflow-x:auto">
        ${WORKFLOW.map((s,i) => {
          const idx = WORKFLOW.indexOf(a.workflow_status);
          const done = i < idx;
          const active = s === a.workflow_status;
          return `<div style="display:flex;align-items:center">
            <div class="wf-step ${done?'done':''} ${active?'active':''}" onclick="AuftraegeModule.setStatus('${id}','${s}');closeModal();AuftraegeModule.render()">
              ${done?'✓ ':''}${WORKFLOW_LABELS[s]}
            </div>
            ${i < WORKFLOW.length-1 ? '<span class="wf-arrow" style="margin:0 .25rem">›</span>' : ''}
          </div>`;
        }).join('')}
      </div>

      <div class="detail-grid">
        ${[['Auftragsnr.', a.nummer],['Bezeichnung', a.bezeichnung],['Kunde', kundeObj ? (kundeObj.firma||kundeObj.name) : '—'],['Start', formatDate(a.startdatum)],['Liefertermin', formatDate(a.fertigstellung)],['Auftragswert', a.auftragswert ? formatCurrency(a.auftragswert) : '—'],['Baustelle', a.baustelle_adresse],['Notizen', a.notizen]].filter(([,v])=>v).map(([l,v])=>`<div class="detail-field"><div class="detail-field-label">${l}</div><div class="detail-field-value">${v}</div></div>`).join('')}
      </div>

      <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="closeModal();AuftraegeModule.openForm('${id}')">✏️ Bearbeiten</button>
        <button class="btn btn-blue btn-sm" onclick="closeModal();navigateTo('nachkalkulation')">📊 Kalkulation</button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal();navigateTo('rechnungen')">🧾 Rechnung</button>
      </div>
    `, null, '', '800px');
  },

  async setStatus(id, status) {
    await DB.update('auftraege', id, { workflow_status: status });
    showToast(`Status auf "${WORKFLOW_LABELS[status]}" gesetzt`, 'success');
  },

  async openForm(id = null) {
    const a = id ? await DB.getById('auftraege', id) : {};
    const kunden = await DB.getAll('kunden');

    openModal(id ? 'Auftrag bearbeiten' : 'Neuer Auftrag', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Auftragsnummer<span class="required">*</span></label>
          <input class="form-input" id="a-nummer" value="${a.nummer || await this.nextNumber()}" /></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-select" id="a-status">
            ${WORKFLOW.map(s => `<option value="${s}" ${(a.workflow_status||'auftrag')===s?'selected':''}>${WORKFLOW_LABELS[s]}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Bezeichnung<span class="required">*</span></label>
        <input class="form-input" id="a-bezeichnung" value="${a.bezeichnung || ''}" /></div>
      <div class="form-group"><label class="form-label">Kunde</label>
        <select class="form-select" id="a-kunde">
          <option value="">— Kein Kunde —</option>
          ${kunden.map(k => `<option value="${k.id}" ${a.kunde_id===k.id?'selected':''}>${k.firma||k.name}</option>`).join('')}
        </select></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Startdatum</label>
          <input class="form-input" type="date" id="a-start" value="${a.startdatum || ''}" /></div>
        <div class="form-group"><label class="form-label">Liefertermin</label>
          <input class="form-input" type="date" id="a-termin" value="${a.fertigstellung || ''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Auftragswert (€)</label>
        <input class="form-input" type="number" id="a-wert" value="${a.auftragswert || ''}" placeholder="0.00" /></div>
      <div class="form-group"><label class="form-label">Baustelle Adresse</label>
        <input class="form-input" id="a-baustelle" value="${a.baustelle_adresse || ''}" /></div>
      <div class="form-group"><label class="form-label">Notizen</label>
        <textarea class="form-textarea" id="a-notizen">${a.notizen || ''}</textarea></div>
    `, async () => {
      const nummer = document.getElementById('a-nummer').value.trim();
      const bezeichnung = document.getElementById('a-bezeichnung').value.trim();
      if (!nummer || !bezeichnung) { showToast('Nr. und Bezeichnung sind Pflichtfelder', 'error'); return; }
      const data = {
        nummer, bezeichnung,
        workflow_status: document.getElementById('a-status').value,
        kunde_id: document.getElementById('a-kunde').value || null,
        startdatum: document.getElementById('a-start').value || null,
        fertigstellung: document.getElementById('a-termin').value || null,
        auftragswert: parseFloat(document.getElementById('a-wert').value) || null,
        baustelle_adresse: document.getElementById('a-baustelle').value.trim(),
        notizen: document.getElementById('a-notizen').value.trim(),
        erstellt_von: Auth.userId(),
      };
      if (id) await DB.update('auftraege', id, data);
      else await DB.insert('auftraege', data);
      closeModal();
      showToast(id ? 'Auftrag aktualisiert' : 'Auftrag angelegt', 'success');
      this.render();
    }, id ? 'Speichern' : 'Anlegen', '700px');
  },

  async nextNumber() {
    const all = await DB.getAll('auftraege');
    const settings = Settings.get();
    const n = (settings.auftrag_startnummer || 1) + all.length;
    return `AU-${new Date().getFullYear()}-${String(n).padStart(3,'0')}`;
  },

  async delete(id, name) {
    confirmDelete(name, async () => {
      await DB.delete('auftraege', id);
      closeModal();
      showToast('Auftrag gelöscht', 'success');
      this.render();
    });
  },
};
