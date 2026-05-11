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
      days += `<div class="cal-day${isToday?' today':''}">
        <div class="cal-day-num">${day}</div>
        ${dayEvents.map(e => `<div class="cal-event" style="background:${e.color}20;color:${e.color}" title="${e.title}">${e.icon} ${e.title}</div>`).join('')}
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
    } catch (e) { /* offline */ }
    return events;
  },

  prevMonth() { this.currentDate.setMonth(this.currentDate.getMonth() - 1); this.renderCalendar(); },
  nextMonth() { this.currentDate.setMonth(this.currentDate.getMonth() + 1); this.renderCalendar(); },
};
