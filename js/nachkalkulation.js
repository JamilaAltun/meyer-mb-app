const NachkalkulationModule = {
  async render() {
    const auftraege = await DB.getAll('auftraege');
    setContent(`
      <div class="module-header"><div class="module-title">Nachkalkulation</div></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Auftrag</th><th>Material Soll</th><th>Material Ist</th><th>Lohn Ist</th><th>Fremd Ist</th><th>Marge</th><th></th></tr></thead>
          <tbody>${auftraege.length ? await Promise.all(auftraege.map(async a => {
            const kalk = (await DB.getAll('nachkalkulation', { auftrag_id: a.id }))[0] || {};
            const zeitEintrag = await DB.getAll('zeiterfassung', { auftrag_id: a.id });
            const users = await DB.getAll('users');
            const userMap = {}; users.forEach(u => userMap[u.id] = u);
            const lohnIst = zeitEintrag.reduce((s,e) => { const u = userMap[e.user_id]; return s + (e.gesamt_minuten||0)/60*(u?.stundensatz||0); }, 0);
            const gesamtIst = (kalk.material_ist||0) + lohnIst + (kalk.fremd_ist||0) + (kalk.sonstige_ist||0);
            const marge = a.auftragswert ? ((a.auftragswert - gesamtIst) / a.auftragswert * 100) : null;
            const margeColor = marge === null ? '' : marge >= 20 ? 'color:var(--green)' : marge >= 10 ? 'color:var(--orange)' : 'color:var(--red)';
            return `<tr onclick="NachkalkulationModule.openDetail('${a.id}')">
              <td><strong>${a.nummer||'—'}</strong><br><small style="color:var(--text-muted)">${a.bezeichnung||''}</small></td>
              <td>${kalk.material_soll ? formatCurrency(kalk.material_soll) : '—'}</td>
              <td>${kalk.material_ist ? formatCurrency(kalk.material_ist) : '—'}</td>
              <td>${formatCurrency(lohnIst)}</td>
              <td>${kalk.fremd_ist ? formatCurrency(kalk.fremd_ist) : '—'}</td>
              <td style="${margeColor};font-weight:700">${marge !== null ? marge.toFixed(1)+'%' : '—'}</td>
              <td><button class="btn btn-blue btn-sm" onclick="event.stopPropagation();NachkalkulationModule.openForm('${a.id}')">✏️ Erfassen</button></td>
            </tr>`;
          })).then(rows => rows.join('')) : '<tr><td colspan="7"><div class="table-empty"><div class="table-empty-icon">📊</div><div class="table-empty-text">Noch keine Aufträge zur Kalkulation</div></div></td></tr>'}
          </tbody>
        </table>
      </div>`);
  },

  async openDetail(auftragId) {
    const a = await DB.getById('auftraege', auftragId);
    const kalk = (await DB.getAll('nachkalkulation', { auftrag_id: auftragId }))[0] || {};
    const zeitEintrag = await DB.getAll('zeiterfassung', { auftrag_id: auftragId });
    const users = await DB.getAll('users');
    const userMap = {}; users.forEach(u => userMap[u.id] = u);
    const lohnIst = zeitEintrag.reduce((s,e) => { const u = userMap[e.user_id]; return s + (e.gesamt_minuten||0)/60*(u?.stundensatz||0); }, 0);

    const rows = [
      ['Materialkosten', kalk.material_soll, kalk.material_ist],
      ['Lohnkosten', kalk.lohn_soll, lohnIst],
      ['Fremdleistungen', kalk.fremd_soll, kalk.fremd_ist],
      ['Sonstige', kalk.sonstige_soll, kalk.sonstige_ist],
    ];
    const gesamtSoll = rows.reduce((s,[,v]) => s+(v||0), 0);
    const gesamtIst  = rows.reduce((s,[,,v]) => s+(v||0), 0);
    const diff = gesamtSoll - gesamtIst;
    const marge = a?.auftragswert ? (a.auftragswert - gesamtIst) / a.auftragswert * 100 : null;

    openModal(`📊 Kalkulation: ${a?.nummer||''}`, `
      <table class="kalk-table">
        <thead><tr><th>Kategorie</th><th>Soll</th><th>Ist</th><th>Differenz</th></tr></thead>
        <tbody>
          ${rows.map(([l,soll,ist]) => { const d=(soll||0)-(ist||0); return `<tr>
            <td>${l}</td>
            <td class="kalk-soll">${soll ? formatCurrency(soll) : '—'}</td>
            <td>${ist ? formatCurrency(ist) : ist===0?formatCurrency(0):'—'}</td>
            <td class="${d>=0?'kalk-positive':'kalk-negative'}">${soll||ist ? (d>=0?'+':'')+formatCurrency(d) : '—'}</td>
          </tr>`; }).join('')}
          <tr class="kalk-total"><td><strong>Gesamt</strong></td><td><strong>${formatCurrency(gesamtSoll)}</strong></td><td><strong>${formatCurrency(gesamtIst)}</strong></td><td class="${diff>=0?'kalk-positive':'kalk-negative'}"><strong>${diff>=0?'+':''}${formatCurrency(diff)}</strong></td></tr>
        </tbody>
      </table>
      <div class="kalk-marge">
        <div class="kalk-marge-item"><div class="kalk-marge-label">Angebotspreis</div><div class="kalk-marge-value" style="color:var(--navy)">${a?.auftragswert ? formatCurrency(a.auftragswert) : '—'}</div></div>
        <div class="kalk-marge-item"><div class="kalk-marge-label">Gewinn</div><div class="kalk-marge-value" style="color:${diff>=0?'var(--green)':'var(--red)'}">${formatCurrency(a?.auftragswert ? a.auftragswert-gesamtIst : 0)}</div></div>
        <div class="kalk-marge-item"><div class="kalk-marge-label">Marge</div><div class="kalk-marge-value" style="color:${!marge?'var(--text)':marge>=20?'var(--green)':marge>=10?'var(--orange)':'var(--red)'}">${marge!==null?marge.toFixed(1)+'%':'—'}</div></div>
      </div>
    `);
  },

  async openForm(auftragId) {
    const existing = (await DB.getAll('nachkalkulation', { auftrag_id: auftragId }))[0] || {};
    openModal('Kalkulation erfassen', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Material Soll (€)</label><input class="form-input" type="number" id="kalk-mat-soll" value="${existing.material_soll||''}" /></div>
        <div class="form-group"><label class="form-label">Material Ist (€)</label><input class="form-input" type="number" id="kalk-mat-ist" value="${existing.material_ist||''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Lohn Soll (€)</label><input class="form-input" type="number" id="kalk-lohn-soll" value="${existing.lohn_soll||''}" /></div>
        <div class="form-group"><label class="form-label">Fremdleistungen Soll (€)</label><input class="form-input" type="number" id="kalk-fremd-soll" value="${existing.fremd_soll||''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Fremdleistungen Ist (€)</label><input class="form-input" type="number" id="kalk-fremd-ist" value="${existing.fremd_ist||''}" /></div>
        <div class="form-group"><label class="form-label">Sonstige Ist (€)</label><input class="form-input" type="number" id="kalk-sonst-ist" value="${existing.sonstige_ist||''}" /></div>
      </div>
    `, async () => {
      const data = { auftrag_id: auftragId, material_soll: parseFloat(document.getElementById('kalk-mat-soll').value)||0, material_ist: parseFloat(document.getElementById('kalk-mat-ist').value)||0, lohn_soll: parseFloat(document.getElementById('kalk-lohn-soll').value)||0, fremd_soll: parseFloat(document.getElementById('kalk-fremd-soll').value)||0, fremd_ist: parseFloat(document.getElementById('kalk-fremd-ist').value)||0, sonstige_ist: parseFloat(document.getElementById('kalk-sonst-ist').value)||0 };
      if (existing.id) await DB.update('nachkalkulation', existing.id, data);
      else await DB.insert('nachkalkulation', data);
      closeModal(); showToast('Kalkulation gespeichert', 'success'); this.render();
    }, 'Speichern');
  },
};
