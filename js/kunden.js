/* ═══════════════════════════════════════════════════════
   KUNDEN — Kundenverwaltung mit Profilen & Statistiken
═══════════════════════════════════════════════════════ */

const KundenModule = {
  filter: '',
  view: 'table', // 'table' | 'cards'

  _avatarColor(str) {
    const colors = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444','#0891b2','#f97316','#65a30d','#db2777','#7c3aed'];
    let h = 0;
    for (const c of (str || 'X')) h = (h << 5) - h + c.charCodeAt(0);
    return colors[Math.abs(h) % colors.length];
  },

  _initials(name, firma) {
    const n = firma || name || '?';
    return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  },

  async render() {
    const kunden = await DB.getAll('kunden');
    const filtered = kunden.filter(k =>
      !this.filter || [k.name, k.firma, k.telefon, k.email, k.ort, k.ansprechpartner].some(f => (f||'').toLowerCase().includes(this.filter))
    );

    setContent(`
      <div class="module-header">
        <div>
          <div class="module-title">Kunden</div>
          <div class="module-subtitle">${kunden.length} Kunden insgesamt</div>
        </div>
        <div class="module-actions">
          <div class="view-toggle">
            <button class="view-toggle-btn ${this.view==='table'?'active':''}" onclick="KundenModule.view='table';KundenModule.render()">
              <i class="fa-solid fa-table-list"></i> Liste
            </button>
            <button class="view-toggle-btn ${this.view==='cards'?'active':''}" onclick="KundenModule.view='cards';KundenModule.render()">
              <i class="fa-solid fa-grip"></i> Karten
            </button>
          </div>
          <button class="btn btn-primary btn-sm" onclick="KundenModule.openForm()">
            <i class="fa-solid fa-plus"></i> Neuer Kunde
          </button>
        </div>
      </div>

      <!-- Suchzeile -->
      <div class="table-wrapper" style="${this.view==='cards'?'background:transparent;border:none;box-shadow:none;padding:0':''}">
        <div class="table-toolbar">
          <div class="table-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" placeholder="Name, Firma, Telefon, E-Mail…" value="${this.filter}"
              oninput="KundenModule.filter=this.value.toLowerCase();KundenModule.render()" />
          </div>
          <span class="table-count">${filtered.length} von ${kunden.length}</span>
        </div>

        ${this.view === 'table' ? this._renderTable(filtered) : this._renderCards(filtered)}
      </div>
    `);
  },

  _renderTable(filtered) {
    if (!filtered.length) return `
      <div class="table-empty">
        <div class="table-empty-icon"><i class="fa-regular fa-users"></i></div>
        <div class="table-empty-text">Keine Kunden gefunden</div>
        <div class="table-empty-sub">Passe den Suchbegriff an oder lege einen neuen Kunden an.</div>
      </div>`;

    return `
      <table>
        <thead><tr><th>Kunde</th><th>Ansprechpartner</th><th>Telefon</th><th>E-Mail</th><th>Ort</th><th></th></tr></thead>
        <tbody>
          ${filtered.map(k => {
            const color = this._avatarColor(k.firma || k.name);
            const initials = this._initials(k.name, k.firma);
            return `<tr onclick="KundenModule.openDetail('${k.id}')">
              <td>
                <div style="display:flex;align-items:center;gap:.75rem">
                  <div class="table-avatar" style="background:${color}">${initials}</div>
                  <div>
                    <div style="font-weight:600">${k.firma || k.name}</div>
                    ${k.firma && k.name ? `<div style="font-size:.75rem;color:var(--text-muted)">${k.name}</div>` : ''}
                  </div>
                </div>
              </td>
              <td>${k.ansprechpartner || '—'}</td>
              <td>${k.telefon ? `<a href="tel:${k.telefon}" onclick="event.stopPropagation()" style="color:var(--blue)">${k.telefon}</a>` : '—'}</td>
              <td>${k.email ? `<a href="mailto:${k.email}" onclick="event.stopPropagation()" style="color:var(--blue)">${k.email}</a>` : '—'}</td>
              <td>${k.ort || '—'}</td>
              <td onclick="event.stopPropagation()">
                <div class="table-actions">
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="KundenModule.openForm('${k.id}')" title="Bearbeiten">
                    <i class="fa-regular fa-pen-to-square"></i>
                  </button>
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="KundenModule.delete('${k.id}','${(k.firma||k.name).replace(/'/g,'\\\'')}')" title="Löschen">
                    <i class="fa-regular fa-trash-can"></i>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  },

  _renderCards(filtered) {
    if (!filtered.length) return `
      <div class="table-empty" style="border:none">
        <div class="table-empty-icon"><i class="fa-regular fa-users"></i></div>
        <div class="table-empty-text">Keine Kunden gefunden</div>
      </div>`;

    return `
      <div class="customer-grid">
        ${filtered.map(k => {
          const color = this._avatarColor(k.firma || k.name);
          const initials = this._initials(k.name, k.firma);
          return `
            <div class="customer-card" onclick="KundenModule.openDetail('${k.id}')">
              <div class="customer-card-top">
                <div class="customer-avatar" style="background:${color}">${initials}</div>
                <div class="customer-info">
                  <div class="customer-name">${k.firma || k.name}</div>
                  <div class="customer-sub">${k.firma && k.name ? k.name : (k.ort || '—')}</div>
                </div>
              </div>
              <div style="font-size:.8rem;color:var(--text-muted);display:flex;flex-direction:column;gap:.25rem">
                ${k.telefon ? `<div><i class="fa-solid fa-phone" style="width:14px;color:var(--text-light)"></i> ${k.telefon}</div>` : ''}
                ${k.email   ? `<div><i class="fa-solid fa-envelope" style="width:14px;color:var(--text-light)"></i> ${k.email}</div>` : ''}
                ${k.ort     ? `<div><i class="fa-solid fa-location-dot" style="width:14px;color:var(--text-light)"></i> ${k.ort}</div>` : ''}
              </div>
              <div style="display:flex;gap:.4rem;justify-content:flex-end" onclick="event.stopPropagation()">
                <button class="btn btn-secondary btn-sm" onclick="KundenModule.openForm('${k.id}')">Bearbeiten</button>
                <button class="btn btn-ghost btn-sm" onclick="KundenModule.openDetail('${k.id}')">Profil →</button>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },

  async openDetail(id) {
    const k = await DB.getById('kunden', id);
    if (!k) return;
    const [angebote, auftraege, rechnungen] = await Promise.all([
      DB.getAll('angebote', { kunde_id: id }),
      DB.getAll('auftraege', { kunde_id: id }),
      DB.getAll('rechnungen', { kunde_id: id }),
    ]);
    const color    = this._avatarColor(k.firma || k.name);
    const initials = this._initials(k.name, k.firma);
    const umsatz   = rechnungen.filter(r => r.status === 'bezahlt').reduce((s,r) => s+(r.gesamt_brutto||0), 0);

    openModal(k.firma || k.name, `
      <!-- Kundenkopf -->
      <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:var(--bg);border-radius:var(--radius-lg);margin-bottom:1.25rem;border:1px solid var(--card-border)">
        <div style="width:56px;height:56px;border-radius:14px;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.25rem;color:#fff;flex-shrink:0">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:1.1rem;font-weight:700;letter-spacing:-.02em">${k.firma || k.name}</div>
          ${k.firma && k.name ? `<div style="font-size:.855rem;color:var(--text-muted)">${k.name}</div>` : ''}
          ${k.ort ? `<div style="font-size:.8rem;color:var(--text-muted)"><i class="fa-solid fa-location-dot"></i> ${k.ort}</div>` : ''}
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <span class="badge badge-blue"><i class="fa-solid fa-file-lines"></i> ${angebote.length} Angebote</span>
          <span class="badge badge-orange"><i class="fa-solid fa-clipboard-list"></i> ${auftraege.length} Aufträge</span>
          <span class="badge badge-green"><i class="fa-solid fa-euro-sign"></i> ${formatCurrency(umsatz)}</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab(this,'k-tab-kontakt')">Kontakt</button>
        <button class="tab-btn" onclick="switchTab(this,'k-tab-verlauf')">Verlauf (${auftraege.length+angebote.length})</button>
        <button class="tab-btn" onclick="switchTab(this,'k-tab-rechnungen')">Rechnungen (${rechnungen.length})</button>
        ${k.notizen ? `<button class="tab-btn" onclick="switchTab(this,'k-tab-notizen')">Notizen</button>` : ''}
      </div>

      <!-- Tab: Kontakt -->
      <div class="tab-panel active" id="k-tab-kontakt">
        <div class="detail-grid">
          ${[['Name',k.name],['Firma',k.firma],['Ansprechpartner',k.ansprechpartner],['Telefon',k.telefon],['E-Mail',k.email],['Adresse',k.adresse ? `${k.adresse}, ${k.plz||''} ${k.ort||''}`.trim() : null]].filter(([,v])=>v).map(([l,v]) => `
            <div class="detail-field">
              <div class="detail-field-label">${l}</div>
              <div class="detail-field-value">${v}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Tab: Verlauf -->
      <div class="tab-panel" id="k-tab-verlauf">
        ${[...auftraege.map(a=>({type:'Auftrag',num:a.nummer,text:a.bezeichnung,status:a.workflow_status,date:a.startdatum,icon:'fa-clipboard-list',color:'#f59e0b'})),...angebote.map(a=>({type:'Angebot',num:a.nummer,text:'',status:a.status,date:a.datum,icon:'fa-file-lines',color:'#2563eb'}))].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(item => `
          <div style="display:flex;align-items:center;gap:.875rem;padding:.75rem 0;border-bottom:1px solid var(--card-border)">
            <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;background:${item.color}22;color:${item.color};flex-shrink:0">
              <i class="fa-solid ${item.icon}"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.855rem;font-weight:600">${item.type}: ${item.num || '—'} ${item.text ? `– ${item.text}` : ''}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${formatDate(item.date) || 'Kein Datum'}</div>
            </div>
            ${getStatusBadge(item.status)}
          </div>`).join('') || '<p style="color:var(--text-muted);font-size:.875rem;padding:1rem 0">Noch kein Verlauf</p>'}
      </div>

      <!-- Tab: Rechnungen -->
      <div class="tab-panel" id="k-tab-rechnungen">
        ${rechnungen.map(r => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 0;border-bottom:1px solid var(--card-border);gap:.75rem">
            <div>
              <div style="font-size:.875rem;font-weight:600">${r.nummer || '—'}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${formatDate(r.datum)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:.75rem">
              <span style="font-weight:700;font-size:.875rem">${formatCurrency(r.gesamt_brutto || 0)}</span>
              ${getStatusBadge(r.status)}
            </div>
          </div>`).join('') || '<p style="color:var(--text-muted);font-size:.875rem;padding:1rem 0">Keine Rechnungen</p>'}
      </div>

      ${k.notizen ? `
        <!-- Tab: Notizen -->
        <div class="tab-panel" id="k-tab-notizen">
          <div style="background:var(--bg);border-radius:var(--radius);padding:1rem;border:1px solid var(--card-border);white-space:pre-line;font-size:.875rem;line-height:1.7">${k.notizen}</div>
        </div>` : ''}

      <div style="display:flex;gap:.5rem;margin-top:1.25rem;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="closeModal();KundenModule.openForm('${id}')"><i class="fa-regular fa-pen-to-square"></i> Bearbeiten</button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal();navigateTo('auftraege')"><i class="fa-solid fa-clipboard-list"></i> Aufträge</button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal();navigateTo('rechnungen')"><i class="fa-solid fa-file-invoice-dollar"></i> Rechnungen</button>
        <button class="btn btn-danger btn-sm" style="margin-left:auto" onclick="closeModal();KundenModule.delete('${id}','${(k.firma||k.name).replace(/'/g,'\\\'')}')" title="Löschen">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    `, null, '', '700px');
  },

  async openForm(id = null) {
    const k = id ? await DB.getById('kunden', id) : {};
    openModal(id ? 'Kunde bearbeiten' : 'Neuer Kunde', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Name <span class="required">*</span></label>
          <input class="form-input" id="k-name" value="${k.name||''}" placeholder="Max Mustermann" /></div>
        <div class="form-group"><label class="form-label">Firma</label>
          <input class="form-input" id="k-firma" value="${k.firma||''}" placeholder="Muster GmbH" /></div>
      </div>
      <div class="form-group"><label class="form-label">Ansprechpartner</label>
        <input class="form-input" id="k-ansprechpartner" value="${k.ansprechpartner||''}" /></div>
      <div class="form-group"><label class="form-label">Straße & Hausnummer</label>
        <input class="form-input" id="k-adresse" value="${k.adresse||''}" placeholder="Musterstraße 1" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">PLZ</label>
          <input class="form-input" id="k-plz" value="${k.plz||''}" placeholder="12345" /></div>
        <div class="form-group"><label class="form-label">Ort</label>
          <input class="form-input" id="k-ort" value="${k.ort||''}" placeholder="Musterstadt" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Telefon</label>
          <input class="form-input" id="k-telefon" type="tel" value="${k.telefon||''}" /></div>
        <div class="form-group"><label class="form-label">E-Mail</label>
          <input class="form-input" id="k-email" type="email" value="${k.email||''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Notizen</label>
        <textarea class="form-textarea" id="k-notizen" placeholder="Interne Notizen zum Kunden…">${k.notizen||''}</textarea></div>
    `, async () => {
      const name = document.getElementById('k-name').value.trim();
      if (!name) { showToast('Name ist Pflichtfeld', 'error'); return; }
      const data = {
        name,
        firma:           document.getElementById('k-firma').value.trim(),
        ansprechpartner: document.getElementById('k-ansprechpartner').value.trim(),
        adresse:         document.getElementById('k-adresse').value.trim(),
        plz:             document.getElementById('k-plz').value.trim(),
        ort:             document.getElementById('k-ort').value.trim(),
        telefon:         document.getElementById('k-telefon').value.trim(),
        email:           document.getElementById('k-email').value.trim(),
        notizen:         document.getElementById('k-notizen').value.trim(),
      };
      if (id) await DB.update('kunden', id, data);
      else     await DB.insert('kunden', data);
      closeModal();
      showToast(id ? 'Kunde aktualisiert' : 'Kunde angelegt', 'success');
      this.render();
    }, id ? 'Speichern' : 'Anlegen');
  },

  async delete(id, name) {
    confirmDelete(name, async () => {
      await DB.delete('kunden', id);
      closeModal();
      showToast('Kunde gelöscht', 'success');
      this.render();
    });
  },
};

/* Tab-Switching Helper (global verfügbar) */
function switchTab(btn, targetId) {
  const container = btn.closest('.modal-body') || btn.closest('.main-content');
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = container.querySelector('#' + targetId);
  if (panel) panel.classList.add('active');
}
