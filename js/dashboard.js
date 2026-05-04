/* ═══════════════════════════════════════════════════════
   DASHBOARD — Übersicht, KPIs, Diagramme
═══════════════════════════════════════════════════════ */

const DashboardModule = {
  async render() {
    const [auftraege, angebote, rechnungen, aufgaben] = await Promise.all([
      DB.getAll('auftraege'), DB.getAll('angebote'),
      DB.getAll('rechnungen'), DB.getAll('aufgaben'),
    ]);

    const today = new Date(); today.setHours(0,0,0,0);
    const offeneAngebote = angebote.filter(a => a.status !== 'angenommen' && a.status !== 'abgelehnt');
    const laufendeAuftraege = auftraege.filter(a => a.workflow_status !== 'abgeschlossen');
    const offeneRechnungen = rechnungen.filter(r => r.status === 'offen' || r.status === 'gesendet');
    const ueberfaellig = rechnungen.filter(r => {
      if (r.status === 'bezahlt') return false;
      if (!r.datum) return false;
      const faellig = new Date(r.datum);
      faellig.setDate(faellig.getDate() + (parseInt(r.zahlungsziel) || 14));
      return faellig < today;
    });

    const meinAufgaben = aufgaben.filter(a =>
      !a.erledigt && (Auth.isAdmin() || (a.zugewiesen_an || []).includes(Auth.userId()))
    );

    /* Umsatz berechnen */
    const umsatzHeute = rechnungen.filter(r => r.bezahlt_am?.startsWith(new Date().toISOString().split('T')[0])).reduce((s, r) => s + (r.gesamt_brutto || 0), 0);
    const umsatzMonat = rechnungen.filter(r => {
      const m = new Date().toISOString().slice(0, 7);
      return r.bezahlt_am?.startsWith(m);
    }).reduce((s, r) => s + (r.gesamt_brutto || 0), 0);

    setContent(`
      <div class="module-header">
        <div class="module-title">Dashboard</div>
        <div class="module-actions">
          <span style="color:var(--text-muted);font-size:.85rem">${new Date().toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</span>
        </div>
      </div>

      <!-- KPI Kacheln -->
      <div class="kpi-grid">
        <div class="kpi-card" onclick="navigateTo('anfragen')">
          <div class="kpi-icon">📨</div>
          <div class="kpi-value">${offeneAngebote.length}</div>
          <div class="kpi-label">Offene Angebote</div>
        </div>
        <div class="kpi-card orange" onclick="navigateTo('auftraege')">
          <div class="kpi-icon">📋</div>
          <div class="kpi-value">${laufendeAuftraege.length}</div>
          <div class="kpi-label">Laufende Aufträge</div>
        </div>
        <div class="kpi-card red" onclick="navigateTo('rechnungen')">
          <div class="kpi-icon">🧾</div>
          <div class="kpi-value">${offeneRechnungen.length}</div>
          <div class="kpi-label">Offene Rechnungen</div>
        </div>
        <div class="kpi-card ${ueberfaellig.length ? 'red' : 'green'}" onclick="navigateTo('rechnungen')">
          <div class="kpi-icon">⚠️</div>
          <div class="kpi-value">${ueberfaellig.length}</div>
          <div class="kpi-label">Überfällige Rechnungen</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-icon">💶</div>
          <div class="kpi-value" style="font-size:1.3rem">${formatCurrency(umsatzMonat)}</div>
          <div class="kpi-label">Umsatz diesen Monat</div>
        </div>
        <div class="kpi-card purple" onclick="navigateTo('aufgaben')">
          <div class="kpi-icon">✅</div>
          <div class="kpi-value">${meinAufgaben.length}</div>
          <div class="kpi-label">Meine offenen Aufgaben</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
        <!-- Letzte Aufträge -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">📋 Aktuelle Aufträge</span>
            <button class="btn btn-ghost btn-sm" onclick="navigateTo('auftraege')">Alle →</button>
          </div>
          ${laufendeAuftraege.length ? laufendeAuftraege.slice(0,5).map(a => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid var(--card-border)">
              <div>
                <div style="font-size:.875rem;font-weight:600">${a.bezeichnung || a.nummer || '—'}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${a.nummer || ''}</div>
              </div>
              ${getStatusBadge(a.workflow_status)}
            </div>`).join('') : '<p style="color:var(--text-muted);font-size:.875rem">Keine laufenden Aufträge</p>'}
        </div>

        <!-- Aufgaben heute -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">✅ Meine Aufgaben</span>
            <button class="btn btn-ghost btn-sm" onclick="navigateTo('aufgaben')">Alle →</button>
          </div>
          ${meinAufgaben.length ? meinAufgaben.slice(0,5).map(a => `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid var(--card-border)">
              <input type="checkbox" class="perm-checkbox" onchange="AufgabenModule.toggleErledigt('${a.id}', this.checked)" />
              <div style="flex:1">
                <div style="font-size:.875rem;font-weight:500">${a.titel}</div>
                ${a.faellig_am ? `<div style="font-size:.72rem;color:var(--text-muted)">Fällig: ${formatDate(a.faellig_am)}</div>` : ''}
              </div>
              ${getStatusBadge(a.prioritaet)}
            </div>`).join('') : '<p style="color:var(--text-muted);font-size:.875rem">Keine offenen Aufgaben 🎉</p>'}
        </div>
      </div>

      <!-- Angebote zum Nachfassen -->
      ${this.renderNachfassen(angebote)}

      <!-- Diagramme -->
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:1rem">
        <div class="chart-card">
          <div class="card-header"><span class="card-title">📈 Umsatz (letzte 6 Monate)</span></div>
          <canvas id="chart-umsatz"></canvas>
        </div>
        <div class="chart-card">
          <div class="card-header"><span class="card-title">📊 Aufträge nach Status</span></div>
          <canvas id="chart-status"></canvas>
        </div>
      </div>
    `);

    this.renderCharts(auftraege, rechnungen);
  },

  renderNachfassen(angebote) {
    const today = new Date(); today.setHours(0,0,0,0);
    const faellig = angebote.filter(a => {
      if (!a.erinnerung_am || a.status === 'angenommen' || a.status === 'abgelehnt') return false;
      return new Date(a.erinnerung_am) <= today;
    });
    if (!faellig.length) return '';
    return `
      <div class="card" style="border-left:4px solid var(--orange);margin-bottom:1rem">
        <div class="card-header"><span class="card-title">🔔 Angebote zum Nachfassen (${faellig.length})</span></div>
        ${faellig.map(a => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid var(--card-border)">
            <div>
              <div style="font-size:.875rem;font-weight:600">${a.nummer || '—'}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">Fällig seit: ${formatDate(a.erinnerung_am)}</div>
            </div>
            <button class="btn btn-warning btn-sm" onclick="navigateTo('anfragen')">Öffnen</button>
          </div>`).join('')}
      </div>`;
  },

  renderCharts(auftraege, rechnungen) {
    /* Umsatz Liniendiagramm */
    const umsatzCtx = document.getElementById('chart-umsatz');
    if (umsatzCtx) {
      const months = [];
      const data = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const key = d.toISOString().slice(0, 7);
        months.push(d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }));
        const sum = rechnungen.filter(r => r.bezahlt_am?.startsWith(key)).reduce((s, r) => s + (r.gesamt_brutto || 0), 0);
        data.push(sum);
      }
      new Chart(umsatzCtx, {
        type: 'line',
        data: { labels: months, datasets: [{ label: 'Umsatz €', data, borderColor: '#0d104a', backgroundColor: 'rgba(13,16,74,.1)', tension: 0.4, fill: true }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => `${(v/1000).toFixed(0)}k €` } } } },
      });
    }

    /* Status Kuchendiagramm */
    const statusCtx = document.getElementById('chart-status');
    if (statusCtx) {
      const statusCounts = {};
      auftraege.forEach(a => { statusCounts[a.workflow_status] = (statusCounts[a.workflow_status] || 0) + 1; });
      new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(statusCounts),
          datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#3b82f6','#f59e0b','#f97316','#8b5cf6','#22c55e','#6b7280'] }],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
      });
    }
  },
};
