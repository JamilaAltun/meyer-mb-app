const UrlaubModule = {
  async render() {
    const userId = Auth.userId();
    const allUrlaub = await DB.getAll('urlaub');
    const users = await DB.getAll('users');
    const um = {}; users.forEach(u => um[u.id] = u);
    const user = Auth.currentUser;
    const meineAntraege = allUrlaub.filter(u => u.user_id === userId);
    const genommene = meineAntraege.filter(u => u.status === 'genehmigt').reduce((s,u) => s+(u.tage||0), 0);
    const rest = (user?.urlaub_tage_gesamt||28) - genommene;

    setContent(`
      <div class="module-header">
        <div class="module-title">Urlaub</div>
        <div class="module-actions"><button class="btn btn-primary btn-sm" onclick="UrlaubModule.openForm()">+ Urlaub beantragen</button></div>
      </div>

      <!-- Urlaubskonto -->
      <div class="kpi-grid" style="max-width:600px;margin-bottom:1.5rem">
        <div class="kpi-card green"><div class="kpi-icon">🏖️</div><div class="kpi-value">${user?.urlaub_tage_gesamt||28}</div><div class="kpi-label">Gesamt Tage</div></div>
        <div class="kpi-card orange"><div class="kpi-icon">✓</div><div class="kpi-value">${genommene}</div><div class="kpi-label">Genommen</div></div>
        <div class="kpi-card ${rest < 5 ? 'red' : 'blue'}"><div class="kpi-icon">⏳</div><div class="kpi-value">${rest}</div><div class="kpi-label">Resturlaub</div></div>
      </div>

      <!-- Meine Anträge -->
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header"><span class="card-title">Meine Urlaubsanträge</span></div>
        ${meineAntraege.length ? `<div style="display:flex;flex-direction:column;gap:.5rem">
          ${meineAntraege.map(u => `
            <div class="urlaub-card">
              <div class="urlaub-dates">
                <strong>${formatDate(u.von_datum)} – ${formatDate(u.bis_datum)}</strong>
                <small>${getStatusBadge(u.status)}</small>
              </div>
              <div class="urlaub-days">${u.tage}<small>Tage</small></div>
              ${u.status === 'abwartend' ? `<button class="btn btn-danger btn-sm" onclick="UrlaubModule.delete('${u.id}')">Stornieren</button>` : ''}
            </div>`).join('')}
        </div>` : '<p style="color:var(--text-muted)">Noch keine Anträge</p>'}
      </div>

      <!-- Admin: Alle Anträge -->
      ${Auth.isAdmin() ? `
      <div class="card">
        <div class="card-header"><span class="card-title">Alle Urlaubsanträge</span></div>
        ${allUrlaub.filter(u => u.status === 'abwartend').length ? `
          <div style="display:flex;flex-direction:column;gap:.5rem">
            ${allUrlaub.filter(u => u.status === 'abwartend').map(u => `
              <div class="urlaub-card">
                <div class="urlaub-dates">
                  <strong>${um[u.user_id]?.name||'—'}</strong>
                  <small>${formatDate(u.von_datum)} – ${formatDate(u.bis_datum)}</small>
                </div>
                <div class="urlaub-days">${u.tage}<small>Tage</small></div>
                <div style="display:flex;gap:.5rem">
                  <button class="btn btn-success btn-sm" onclick="UrlaubModule.approve('${u.id}')">✓ Genehmigen</button>
                  <button class="btn btn-danger btn-sm" onclick="UrlaubModule.reject('${u.id}')">✗ Ablehnen</button>
                </div>
              </div>`).join('')}
          </div>` : '<p style="color:var(--text-muted)">Keine ausstehenden Anträge</p>'}
      </div>` : ''}
    `);
  },

  async openForm() {
    openModal('Urlaub beantragen', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Von<span class="required">*</span></label>
          <input class="form-input" type="date" id="url-von" min="${today()}" /></div>
        <div class="form-group"><label class="form-label">Bis<span class="required">*</span></label>
          <input class="form-input" type="date" id="url-bis" min="${today()}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Anzahl Tage</label>
        <input class="form-input" type="number" id="url-tage" placeholder="Wird automatisch berechnet" min="1" /></div>
      <p style="color:var(--text-muted);font-size:.8rem">Der Antrag wird zur Genehmigung weitergeleitet.</p>
    `, async () => {
      const von = document.getElementById('url-von').value;
      const bis = document.getElementById('url-bis').value;
      if (!von || !bis) { showToast('Von und Bis sind Pflichtfelder', 'error'); return; }
      const tage = document.getElementById('url-tage').value || Math.ceil((new Date(bis)-new Date(von))/(1000*60*60*24))+1;
      await DB.insert('urlaub', { user_id: Auth.userId(), von_datum: von, bis_datum: bis, tage: parseInt(tage), status: 'abwartend', erstellt_am: new Date().toISOString() });
      closeModal(); showToast('Urlaubsantrag eingereicht', 'success'); updateBadges(); this.render();
    }, 'Beantragen');
  },

  async approve(id) {
    await DB.update('urlaub', id, { status: 'genehmigt', genehmigt_von: Auth.userId() });
    showToast('Urlaub genehmigt', 'success'); updateBadges(); this.render();
  },
  async reject(id) {
    await DB.update('urlaub', id, { status: 'abgelehnt' });
    showToast('Urlaub abgelehnt', 'info'); updateBadges(); this.render();
  },
  async delete(id) {
    await DB.delete('urlaub', id);
    showToast('Antrag storniert', 'info'); this.render();
  },
};
