const RechnungenModule = {
  async render() {
    const rechnungen = await DB.getAll('rechnungen');
    const kunden = await DB.getAll('kunden');
    const km = {}; kunden.forEach(k => km[k.id] = k);
    const today = new Date(); today.setHours(0,0,0,0);

    setContent(`
      <div class="module-header">
        <div class="module-title">Rechnungen</div>
        <div class="module-actions"><button class="btn btn-primary btn-sm" onclick="RechnungenModule.openForm()">+ Neue Rechnung</button></div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Nummer</th><th>Typ</th><th>Kunde</th><th>Datum</th><th>Fällig</th><th>Betrag</th><th>Status</th><th></th></tr></thead>
          <tbody>${rechnungen.length ? rechnungen.map(r => {
            const k = km[r.kunde_id];
            const faelligDate = r.datum ? new Date(r.datum) : null;
            if (faelligDate) faelligDate.setDate(faelligDate.getDate() + (parseInt(r.zahlungsziel)||14));
            const ueberfaellig = faelligDate && faelligDate < today && r.status !== 'bezahlt';
            const status = ueberfaellig ? 'ueberfaellig' : r.status;
            return `<tr onclick="RechnungenModule.openDetail('${r.id}')">
              <td><strong>${r.nummer||'—'}</strong></td>
              <td>${r.typ === 'schluss' ? 'Schlussrechnung' : 'Abschlagsrechnung'}</td>
              <td>${k ? (k.firma||k.name) : '—'}</td>
              <td>${formatDate(r.datum)}</td>
              <td style="${ueberfaellig?'color:var(--red);font-weight:600':''}">${faelligDate ? formatDate(faelligDate) : '—'}</td>
              <td style="font-weight:600">${formatCurrency(r.gesamt_brutto)}</td>
              <td>${getStatusBadge(status)}</td>
              <td onclick="event.stopPropagation()">
                <div class="table-actions">
                  <button class="btn btn-blue btn-sm" onclick="RechnungenModule.generatePdf('${r.id}')" title="PDF">PDF</button>
                  <button class="btn btn-success btn-sm" onclick="RechnungenModule.markBezahlt('${r.id}')" title="Bezahlt">✓</button>
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="RechnungenModule.delete('${r.id}','${(r.nummer||'Rechnung').replace(/'/g,'')}')">×</button>
                </div>
              </td>
            </tr>`;
          }).join('') : '<tr><td colspan="8"><div class="table-empty"><div class="table-empty-text">Noch keine Rechnungen</div></div></td></tr>'}
          </tbody>
        </table>
      </div>`);
  },

  async openDetail(id) {
    const r = await DB.getById('rechnungen', id);
    if (!r) return;
    const kunden = await DB.getAll('kunden');
    const k = kunden.find(k => k.id === r.kunde_id);
    openModal(`Rechnung ${r.nummer}`, `
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-field-label">Nummer</div><div class="detail-field-value">${r.nummer}</div></div>
        <div class="detail-field"><div class="detail-field-label">Typ</div><div class="detail-field-value">${r.typ==='schluss'?'Schlussrechnung':'Abschlagsrechnung'}</div></div>
        <div class="detail-field"><div class="detail-field-label">Datum</div><div class="detail-field-value">${formatDate(r.datum)}</div></div>
        <div class="detail-field"><div class="detail-field-label">Zahlungsziel</div><div class="detail-field-value">${r.zahlungsziel||'—'}</div></div>
        <div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-value">${getStatusBadge(r.status)}</div></div>
        <div class="detail-field"><div class="detail-field-label">Gesamt</div><div class="detail-field-value" style="font-weight:800;color:var(--navy)">${formatCurrency(r.gesamt_brutto)}</div></div>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
        <button class="btn btn-blue btn-sm" onclick="closeModal();RechnungenModule.generatePdf('${id}')">PDF</button>
        ${r.status !== 'bezahlt' ? `<button class="btn btn-success btn-sm" onclick="closeModal();RechnungenModule.markBezahlt('${id}')">✓ Als bezahlt markieren</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="closeModal();RechnungenModule.openForm('${id}')">Bearbeiten</button>
      </div>
    `);
  },

  async openForm(id = null) {
    const r = id ? await DB.getById('rechnungen', id) : {};
    const kunden = await DB.getAll('kunden');
    const auftraege = await DB.getAll('auftraege');
    const s = Settings.get();
    const all = await DB.getAll('rechnungen');
    const nextNr = `R-${new Date().getFullYear()}-${String((s.rechnung_startnummer||1)+all.length).padStart(3,'0')}`;

    openModal(id ? 'Rechnung bearbeiten' : 'Neue Rechnung', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Rechnungsnummer<span class="required">*</span></label><input class="form-input" id="r-nummer" value="${r.nummer||nextNr}" /></div>
        <div class="form-group"><label class="form-label">Typ</label>
          <select class="form-select" id="r-typ">
            <option value="abschlag" ${r.typ!=='schluss'?'selected':''}>Abschlagsrechnung</option>
            <option value="schluss" ${r.typ==='schluss'?'selected':''}>Schlussrechnung</option>
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Kunde</label>
          <select class="form-select" id="r-kunde"><option value="">— Kein Kunde —</option>
            ${kunden.map(k => `<option value="${k.id}" ${r.kunde_id===k.id?'selected':''}>${k.firma||k.name}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Auftrag</label>
          <select class="form-select" id="r-auftrag"><option value="">— Kein Auftrag —</option>
            ${auftraege.map(a => `<option value="${a.id}" ${r.auftrag_id===a.id?'selected':''}>${a.nummer} ${a.bezeichnung||''}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Datum</label><input class="form-input" type="date" id="r-datum" value="${r.datum||today()}" /></div>
        <div class="form-group"><label class="form-label">Leistungszeitraum</label><input class="form-input" id="r-leistung" value="${r.leistungszeitraum||''}" placeholder="z.B. Januar 2024" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Zahlungsziel</label><input class="form-input" id="r-zahlung" value="${r.zahlungsziel||s.zahlungsziel_standard||'14 Tage netto'}" /></div>
        <div class="form-group"><label class="form-label">MwSt.</label>
          <select class="form-select" id="r-mwst">
            <option value="19" ${(r.mwst_satz||19)===19?'selected':''}>19%</option>
            <option value="7" ${r.mwst_satz===7?'selected':''}>7%</option>
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nettobetrag (€)<span class="required">*</span></label><input class="form-input" type="number" id="r-netto" value="${r.gesamt_netto||''}" oninput="RechnungenModule.calcBrutto()" /></div>
        <div class="form-group"><label class="form-label">Bruttobetrag (€)</label><input class="form-input" type="number" id="r-brutto" value="${r.gesamt_brutto||''}" readonly /></div>
      </div>
      <div class="form-group"><label class="form-label"><input type="checkbox" id="r-briefpapier" ${r.briefpapier_modus?'checked':''} /> Briefpapier-Modus</label></div>
    `, async () => {
      const nummer = document.getElementById('r-nummer').value.trim();
      if (!nummer) { showToast('Nummer ist Pflichtfeld', 'error'); return; }
      const netto = parseFloat(document.getElementById('r-netto').value)||0;
      const mwst = parseInt(document.getElementById('r-mwst').value);
      const data = { nummer, typ: document.getElementById('r-typ').value, kunde_id: document.getElementById('r-kunde').value||null, auftrag_id: document.getElementById('r-auftrag').value||null, datum: document.getElementById('r-datum').value, leistungszeitraum: document.getElementById('r-leistung').value.trim(), zahlungsziel: document.getElementById('r-zahlung').value.trim(), mwst_satz: mwst, gesamt_netto: netto, gesamt_brutto: netto*(1+mwst/100), status: r.status||'offen', briefpapier_modus: document.getElementById('r-briefpapier').checked, erstellt_von: Auth.userId() };
      if (id) await DB.update('rechnungen', id, data);
      else await DB.insert('rechnungen', data);
      closeModal(); showToast('Rechnung gespeichert', 'success'); this.render();
    }, 'Speichern', '700px');
  },

  calcBrutto() {
    const netto = parseFloat(document.getElementById('r-netto')?.value)||0;
    const mwst = parseInt(document.getElementById('r-mwst')?.value)||19;
    const bruttoEl = document.getElementById('r-brutto');
    if (bruttoEl) bruttoEl.value = (netto*(1+mwst/100)).toFixed(2);
  },

  async markBezahlt(id) {
    await DB.update('rechnungen', id, { status: 'bezahlt', bezahlt_am: new Date().toISOString() });
    showToast('Rechnung als bezahlt markiert', 'success');
    this.render();
  },

  generatePdf(id) {
    showToast('PDF wird erstellt...', 'info');
    PdfModule.generateRechnung(id);
  },

  async delete(id, name) {
    confirmDelete(name, async () => { await DB.delete('rechnungen', id); closeModal(); showToast('Rechnung gelöscht', 'success'); this.render(); });
  },
};
