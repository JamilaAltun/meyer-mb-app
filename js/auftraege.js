/* ═══════════════════════════════════════════════════════
   AUFTRÄGE — Auftragsverwaltung mit Workflow & Kanban
═══════════════════════════════════════════════════════ */

const WORKFLOW        = ['angebot','auftrag','fertigung','montage','rechnung','abgeschlossen'];
const WORKFLOW_LABELS = { angebot:'Angebot', auftrag:'Auftrag', fertigung:'Fertigung', montage:'Montage', rechnung:'Rechnung', abgeschlossen:'Abgeschlossen' };
const WORKFLOW_COLORS = { angebot:'badge-angebot', auftrag:'badge-auftrag', fertigung:'badge-fertigung', montage:'badge-montage', rechnung:'badge-rechnung', abgeschlossen:'badge-fertig' };
const KANBAN_DOT_COLORS = { angebot:'#2563eb', auftrag:'#f59e0b', fertigung:'#f97316', montage:'#8b5cf6', rechnung:'#3b82f6', abgeschlossen:'#10b981' };

const AuftraegeModule = {
  filterStatus: 'alle',
  filterText:   '',
  view:         'list', // 'list' | 'kanban'

  async render() {
    const [auftraege, kunden] = await Promise.all([DB.getAll('auftraege'), DB.getAll('kunden')]);
    const kundenMap = {};
    kunden.forEach(k => kundenMap[k.id] = k);

    let filtered = auftraege;
    if (this.filterStatus !== 'alle') filtered = filtered.filter(a => a.workflow_status === this.filterStatus);
    if (this.filterText)               filtered = filtered.filter(a =>
      [a.nummer, a.bezeichnung, kundenMap[a.kunde_id]?.name, kundenMap[a.kunde_id]?.firma].some(f => (f||'').toLowerCase().includes(this.filterText))
    );

    setContent(`
      <div class="module-header">
        <div>
          <div class="module-title">Aufträge</div>
          <div class="module-subtitle">${auftraege.length} gesamt · ${auftraege.filter(a=>a.workflow_status!=='abgeschlossen').length} aktiv</div>
        </div>
        <div class="module-actions">
          <div class="view-toggle">
            <button class="view-toggle-btn ${this.view==='list'?'active':''}" onclick="AuftraegeModule.view='list';AuftraegeModule.render()">
              <i class="fa-solid fa-table-list"></i> Liste
            </button>
            <button class="view-toggle-btn ${this.view==='kanban'?'active':''}" onclick="AuftraegeModule.view='kanban';AuftraegeModule.render()">
              <i class="fa-solid fa-columns"></i> Kanban
            </button>
          </div>
          <button class="btn btn-primary btn-sm" onclick="AuftraegeModule.openForm()">
            <i class="fa-solid fa-plus"></i> Neuer Auftrag
          </button>
        </div>
      </div>

      ${this.view === 'list' ? this._renderList(filtered, auftraege, kundenMap) : this._renderKanban(auftraege, kundenMap)}
    `);
  },

  _renderList(filtered, auftraege, kundenMap) {
    return `
      <div class="table-wrapper">
        <div class="table-toolbar">
          <div class="table-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" placeholder="Auftrag, Nummer, Kunde suchen…" value="${this.filterText}"
              oninput="AuftraegeModule.filterText=this.value.toLowerCase();AuftraegeModule.render()" />
          </div>
          <div class="filter-chips">
            ${['alle',...WORKFLOW].map(s => `
              <div class="chip${this.filterStatus===s?' active':''}" onclick="AuftraegeModule.filterStatus='${s}';AuftraegeModule.render()">
                ${s==='alle' ? `Alle (${auftraege.length})` : WORKFLOW_LABELS[s]}
              </div>`).join('')}
          </div>
          <span class="table-count">${filtered.length} Aufträge</span>
        </div>
        ${filtered.length ? `
          <table>
            <thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Kunde</th><th>Liefertermin</th><th>Status</th><th>Wert</th><th></th></tr></thead>
            <tbody>
              ${filtered.map(a => {
                const k = kundenMap[a.kunde_id];
                const isOverdue = a.fertigstellung && new Date(a.fertigstellung) < new Date() && a.workflow_status !== 'abgeschlossen';
                return `<tr onclick="AuftraegeModule.openDetail('${a.id}')">
                  <td><strong>${a.nummer || '—'}</strong></td>
                  <td>${a.bezeichnung || '—'}</td>
                  <td>
                    ${k ? `<div style="display:flex;align-items:center;gap:.5rem">
                      <div class="table-avatar" style="background:${this._avatarColor(k.firma||k.name)}">${this._initials(k.name,k.firma)}</div>
                      ${k.firma||k.name}
                    </div>` : '—'}
                  </td>
                  <td style="${isOverdue?'color:var(--red);font-weight:600':''}">${formatDate(a.fertigstellung) || '—'}</td>
                  <td>${getStatusBadge(a.workflow_status)}</td>
                  <td>${a.auftragswert ? `<strong>${formatCurrency(a.auftragswert)}</strong>` : '—'}</td>
                  <td onclick="event.stopPropagation()">
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-sm btn-icon" onclick="AuftraegeModule.openForm('${a.id}')" title="Bearbeiten">
                        <i class="fa-regular fa-pen-to-square"></i>
                      </button>
                      <button class="btn btn-ghost btn-sm btn-icon" onclick="AuftraegeModule.delete('${a.id}','${(a.nummer||'Auftrag').replace(/'/g,'\\\'')}')" title="Löschen">
                        <i class="fa-regular fa-trash-can"></i>
                      </button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>` : `
          <div class="table-empty">
            <div class="table-empty-icon"><i class="fa-regular fa-clipboard"></i></div>
            <div class="table-empty-text">Keine Aufträge gefunden</div>
            <div class="table-empty-sub">Passe den Filter an oder erstelle einen neuen Auftrag.</div>
          </div>`}
      </div>`;
  },

  _renderKanban(auftraege, kundenMap) {
    const today = new Date(); today.setHours(0,0,0,0);
    return `
      <div class="kanban-wrapper">
        <div class="kanban-board">
          ${WORKFLOW.map(status => {
            const cards = auftraege.filter(a => a.workflow_status === status);
            const totalValue = cards.reduce((s,a) => s+(a.auftragswert||0), 0);
            return `
              <div class="kanban-col">
                <div class="kanban-col-header">
                  <div class="kanban-col-dot ${status}"></div>
                  <div class="kanban-col-title">${WORKFLOW_LABELS[status]}</div>
                  <div class="kanban-col-count">${cards.length}</div>
                </div>
                <div class="kanban-cards">
                  ${cards.map(a => {
                    const k = kundenMap[a.kunde_id];
                    const isOverdue = a.fertigstellung && new Date(a.fertigstellung) < today && status !== 'abgeschlossen';
                    return `
                      <div class="kanban-card" onclick="AuftraegeModule.openDetail('${a.id}')">
                        <div class="kanban-card-num">${a.nummer || 'Auftrag'}</div>
                        <div class="kanban-card-title">${a.bezeichnung || '—'}</div>
                        ${k ? `<div class="kanban-card-sub">
                          <i class="fa-solid fa-user" style="font-size:.7rem;color:var(--text-light)"></i>
                          ${k.firma||k.name}
                        </div>` : ''}
                        <div class="kanban-card-footer">
                          <div class="kanban-card-value">${a.auftragswert ? formatCurrency(a.auftragswert) : ''}</div>
                          ${a.fertigstellung ? `
                            <div class="kanban-card-date ${isOverdue ? 'overdue' : ''}">
                              <i class="fa-regular fa-calendar"></i>
                              ${formatDate(a.fertigstellung)}
                            </div>` : ''}
                        </div>
                      </div>`;
                  }).join('')}
                  <button class="kanban-add-btn" onclick="AuftraegeModule._openFormWithStatus('${status}')">
                    <i class="fa-solid fa-plus"></i> Hinzufügen
                  </button>
                </div>
                ${totalValue > 0 ? `
                  <div style="padding:.625rem 1rem;border-top:1px solid var(--card-border);font-size:.78rem;font-weight:700;color:var(--text-muted);background:var(--card)">
                    ${formatCurrency(totalValue)}
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  _avatarColor(str) {
    const colors = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444','#0891b2','#f97316'];
    let h = 0;
    for (const c of (str || 'X')) h = (h << 5) - h + c.charCodeAt(0);
    return colors[Math.abs(h) % colors.length];
  },

  _initials(name, firma) {
    const n = firma || name || '?';
    return n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2);
  },

  async openDetail(id) {
    const a = await DB.getById('auftraege', id);
    if (!a) return;
    const [kunden, aufgaben] = await Promise.all([DB.getAll('kunden'), DB.getAll('aufgaben')]);
    const kundeObj = kunden.find(k => k.id === a.kunde_id);
    const auftragAufgaben = aufgaben.filter(t => t.auftrag_id === id || (t.beschreibung||'').includes(a.nummer||''));

    openModal(`Auftrag ${a.nummer || ''}`, `
      <!-- Workflow Bar -->
      <div class="workflow-bar" style="margin-bottom:1.25rem">
        ${WORKFLOW.map((s,i) => {
          const idx = WORKFLOW.indexOf(a.workflow_status);
          return `<div style="display:flex;align-items:center">
            <div class="wf-step ${i < idx?'done':''} ${s===a.workflow_status?'active':''}"
              onclick="AuftraegeModule.setStatus('${id}','${s}');closeModal();AuftraegeModule.render()">
              ${i < idx ? '<i class="fa-solid fa-check" style="font-size:.65rem"></i>' : ''}
              ${WORKFLOW_LABELS[s]}
            </div>
            ${i < WORKFLOW.length-1 ? '<span class="wf-arrow" style="margin:0 .2rem">›</span>' : ''}
          </div>`;
        }).join('')}
      </div>

      <!-- Felder -->
      <div class="detail-grid">
        ${[
          ['Auftragsnr.', a.nummer],
          ['Bezeichnung', a.bezeichnung],
          ['Kunde', kundeObj ? (kundeObj.firma||kundeObj.name) : null],
          ['Startdatum', formatDate(a.startdatum)],
          ['Liefertermin', formatDate(a.fertigstellung)],
          ['Auftragswert', a.auftragswert ? formatCurrency(a.auftragswert) : null],
          ['Baustelle', a.baustelle_adresse],
        ].filter(([,v])=>v).map(([l,v])=>`
          <div class="detail-field">
            <div class="detail-field-label">${l}</div>
            <div class="detail-field-value">${v}</div>
          </div>`).join('')}
      </div>

      ${a.notizen ? `<div class="detail-field" style="margin-bottom:1rem"><div class="detail-field-label">Notizen</div><div class="detail-field-value" style="white-space:pre-line;font-weight:400;line-height:1.6">${a.notizen}</div></div>` : ''}

      <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="closeModal();AuftraegeModule.openForm('${id}')">
          <i class="fa-regular fa-pen-to-square"></i> Bearbeiten
        </button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal();navigateTo('nachkalkulation')">
          <i class="fa-solid fa-chart-bar"></i> Kalkulation
        </button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal();navigateTo('rechnungen')">
          <i class="fa-solid fa-file-invoice-dollar"></i> Rechnung
        </button>
        <button class="btn btn-danger btn-sm" style="margin-left:auto" onclick="closeModal();AuftraegeModule.delete('${id}','${(a.nummer||'Auftrag').replace(/'/g,'\\\'')}')" >
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    `, null, '', '800px');
  },

  async setStatus(id, status) {
    await DB.update('auftraege', id, { workflow_status: status });
    showToast(`Status → "${WORKFLOW_LABELS[status]}"`, 'success');
  },

  async _openFormWithStatus(status) {
    await this.openForm(null, status);
  },

  async openForm(id = null, defaultStatus = null) {
    const a = id ? await DB.getById('auftraege', id) : {};
    const kunden = await DB.getAll('kunden');

    openModal(id ? 'Auftrag bearbeiten' : 'Neuer Auftrag', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Auftragsnummer <span class="required">*</span></label>
          <input class="form-input" id="a-nummer" value="${a.nummer || await this.nextNumber()}" /></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-select" id="a-status">
            ${WORKFLOW.map(s => `<option value="${s}" ${(a.workflow_status||defaultStatus||'auftrag')===s?'selected':''}>${WORKFLOW_LABELS[s]}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Bezeichnung <span class="required">*</span></label>
        <input class="form-input" id="a-bezeichnung" value="${a.bezeichnung||''}" placeholder="z.B. Stahltor Einfahrt" /></div>
      <div class="form-group"><label class="form-label">Kunde</label>
        <select class="form-select" id="a-kunde">
          <option value="">— Kein Kunde —</option>
          ${kunden.map(k => `<option value="${k.id}" ${a.kunde_id===k.id?'selected':''}>${k.firma||k.name}</option>`).join('')}
        </select></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Startdatum</label>
          <input class="form-input" type="date" id="a-start" value="${a.startdatum||''}" /></div>
        <div class="form-group"><label class="form-label">Liefertermin</label>
          <input class="form-input" type="date" id="a-termin" value="${a.fertigstellung||''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Auftragswert (€)</label>
        <input class="form-input" type="number" id="a-wert" value="${a.auftragswert||''}" placeholder="0,00" step="0.01" min="0" /></div>
      <div class="form-group"><label class="form-label">Baustelle / Adresse</label>
        <input class="form-input" id="a-baustelle" value="${a.baustelle_adresse||''}" placeholder="Musterstraße 1, 12345 Berlin" /></div>
      <div class="form-group"><label class="form-label">Notizen</label>
        <textarea class="form-textarea" id="a-notizen" placeholder="Interne Notizen…">${a.notizen||''}</textarea></div>
    `, async () => {
      const nummer     = document.getElementById('a-nummer').value.trim();
      const bezeichnung = document.getElementById('a-bezeichnung').value.trim();
      if (!nummer || !bezeichnung) { showToast('Nr. und Bezeichnung sind Pflichtfelder', 'error'); return; }
      const data = {
        nummer, bezeichnung,
        workflow_status:    document.getElementById('a-status').value,
        kunde_id:           document.getElementById('a-kunde').value || null,
        startdatum:         document.getElementById('a-start').value || null,
        fertigstellung:     document.getElementById('a-termin').value || null,
        auftragswert:       parseFloat(document.getElementById('a-wert').value) || null,
        baustelle_adresse:  document.getElementById('a-baustelle').value.trim(),
        notizen:            document.getElementById('a-notizen').value.trim(),
        erstellt_von:       Auth.userId(),
      };
      if (id) await DB.update('auftraege', id, data);
      else    await DB.insert('auftraege', data);
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
