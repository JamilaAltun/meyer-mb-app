/* ═══════════════════════════════════════════════════════
   ANFRAGEN & ANGEBOTE — mit Positionsvorlagen
═══════════════════════════════════════════════════════ */

const AnfragenModule = {
  activeTab: 'angebote',
  positions: [],

  async render() {
    setContent(`
      <div class="module-header">
        <div class="module-title">Anfragen & Angebote</div>
        <div class="module-actions">
          <button class="btn btn-primary btn-sm" id="anfragen-new-btn">+ Neu</button>
        </div>
      </div>
      <div class="tabs">
        <div class="tab-btn ${this.activeTab==='angebote'?'active':''}" onclick="AnfragenModule.activeTab='angebote';AnfragenModule.renderTab()">📄 Angebote</div>
        <div class="tab-btn ${this.activeTab==='anfragen'?'active':''}" onclick="AnfragenModule.activeTab='anfragen';AnfragenModule.renderTab()">📨 Anfragen</div>
        <div class="tab-btn ${this.activeTab==='vorlagen'?'active':''}" onclick="AnfragenModule.activeTab='vorlagen';AnfragenModule.renderTab()">📚 Positionsvorlagen</div>
      </div>
      <div id="anfragen-tab-content"></div>
    `);
    document.getElementById('anfragen-new-btn').onclick = () => {
      if (this.activeTab === 'anfragen') this.openAnfrageForm();
      else if (this.activeTab === 'angebote') this.openAngebotForm();
      else this.openVorlageForm();
    };
    this.renderTab();
  },

  async renderTab() {
    const container = document.getElementById('anfragen-tab-content');
    if (!container) return;
    document.querySelectorAll('.tab-btn').forEach((b,i) => {
      const tabs = ['angebote','anfragen','vorlagen'];
      b.classList.toggle('active', tabs[i] === this.activeTab);
    });
    if (this.activeTab === 'angebote') container.innerHTML = await this.buildAngeboteHtml();
    else if (this.activeTab === 'anfragen') container.innerHTML = await this.buildAnfragenHtml();
    else container.innerHTML = await this.buildVorlagenHtml();
  },

  async buildAngeboteHtml() {
    const angebote = await DB.getAll('angebote');
    const kunden = await DB.getAll('kunden');
    const km = {}; kunden.forEach(k => km[k.id] = k);
    return `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Nummer</th><th>Kunde</th><th>Datum</th><th>Gültig bis</th><th>Betrag</th><th>Status</th><th></th></tr></thead>
          <tbody>${angebote.length ? angebote.map(a => `
            <tr onclick="AnfragenModule.openAngebotDetail('${a.id}')">
              <td><strong>${a.nummer||'—'}</strong></td>
              <td>${km[a.kunde_id] ? (km[a.kunde_id].firma||km[a.kunde_id].name) : '—'}</td>
              <td>${formatDate(a.datum)}</td>
              <td>${formatDate(a.gueltig_bis)}</td>
              <td>${a.gesamt_brutto ? formatCurrency(a.gesamt_brutto) : '—'}</td>
              <td>${getStatusBadge(a.status)}</td>
              <td onclick="event.stopPropagation()">
                <div class="table-actions">
                  <button class="btn btn-blue btn-sm" onclick="AnfragenModule.generatePdf('${a.id}')" title="PDF">📄</button>
                  <button class="btn btn-success btn-sm" onclick="AnfragenModule.zuAuftrag('${a.id}')" title="→ Auftrag">→</button>
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="AnfragenModule.openAngebotForm('${a.id}')">✏️</button>
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="AnfragenModule.deleteAngebot('${a.id}','${(a.nummer||'Angebot').replace(/'/g,'')}')">🗑️</button>
                </div>
              </td>
            </tr>`).join('') : '<tr><td colspan="7"><div class="table-empty"><div class="table-empty-icon">📄</div><div class="table-empty-text">Noch keine Angebote</div></div></td></tr>'}
          </tbody>
        </table>
      </div>`;
  },

  async buildAnfragenHtml() {
    const anfragen = await DB.getAll('anfragen');
    const kunden = await DB.getAll('kunden');
    const km = {}; kunden.forEach(k => km[k.id] = k);
    return `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Datum</th><th>Kunde</th><th>Beschreibung</th><th>Status</th><th></th></tr></thead>
          <tbody>${anfragen.length ? anfragen.map(a => `
            <tr>
              <td>${formatDate(a.datum)}</td>
              <td>${km[a.kunde_id] ? (km[a.kunde_id].firma||km[a.kunde_id].name) : '—'}</td>
              <td>${a.beschreibung || '—'}</td>
              <td>${getStatusBadge(a.status)}</td>
              <td onclick="event.stopPropagation()">
                <div class="table-actions">
                  <button class="btn btn-primary btn-sm" onclick="AnfragenModule.anfrageZuAngebot('${a.id}')">→ Angebot</button>
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="AnfragenModule.deleteAnfrage('${a.id}','Anfrage')">🗑️</button>
                </div>
              </td>
            </tr>`).join('') : '<tr><td colspan="5"><div class="table-empty"><div class="table-empty-icon">📨</div><div class="table-empty-text">Noch keine Anfragen</div></div></td></tr>'}
          </tbody>
        </table>
      </div>`;
  },

  async buildVorlagenHtml() {
    const vorlagen = await DB.getAll('positionen_vorlagen');
    return `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Bezeichnung</th><th>Kategorie</th><th>Einheit</th><th>Standardpreis</th><th></th></tr></thead>
          <tbody>${vorlagen.length ? vorlagen.map(v => `
            <tr>
              <td><strong>${v.bezeichnung}</strong></td>
              <td>${v.kategorie||'—'}</td>
              <td>${v.einheit||'Stk'}</td>
              <td>${v.standardpreis ? formatCurrency(v.standardpreis) : '—'}</td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="AnfragenModule.openVorlageForm('${v.id}')">✏️</button>
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="AnfragenModule.deleteVorlage('${v.id}','${v.bezeichnung.replace(/'/g,'')}')">🗑️</button>
                </div>
              </td>
            </tr>`).join('') : '<tr><td colspan="5"><div class="table-empty"><div class="table-empty-icon">📚</div><div class="table-empty-text">Noch keine Vorlagen</div></div></td></tr>'}
          </tbody>
        </table>
      </div>`;
  },

  /* ── Angebot-Formular mit Positionen ── */
  async openAngebotForm(id = null) {
    const a = id ? await DB.getById('angebote', id) : {};
    const kunden = await DB.getAll('kunden');
    const vorlagen = await DB.getAll('positionen_vorlagen');
    this.positions = a.positionen || [{ id: generateId(), bezeichnung:'', menge:1, einheit:'Stk', einzelpreis:0 }];

    const nextNr = await this.nextAngebotNummer();
    openModal(id ? 'Angebot bearbeiten' : 'Neues Angebot', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Angebotsnummer<span class="required">*</span></label>
          <input class="form-input" id="ang-nummer" value="${a.nummer || nextNr}" /></div>
        <div class="form-group"><label class="form-label">Datum</label>
          <input class="form-input" type="date" id="ang-datum" value="${a.datum || today()}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Kunde</label>
          <select class="form-select" id="ang-kunde">
            <option value="">— Kein Kunde —</option>
            ${kunden.map(k => `<option value="${k.id}" ${a.kunde_id===k.id?'selected':''}>${k.firma||k.name}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Gültig bis</label>
          <input class="form-input" type="date" id="ang-gueltig" value="${a.gueltig_bis || ''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">MwSt.</label>
          <select class="form-select" id="ang-mwst">
            <option value="19" ${(a.mwst_satz||19)===19?'selected':''}>19%</option>
            <option value="7" ${a.mwst_satz===7?'selected':''}>7%</option>
            <option value="0" ${a.mwst_satz===0?'selected':''}>0% (netto)</option>
          </select></div>
        <div class="form-group"><label class="form-label">Nachfassen am</label>
          <input class="form-input" type="date" id="ang-erinnerung" value="${a.erinnerung_am || ''}" /></div>
      </div>

      <!-- Positionen -->
      <div style="margin-bottom:.5rem;display:flex;align-items:center;justify-content:space-between">
        <label class="form-label" style="margin:0">Positionen</label>
        <div style="display:flex;gap:.4rem">
          <select id="vorlage-select" class="form-select" style="max-width:200px;font-size:.8rem">
            <option value="">+ Vorlage wählen</option>
            ${vorlagen.map(v => `<option value="${v.id}">${v.bezeichnung}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="AnfragenModule.addVorlage()" type="button">Hinzufügen</button>
          <button class="btn btn-blue btn-sm" onclick="AnfragenModule.addPosition()" type="button">+ Leer</button>
        </div>
      </div>

      <div class="positions-table-wrapper" id="pos-wrapper">
        ${this.renderPositionenTable(vorlagen)}
      </div>
      <div class="positions-total" id="pos-total">${this.renderTotals()}</div>

      <div class="form-group" style="margin-top:1rem"><label class="form-label">Notizen</label>
        <textarea class="form-textarea" id="ang-notizen">${a.notizen || ''}</textarea></div>
      <div class="form-group">
        <label class="form-label">
          <input type="checkbox" id="ang-briefpapier" ${a.briefpapier_modus?'checked':''} />
          Briefpapier-Modus (Rand für vorhandenes Briefpapier lassen)
        </label>
      </div>
    `, async () => {
      const nummer = document.getElementById('ang-nummer').value.trim();
      if (!nummer) { showToast('Angebotsnummer ist Pflichtfeld', 'error'); return; }
      this.collectPositions();
      const totals = this.calcTotals();
      const data = {
        nummer, datum: document.getElementById('ang-datum').value,
        gueltig_bis: document.getElementById('ang-gueltig').value || null,
        kunde_id: document.getElementById('ang-kunde').value || null,
        mwst_satz: parseInt(document.getElementById('ang-mwst').value),
        erinnerung_am: document.getElementById('ang-erinnerung').value || null,
        positionen: this.positions,
        gesamt_netto: totals.netto, gesamt_brutto: totals.brutto,
        notizen: document.getElementById('ang-notizen').value.trim(),
        briefpapier_modus: document.getElementById('ang-briefpapier').checked,
        status: a.status || 'entwurf',
        erstellt_von: Auth.userId(),
      };
      if (id) await DB.update('angebote', id, data);
      else await DB.insert('angebote', data);
      closeModal();
      showToast(id ? 'Angebot gespeichert' : 'Angebot erstellt', 'success');
      this.activeTab = 'angebote';
      this.render();
    }, id ? 'Speichern' : 'Erstellen', '800px');
  },

  renderPositionenTable(vorlagen = []) {
    if (!this.positions.length) return '<p style="color:var(--text-muted);padding:.5rem">Keine Positionen</p>';
    return `<table class="positions-table">
      <thead><tr><th>Pos.</th><th>Bezeichnung</th><th>Menge</th><th>Einheit</th><th>Einzelpreis</th><th>Gesamt</th><th></th></tr></thead>
      <tbody id="pos-body">
        ${this.positions.map((p,i) => this.renderPositionRow(p, i)).join('')}
      </tbody>
    </table>`;
  },

  renderPositionRow(p, i) {
    return `<tr id="pos-row-${p.id}">
      <td style="color:var(--text-muted);font-size:.8rem">${i+1}</td>
      <td><input value="${p.bezeichnung||''}" placeholder="Beschreibung..." onchange="AnfragenModule.positions[${i}].bezeichnung=this.value" style="width:100%;border:1px solid transparent;padding:.25rem .4rem;border-radius:4px;background:transparent;font-size:.85rem;color:var(--text)" onfocus="this.style.borderColor='var(--blue)';this.style.background='var(--card)'" onblur="this.style.borderColor='transparent';this.style.background='transparent'" /></td>
      <td><input type="number" value="${p.menge||1}" min="0" step="0.01" oninput="AnfragenModule.positions[${i}].menge=+this.value;AnfragenModule.updateTotals()" style="width:70px;border:1px solid transparent;padding:.25rem .4rem;border-radius:4px;background:transparent;font-size:.85rem;color:var(--text)" onfocus="this.style.borderColor='var(--blue)';this.style.background='var(--card)'" onblur="this.style.borderColor='transparent';this.style.background='transparent'" /></td>
      <td><select onchange="AnfragenModule.positions[${i}].einheit=this.value" style="border:1px solid transparent;padding:.25rem .3rem;border-radius:4px;background:transparent;font-size:.82rem;color:var(--text)">
        ${['Stk','m','m²','m³','kg','t','h','pauschal'].map(e => `<option ${(p.einheit||'Stk')===e?'selected':''}>${e}</option>`).join('')}
      </select></td>
      <td><input type="number" value="${p.einzelpreis||0}" min="0" step="0.01" oninput="AnfragenModule.positions[${i}].einzelpreis=+this.value;AnfragenModule.updateTotals()" style="width:90px;border:1px solid transparent;padding:.25rem .4rem;border-radius:4px;background:transparent;font-size:.85rem;color:var(--text)" onfocus="this.style.borderColor='var(--blue)';this.style.background='var(--card)'" onblur="this.style.borderColor='transparent';this.style.background='transparent'" /></td>
      <td id="pos-total-${p.id}" style="font-weight:600;font-size:.85rem">${formatCurrency((p.menge||1)*(p.einzelpreis||0))}</td>
      <td><button class="btn btn-ghost btn-sm btn-icon" onclick="AnfragenModule.removePosition(${i})" style="color:var(--red)" type="button">✕</button></td>
    </tr>`;
  },

  addPosition() {
    this.positions.push({ id: generateId(), bezeichnung:'', menge:1, einheit:'Stk', einzelpreis:0 });
    this.refreshPositionenTable();
  },

  async addVorlage() {
    const sel = document.getElementById('vorlage-select');
    if (!sel.value) return;
    const v = await DB.getById('positionen_vorlagen', sel.value);
    if (!v) return;
    this.positions.push({ id: generateId(), bezeichnung: v.bezeichnung, menge:1, einheit: v.einheit||'Stk', einzelpreis: v.standardpreis||0 });
    this.refreshPositionenTable();
    sel.value = '';
  },

  removePosition(i) {
    this.positions.splice(i, 1);
    this.refreshPositionenTable();
  },

  collectPositions() {
    /* Werte aus DOM sammeln (inputs können geändert worden sein) */
    this.positions = this.positions.map((p,i) => {
      const row = document.getElementById(`pos-row-${p.id}`);
      if (!row) return p;
      const inputs = row.querySelectorAll('input,select');
      return { ...p,
        bezeichnung: inputs[0]?.value || p.bezeichnung,
        menge: parseFloat(inputs[1]?.value) || p.menge,
        einheit: inputs[2]?.value || p.einheit,
        einzelpreis: parseFloat(inputs[3]?.value) || p.einzelpreis,
      };
    });
  },

  refreshPositionenTable() {
    const wrapper = document.getElementById('pos-wrapper');
    if (wrapper) wrapper.innerHTML = this.renderPositionenTable();
    this.updateTotals();
  },

  updateTotals() {
    const total = document.getElementById('pos-total');
    if (total) total.innerHTML = this.renderTotals();
    /* Zeilengesamtbeträge */
    this.positions.forEach(p => {
      const el = document.getElementById(`pos-total-${p.id}`);
      if (el) el.textContent = formatCurrency((p.menge||1)*(p.einzelpreis||0));
    });
  },

  calcTotals() {
    const netto = this.positions.reduce((s,p) => s + (p.menge||1)*(p.einzelpreis||0), 0);
    const mwst = parseInt(document.getElementById('ang-mwst')?.value || '19');
    const steuer = netto * mwst / 100;
    return { netto, steuer, brutto: netto + steuer, mwst };
  },

  renderTotals() {
    const t = this.calcTotals();
    return `
      <div class="positions-total-row"><span>Nettobetrag:</span><span>${formatCurrency(t.netto)}</span></div>
      <div class="positions-total-row"><span>MwSt. ${t.mwst}%:</span><span>${formatCurrency(t.steuer)}</span></div>
      <div class="positions-total-row total"><span>Gesamtbetrag:</span><span>${formatCurrency(t.brutto)}</span></div>`;
  },

  async nextAngebotNummer() {
    const all = await DB.getAll('angebote');
    const s = Settings.get();
    const n = (s.angebot_startnummer || 1) + all.length;
    return `A-${new Date().getFullYear()}-${String(n).padStart(3,'0')}`;
  },

  async openAngebotDetail(id) {
    const a = await DB.getById('angebote', id);
    if (!a) return;
    const kunden = await DB.getAll('kunden');
    const k = kunden.find(k => k.id === a.kunde_id);
    openModal(`📄 Angebot ${a.nummer}`, `
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-field-label">Nummer</div><div class="detail-field-value">${a.nummer}</div></div>
        <div class="detail-field"><div class="detail-field-label">Kunde</div><div class="detail-field-value">${k ? (k.firma||k.name) : '—'}</div></div>
        <div class="detail-field"><div class="detail-field-label">Datum</div><div class="detail-field-value">${formatDate(a.datum)}</div></div>
        <div class="detail-field"><div class="detail-field-label">Gültig bis</div><div class="detail-field-value">${formatDate(a.gueltig_bis)}</div></div>
        <div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-value">${getStatusBadge(a.status)}</div></div>
        <div class="detail-field"><div class="detail-field-label">Betrag</div><div class="detail-field-value" style="font-weight:800;color:var(--navy)">${formatCurrency(a.gesamt_brutto)}</div></div>
      </div>
      <div class="positions-table-wrapper">
        <table class="positions-table">
          <thead><tr><th>Pos.</th><th>Bezeichnung</th><th>Menge</th><th>Einheit</th><th>EP</th><th>GP</th></tr></thead>
          <tbody>${(a.positionen||[]).map((p,i) => `<tr><td>${i+1}</td><td>${p.bezeichnung}</td><td>${p.menge}</td><td>${p.einheit}</td><td>${formatCurrency(p.einzelpreis)}</td><td>${formatCurrency((p.menge||1)*p.einzelpreis)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="positions-total">
        <div class="positions-total-row"><span>Netto:</span><span>${formatCurrency(a.gesamt_netto)}</span></div>
        <div class="positions-total-row"><span>MwSt. ${a.mwst_satz}%:</span><span>${formatCurrency((a.gesamt_brutto||0)-(a.gesamt_netto||0))}</span></div>
        <div class="positions-total-row total"><span>Gesamt:</span><span>${formatCurrency(a.gesamt_brutto)}</span></div>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
        <button class="btn btn-blue btn-sm" onclick="closeModal();AnfragenModule.generatePdf('${id}')">📄 PDF</button>
        <button class="btn btn-success btn-sm" onclick="closeModal();AnfragenModule.zuAuftrag('${id}')">→ Zu Auftrag</button>
        <select class="form-select" style="font-size:.8rem;padding:.35rem .6rem" onchange="AnfragenModule.updateStatus('${id}',this.value)">
          ${['entwurf','gesendet','angenommen','abgelehnt'].map(s => `<option value="${s}" ${a.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select>
      </div>
    `, null, '', '750px');
  },

  async updateStatus(id, status) {
    await DB.update('angebote', id, { status });
    showToast('Status aktualisiert', 'success');
    closeModal();
    this.render();
  },

  async zuAuftrag(angebotId) {
    const a = await DB.getById('angebote', angebotId);
    if (!a) return;
    const all = await DB.getAll('auftraege');
    const s = Settings.get();
    const n = (s.auftrag_startnummer || 1) + all.length;
    const nummer = `AU-${new Date().getFullYear()}-${String(n).padStart(3,'0')}`;
    await DB.insert('auftraege', {
      nummer, angebot_id: angebotId, kunde_id: a.kunde_id,
      bezeichnung: `Auftrag zu ${a.nummer}`, workflow_status: 'auftrag',
      auftragswert: a.gesamt_brutto, erstellt_von: Auth.userId(),
    });
    await DB.update('angebote', angebotId, { status: 'angenommen' });
    showToast(`Auftrag ${nummer} erstellt`, 'success');
    navigateTo('auftraege');
  },

  generatePdf(id) {
    showToast('PDF wird erstellt...', 'info');
    PdfModule.generateAngebot(id);
  },

  async openAnfrageForm() {
    const kunden = await DB.getAll('kunden');
    openModal('Neue Anfrage', `
      <div class="form-group"><label class="form-label">Kunde</label>
        <select class="form-select" id="anf-kunde"><option value="">— Kein Kunde —</option>
          ${kunden.map(k => `<option value="${k.id}">${k.firma||k.name}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Datum</label>
        <input class="form-input" type="date" id="anf-datum" value="${today()}" /></div>
      <div class="form-group"><label class="form-label">Beschreibung<span class="required">*</span></label>
        <textarea class="form-textarea" id="anf-beschreibung" placeholder="Was wurde angefragt?"></textarea></div>
    `, async () => {
      const beschreibung = document.getElementById('anf-beschreibung').value.trim();
      if (!beschreibung) { showToast('Beschreibung ist Pflichtfeld', 'error'); return; }
      await DB.insert('anfragen', {
        kunde_id: document.getElementById('anf-kunde').value || null,
        datum: document.getElementById('anf-datum').value,
        beschreibung, status: 'neu', erstellt_von: Auth.userId(),
      });
      closeModal();
      showToast('Anfrage gespeichert', 'success');
      this.activeTab = 'anfragen';
      this.render();
    }, 'Speichern');
  },

  async anfrageZuAngebot(anfrageId) {
    const anf = await DB.getById('anfragen', anfrageId);
    await DB.update('anfragen', anfrageId, { status: 'angebot_erstellt' });
    this.activeTab = 'angebote';
    await this.openAngebotForm();
    if (anf?.kunde_id) {
      const sel = document.getElementById('ang-kunde');
      if (sel) sel.value = anf.kunde_id;
    }
  },

  async openVorlageForm(id = null) {
    const v = id ? await DB.getById('positionen_vorlagen', id) : {};
    openModal(id ? 'Vorlage bearbeiten' : 'Neue Positionsvorlage', `
      <div class="form-group"><label class="form-label">Bezeichnung<span class="required">*</span></label>
        <input class="form-input" id="v-bez" value="${v.bezeichnung||''}" placeholder="z.B. Geländer Edelstahl V2A" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Kategorie</label>
          <input class="form-input" id="v-kat" value="${v.kategorie||''}" placeholder="z.B. Geländer, Treppen" /></div>
        <div class="form-group"><label class="form-label">Einheit</label>
          <select class="form-select" id="v-einheit">
            ${['Stk','m','m²','m³','kg','t','h','pauschal'].map(e => `<option ${(v.einheit||'Stk')===e?'selected':''}>${e}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Standardpreis (€)</label>
        <input class="form-input" type="number" id="v-preis" value="${v.standardpreis||''}" placeholder="0.00" /></div>
    `, async () => {
      const bezeichnung = document.getElementById('v-bez').value.trim();
      if (!bezeichnung) { showToast('Bezeichnung ist Pflichtfeld', 'error'); return; }
      const data = { bezeichnung, kategorie: document.getElementById('v-kat').value.trim(), einheit: document.getElementById('v-einheit').value, standardpreis: parseFloat(document.getElementById('v-preis').value)||0, erstellt_von: Auth.userId() };
      if (id) await DB.update('positionen_vorlagen', id, data);
      else await DB.insert('positionen_vorlagen', data);
      closeModal();
      showToast('Vorlage gespeichert', 'success');
      this.activeTab = 'vorlagen';
      this.render();
    }, 'Speichern');
  },

  async deleteAngebot(id, name) {
    confirmDelete(name, async () => { await DB.delete('angebote', id); closeModal(); showToast('Angebot gelöscht', 'success'); this.render(); });
  },
  async deleteAnfrage(id, name) {
    confirmDelete(name, async () => { await DB.delete('anfragen', id); closeModal(); showToast('Anfrage gelöscht', 'success'); this.render(); });
  },
  async deleteVorlage(id, name) {
    confirmDelete(name, async () => { await DB.delete('positionen_vorlagen', id); closeModal(); showToast('Vorlage gelöscht', 'success'); this.render(); });
  },
};
