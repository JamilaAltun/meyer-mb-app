const KalenderModule = {
  currentDate: new Date(),

  async render() {
    setContent(`
      <div class="module-header">
        <div class="module-title">Kalender</div>
        <div class="module-actions">
          <button class="btn btn-secondary btn-sm" onclick="KalenderModule.prevMonth()">‹</button>
          <span id="cal-month-label" style="font-weight:600;min-width:140px;text-align:center"></span>
          <button class="btn btn-secondary btn-sm" onclick="KalenderModule.nextMonth()">›</button>
          <button class="btn btn-ghost btn-sm" onclick="KalenderModule.currentDate=new Date();KalenderModule.renderCalendar()">Heute</button>
          <button class="btn btn-primary btn-sm" onclick="KalenderModule.openForm()">+ Neuer Termin</button>
        </div>
      </div>
      <div id="calendar-container"></div>
    `);
    await this.renderCalendar();
  },

  async renderCalendar() {
    const d = this.currentDate;
    document.getElementById('cal-month-label').textContent =
      d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    const events = await this.getEvents();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay  = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    let startDow = firstDay.getDay(); if (startDow === 0) startDow = 7;
    const today = new Date(); today.setHours(0,0,0,0);

    let days = '';
    for (let i = 1; i < startDow; i++) {
      const prev = new Date(firstDay); prev.setDate(prev.getDate() - (startDow - i));
      days += `<div class="cal-day other-month"><div class="cal-day-num">${prev.getDate()}</div></div>`;
    }
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(d.getFullYear(), d.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      const isToday = date.getTime() === today.getTime();
      const dayEvents = events.filter(e => e.date === dateStr);
      days += `<div class="cal-day${isToday?' today':''}" onclick="KalenderModule.openForm(null,'${dateStr}')" style="cursor:pointer">
        <div class="cal-day-num">${day}</div>
        ${dayEvents.map(e => `<div class="cal-event" style="background:${e.color}20;color:${e.color}" title="${e.title}" ${e.eventId ? `onclick="event.stopPropagation();KalenderModule.openForm('${e.eventId}')"` : ''}>${e.icon} ${e.title}</div>`).join('')}
      </div>`;
    }
    const remaining = (7 - ((startDow - 1 + lastDay.getDate()) % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
    }

    document.getElementById('calendar-container').innerHTML = `
      <div class="calendar-grid">
        ${['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => `<div class="cal-day-header">${d}</div>`).join('')}
        ${days}
      </div>`;
  },

  async getEvents() {
    const events = [];
    try {
      const auftraege = await DB.getAll('auftraege');
      auftraege.forEach(a => {
        if (a.fertigstellung) events.push({ date: a.fertigstellung, title: `${a.nummer||'Auftrag'}`, color: '#f59e0b', icon: '' });
        if (a.startdatum) events.push({ date: a.startdatum, title: `▶ ${a.nummer||'Auftrag'} Start`, color: '#2563eb', icon: '▶' });
      });
      const aufgaben = await DB.getAll('aufgaben');
      aufgaben.filter(a => a.faellig_am && !a.erledigt).forEach(a => {
        events.push({ date: a.faellig_am, title: a.titel, color: a.prioritaet==='hoch'?'#ef4444':'#8b5cf6', icon: '' });
      });
      const urlaub = await DB.getAll('urlaub');
      urlaub.filter(u => u.status === 'genehmigt').forEach(u => {
        const from = new Date(u.von_datum); const to = new Date(u.bis_datum);
        for (let d = new Date(from); d <= to; d.setDate(d.getDate()+1)) {
          events.push({ date: d.toISOString().split('T')[0], title: 'Urlaub', color: '#22c55e', icon: '' });
        }
      });
      const termine = await DB.getAll('kalender_events');
      termine.forEach(t => {
        const timeStr = t.uhrzeit_von ? ` ${t.uhrzeit_von}` : '';
        events.push({ date: t.datum, title: `${t.titel}${timeStr}`, color: t.farbe || '#2563eb', icon: this._kategoriIcon(t.kategorie), eventId: t.id });
      });
    } catch (e) { /* offline */ }
    return events;
  },

  _kategoriIcon(k) {
    return { termin: '📅', besprechung: '👥', lieferung: '📦', sonstiges: '📌' }[k] || '📅';
  },

  async openForm(id = null, prefillDate = null) {
    const a = id ? await DB.getById('kalender_events', id) : {};
    const farben = [
      { hex: '#2563eb', name: 'Blau' },
      { hex: '#10b981', name: 'Grün' },
      { hex: '#ef4444', name: 'Rot' },
      { hex: '#f59e0b', name: 'Gelb' },
      { hex: '#8b5cf6', name: 'Lila' },
      { hex: '#0f1e40', name: 'Navy' },
    ];
    const selectedFarbe = a.farbe || '#2563eb';
    const datum = a.datum || prefillDate || today();

    openModal(id ? 'Termin bearbeiten' : 'Neuer Termin', `
      <div class="form-group"><label class="form-label">Titel<span class="required">*</span></label>
        <input class="form-input" id="kal-titel" value="${a.titel||''}" placeholder="z.B. Kundengespräch Meyer" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Datum<span class="required">*</span></label>
          <input class="form-input" type="date" id="kal-datum" value="${datum}" /></div>
        <div class="form-group"><label class="form-label">Kategorie</label>
          <select class="form-select" id="kal-kategorie">
            <option value="termin" ${(a.kategorie||'termin')==='termin'?'selected':''}>Termin</option>
            <option value="besprechung" ${a.kategorie==='besprechung'?'selected':''}>Besprechung</option>
            <option value="lieferung" ${a.kategorie==='lieferung'?'selected':''}>Lieferung</option>
            <option value="sonstiges" ${a.kategorie==='sonstiges'?'selected':''}>Sonstiges</option>
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Von</label>
          <input class="form-input" type="time" id="kal-von" value="${a.uhrzeit_von||''}" /></div>
        <div class="form-group"><label class="form-label">Bis</label>
          <input class="form-input" type="time" id="kal-bis" value="${a.uhrzeit_bis||''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Beschreibung</label>
        <textarea class="form-textarea" id="kal-beschreibung" rows="3" placeholder="Optionale Details...">${a.beschreibung||''}</textarea></div>
      <div class="form-group"><label class="form-label">Farbe</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          ${farben.map(f => `<label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:.25rem;font-size:.7rem;color:var(--text-muted)">
            <input type="radio" name="kal-farbe" value="${f.hex}" ${selectedFarbe===f.hex?'checked':''} style="display:none" />
            <span style="width:28px;height:28px;border-radius:50%;background:${f.hex};display:block;border:3px solid ${selectedFarbe===f.hex?'#000':'transparent'};transition:border-color .15s" onclick="document.querySelectorAll('[name=kal-farbe]').forEach(r=>{r.nextElementSibling.style.borderColor='transparent'});this.previousElementSibling.checked=true;this.style.borderColor='#000'"></span>
            ${f.name}
          </label>`).join('')}
        </div></div>
      ${id ? `<div style="text-align:right;margin-top:.5rem"><button class="btn btn-danger btn-sm" onclick="KalenderModule.delete('${id}')">Termin löschen</button></div>` : ''}
    `, async () => {
      const titel = document.getElementById('kal-titel').value.trim();
      const datum = document.getElementById('kal-datum').value;
      if (!titel) { showToast('Titel ist Pflichtfeld', 'error'); return; }
      if (!datum) { showToast('Datum ist Pflichtfeld', 'error'); return; }
      const farbeInput = document.querySelector('[name=kal-farbe]:checked');
      const data = {
        titel,
        datum,
        kategorie: document.getElementById('kal-kategorie').value,
        uhrzeit_von: document.getElementById('kal-von').value || null,
        uhrzeit_bis: document.getElementById('kal-bis').value || null,
        beschreibung: document.getElementById('kal-beschreibung').value.trim() || null,
        farbe: farbeInput ? farbeInput.value : '#2563eb',
        erstellt_von: Auth.userId(),
      };
      if (id) await DB.update('kalender_events', id, data);
      else await DB.insert('kalender_events', data);
      closeModal();
      showToast('Termin gespeichert', 'success');
      await this.renderCalendar();
    }, 'Speichern');
  },

  async delete(id) {
    confirmDelete('diesen Termin', async () => {
      await DB.delete('kalender_events', id);
      closeModal();
      showToast('Termin gelöscht', 'success');
      await this.renderCalendar();
    });
  },

  prevMonth() { this.currentDate.setMonth(this.currentDate.getMonth() - 1); this.renderCalendar(); },
  nextMonth() { this.currentDate.setMonth(this.currentDate.getMonth() + 1); this.renderCalendar(); },
};
