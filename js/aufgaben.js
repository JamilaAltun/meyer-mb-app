const AufgabenModule = {
  async render() {
    const aufgaben = await DB.getAll('aufgaben');
    const users = await DB.getAll('users');
    const auftraege = await DB.getAll('auftraege');
    const um = {}; users.forEach(u => um[u.id] = u);
    const am = {}; auftraege.forEach(a => am[a.id] = a);
    const userId = Auth.userId();
    const meine = Auth.isAdmin() ? aufgaben : aufgaben.filter(a => (a.zugewiesen_an||[]).includes(userId));

    setContent(`
      <div class="module-header">
        <div class="module-title">Aufgaben</div>
        <div class="module-actions">
          ${Auth.can('aufgaben') ? `<button class="btn btn-primary btn-sm" onclick="AufgabenModule.openForm()">+ Neue Aufgabe</button>` : ''}
        </div>
      </div>
      <div class="filter-chips" style="margin-bottom:1rem">
        <div class="chip active" id="chip-offen" onclick="AufgabenModule.filterChip(this,'offen')">Offen</div>
        <div class="chip" id="chip-erledigt" onclick="AufgabenModule.filterChip(this,'erledigt')">Erledigt</div>
        <div class="chip" id="chip-alle" onclick="AufgabenModule.filterChip(this,'alle')">Alle</div>
      </div>
      <div id="aufgaben-list">
        ${this.renderList(meine.filter(a => !a.erledigt), um, am)}
      </div>`);
  },

  renderList(items, um, am) {
    if (!items.length) return '<div class="table-empty"><div class="table-empty-icon">✅</div><div class="table-empty-text">Keine Aufgaben</div></div>';
    return items.map(a => `
      <div class="card" style="margin-bottom:.75rem;border-left:4px solid ${a.prioritaet==='hoch'?'var(--red)':a.prioritaet==='normal'?'var(--orange)':'var(--blue)'}">
        <div style="display:flex;align-items:flex-start;gap:.75rem">
          <input type="checkbox" class="perm-checkbox" style="margin-top:.2rem" ${a.erledigt?'checked':''} onchange="AufgabenModule.toggleErledigt('${a.id}',this.checked)" />
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem">
              <strong style="${a.erledigt?'text-decoration:line-through;color:var(--text-muted)':''}">${a.titel}</strong>
              ${getStatusBadge(a.prioritaet)}
              ${a.erledigt ? '<span class="badge badge-green">Erledigt</span>' : ''}
            </div>
            ${a.beschreibung ? `<p style="font-size:.85rem;color:var(--text-muted);margin-bottom:.4rem">${a.beschreibung}</p>` : ''}
            <div style="display:flex;gap:.75rem;font-size:.75rem;color:var(--text-muted);flex-wrap:wrap">
              ${a.faellig_am ? `<span>📅 Fällig: ${formatDate(a.faellig_am)}</span>` : ''}
              ${(a.zugewiesen_an||[]).length ? `<span>👤 ${(a.zugewiesen_an||[]).map(id => um[id]?.name||id).join(', ')}</span>` : ''}
              ${a.auftrag_id && am[a.auftrag_id] ? `<span>📋 ${am[a.auftrag_id].nummer}</span>` : ''}
            </div>
          </div>
          ${Auth.isAdmin() ? `<div class="table-actions">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="AufgabenModule.openForm('${a.id}')">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="AufgabenModule.delete('${a.id}','${a.titel.replace(/'/g,'')}')">🗑️</button>
          </div>` : ''}
        </div>
      </div>`).join('');
  },

  async filterChip(el, filter) {
    document.querySelectorAll('[id^=chip-]').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const aufgaben = await DB.getAll('aufgaben');
    const users = await DB.getAll('users');
    const auftraege = await DB.getAll('auftraege');
    const um = {}; users.forEach(u => um[u.id] = u);
    const am = {}; auftraege.forEach(a => am[a.id] = a);
    const userId = Auth.userId();
    let items = Auth.isAdmin() ? aufgaben : aufgaben.filter(a => (a.zugewiesen_an||[]).includes(userId));
    if (filter === 'offen') items = items.filter(a => !a.erledigt);
    else if (filter === 'erledigt') items = items.filter(a => a.erledigt);
    document.getElementById('aufgaben-list').innerHTML = this.renderList(items, um, am);
  },

  async toggleErledigt(id, erledigt) {
    await DB.update('aufgaben', id, { erledigt });
    showToast(erledigt ? 'Aufgabe erledigt! ✅' : 'Aufgabe wieder geöffnet', erledigt ? 'success' : 'info');
    updateBadges();
  },

  async openForm(id = null) {
    const a = id ? await DB.getById('aufgaben', id) : {};
    const users = await DB.getAll('users');
    const auftraege = await DB.getAll('auftraege');
    const zugewiesen = a.zugewiesen_an || [];

    openModal(id ? 'Aufgabe bearbeiten' : 'Neue Aufgabe', `
      <div class="form-group"><label class="form-label">Titel<span class="required">*</span></label>
        <input class="form-input" id="auf-titel" value="${a.titel||''}" /></div>
      <div class="form-group"><label class="form-label">Beschreibung</label>
        <textarea class="form-textarea" id="auf-beschreibung">${a.beschreibung||''}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Priorität</label>
          <select class="form-select" id="auf-prio">
            <option value="niedrig" ${(a.prioritaet||'normal')==='niedrig'?'selected':''}>Niedrig</option>
            <option value="normal" ${(a.prioritaet||'normal')==='normal'?'selected':''}>Normal</option>
            <option value="hoch" ${a.prioritaet==='hoch'?'selected':''}>Hoch</option>
          </select></div>
        <div class="form-group"><label class="form-label">Fällig am</label>
          <input class="form-input" type="date" id="auf-faellig" value="${a.faellig_am||''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Zugewiesen an</label>
        <div style="display:flex;flex-direction:column;gap:.35rem;max-height:150px;overflow-y:auto">
          ${users.map(u => `<label style="display:flex;align-items:center;gap:.5rem;font-size:.875rem">
            <input type="checkbox" class="perm-checkbox" value="${u.id}" ${zugewiesen.includes(u.id)?'checked':''} name="auf-users" />
            ${u.name} (${u.position||'—'})
          </label>`).join('')}
        </div></div>
      <div class="form-group"><label class="form-label">Auftrag verknüpfen</label>
        <select class="form-select" id="auf-auftrag"><option value="">— Kein Auftrag —</option>
          ${auftraege.map(au => `<option value="${au.id}" ${a.auftrag_id===au.id?'selected':''}>${au.nummer} ${au.bezeichnung||''}</option>`).join('')}
        </select></div>
    `, async () => {
      const titel = document.getElementById('auf-titel').value.trim();
      if (!titel) { showToast('Titel ist Pflichtfeld', 'error'); return; }
      const selected = [...document.querySelectorAll('[name=auf-users]:checked')].map(el => el.value);
      const data = { titel, beschreibung: document.getElementById('auf-beschreibung').value.trim(), prioritaet: document.getElementById('auf-prio').value, faellig_am: document.getElementById('auf-faellig').value||null, zugewiesen_an: selected, auftrag_id: document.getElementById('auf-auftrag').value||null, erledigt: a.erledigt||false, erstellt_von: Auth.userId() };
      if (id) await DB.update('aufgaben', id, data);
      else await DB.insert('aufgaben', data);
      closeModal(); showToast('Aufgabe gespeichert', 'success'); updateBadges(); this.render();
    }, 'Speichern');
  },

  async delete(id, name) {
    confirmDelete(name, async () => { await DB.delete('aufgaben', id); closeModal(); showToast('Aufgabe gelöscht', 'success'); this.render(); });
  },
};
