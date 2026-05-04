/* ═══════════════════════════════════════════════════════
   KUNDEN — Kundenverwaltung
═══════════════════════════════════════════════════════ */

const KundenModule = {
  filter: '',

  async render() {
    const kunden = await DB.getAll('kunden');
    const filtered = kunden.filter(k =>
      !this.filter || [k.name, k.firma, k.telefon, k.email, k.ort].some(f => (f || '').toLowerCase().includes(this.filter))
    );

    setContent(`
      <div class="module-header">
        <div class="module-title">Kunden</div>
        <div class="module-actions">
          <button class="btn btn-primary btn-sm" onclick="KundenModule.openForm()">+ Neuer Kunde</button>
        </div>
      </div>
      <div class="table-wrapper">
        <div class="table-toolbar">
          <div class="table-search">
            🔍 <input type="text" placeholder="Name, Firma, Telefon suchen..." value="${this.filter}"
              oninput="KundenModule.filter=this.value.toLowerCase();KundenModule.render()" />
          </div>
          <span style="color:var(--text-muted);font-size:.85rem">${filtered.length} Kunden</span>
        </div>
        <table>
          <thead><tr><th>Name / Firma</th><th>Ansprechpartner</th><th>Telefon</th><th>E-Mail</th><th>Ort</th><th></th></tr></thead>
          <tbody>
            ${filtered.length ? filtered.map(k => `
              <tr onclick="KundenModule.openDetail('${k.id}')">
                <td><strong>${k.firma || k.name}</strong>${k.firma && k.name ? `<br><small style="color:var(--text-muted)">${k.name}</small>` : ''}</td>
                <td>${k.ansprechpartner || '—'}</td>
                <td>${k.telefon || '—'}</td>
                <td>${k.email || '—'}</td>
                <td>${k.ort || '—'}</td>
                <td onclick="event.stopPropagation()">
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="KundenModule.openForm('${k.id}')" title="Bearbeiten">✏️</button>
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="KundenModule.delete('${k.id}','${(k.firma||k.name).replace(/'/g,'')}')" title="Löschen">🗑️</button>
                  </div>
                </td>
              </tr>`).join('') : `<tr><td colspan="6"><div class="table-empty"><div class="table-empty-icon">👥</div><div class="table-empty-text">Noch keine Kunden vorhanden</div></div></td></tr>`}
          </tbody>
        </table>
      </div>
    `);
  },

  async openDetail(id) {
    const k = await DB.getById('kunden', id);
    if (!k) return;
    const [angebote, auftraege, rechnungen] = await Promise.all([
      DB.getAll('angebote', { kunde_id: id }),
      DB.getAll('auftraege', { kunde_id: id }),
      DB.getAll('rechnungen', { kunde_id: id }),
    ]);
    openModal(`👥 ${k.firma || k.name}`, `
      <div class="detail-grid">
        ${[['Name', k.name],['Firma', k.firma],['Ansprechpartner', k.ansprechpartner],['Adresse', k.adresse ? `${k.adresse}, ${k.plz} ${k.ort}` : '—'],['Telefon', k.telefon],['E-Mail', k.email]].map(([l,v]) => v ? `<div class="detail-field"><div class="detail-field-label">${l}</div><div class="detail-field-value">${v}</div></div>` : '').join('')}
      </div>
      <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
        <span class="badge badge-blue">${angebote.length} Angebote</span>
        <span class="badge badge-orange">${auftraege.length} Aufträge</span>
        <span class="badge badge-green">${rechnungen.length} Rechnungen</span>
      </div>
      ${k.notizen ? `<div class="detail-field"><div class="detail-field-label">Notizen</div><div class="detail-field-value" style="white-space:pre-line">${k.notizen}</div></div>` : ''}
      <div style="margin-top:1rem;display:flex;gap:.5rem">
        <button class="btn btn-secondary btn-sm" onclick="closeModal();KundenModule.openForm('${id}')">✏️ Bearbeiten</button>
        <button class="btn btn-blue btn-sm" onclick="closeModal();navigateTo('auftraege')">📋 Aufträge</button>
      </div>
    `);
  },

  async openForm(id = null) {
    const k = id ? await DB.getById('kunden', id) : {};
    openModal(id ? 'Kunde bearbeiten' : 'Neuer Kunde', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Name <span class="required">*</span></label>
          <input class="form-input" id="k-name" value="${k.name || ''}" placeholder="Max Mustermann" /></div>
        <div class="form-group"><label class="form-label">Firma</label>
          <input class="form-input" id="k-firma" value="${k.firma || ''}" placeholder="Muster GmbH" /></div>
      </div>
      <div class="form-group"><label class="form-label">Ansprechpartner</label>
        <input class="form-input" id="k-ansprechpartner" value="${k.ansprechpartner || ''}" /></div>
      <div class="form-group"><label class="form-label">Adresse</label>
        <input class="form-input" id="k-adresse" value="${k.adresse || ''}" placeholder="Musterstraße 1" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">PLZ</label>
          <input class="form-input" id="k-plz" value="${k.plz || ''}" placeholder="12345" /></div>
        <div class="form-group"><label class="form-label">Ort</label>
          <input class="form-input" id="k-ort" value="${k.ort || ''}" placeholder="Musterstadt" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Telefon</label>
          <input class="form-input" id="k-telefon" value="${k.telefon || ''}" /></div>
        <div class="form-group"><label class="form-label">E-Mail</label>
          <input class="form-input" id="k-email" value="${k.email || ''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Notizen</label>
        <textarea class="form-textarea" id="k-notizen">${k.notizen || ''}</textarea></div>
    `, async () => {
      const name = document.getElementById('k-name').value.trim();
      if (!name) { showToast('Name ist Pflichtfeld', 'error'); return; }
      const data = {
        name, firma: document.getElementById('k-firma').value.trim(),
        ansprechpartner: document.getElementById('k-ansprechpartner').value.trim(),
        adresse: document.getElementById('k-adresse').value.trim(),
        plz: document.getElementById('k-plz').value.trim(),
        ort: document.getElementById('k-ort').value.trim(),
        telefon: document.getElementById('k-telefon').value.trim(),
        email: document.getElementById('k-email').value.trim(),
        notizen: document.getElementById('k-notizen').value.trim(),
      };
      if (id) await DB.update('kunden', id, data);
      else await DB.insert('kunden', data);
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
