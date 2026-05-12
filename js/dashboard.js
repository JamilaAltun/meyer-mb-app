/* ═══════════════════════════════════════════════════════
   DASHBOARD — Übersicht, KPIs, Diagramme, Aktivitäten
═══════════════════════════════════════════════════════ */

const DashboardModule = {
  _charts: [],

  async render() {
    const [auftraege, angebote, rechnungen, aufgaben, kunden] = await Promise.all([
      DB.getAll('auftraege'), DB.getAll('angebote'),
      DB.getAll('rechnungen'), DB.getAll('aufgaben'), DB.getAll('kunden'),
    ]);

    this._charts.forEach(c => { try { c.destroy(); } catch(e){} });
    this._charts = [];

    const today = new Date(); today.setHours(0,0,0,0);
    const kundenMap = {};
    kunden.forEach(k => kundenMap[k.id] = k);

    const offeneAngebote    = angebote.filter(a => a.status !== 'angenommen' && a.status !== 'abgelehnt');
    const laufendeAuftraege = auftraege.filter(a => a.workflow_status !== 'abgeschlossen');
    const offeneRechnungen  = rechnungen.filter(r => r.status === 'offen' || r.status === 'gesendet');
    const ueberfaellig      = rechnungen.filter(r => {
      if (r.status === 'bezahlt') return false;
      if (!r.datum) return false;
      const f = new Date(r.datum);
      f.setDate(f.getDate() + (parseInt(r.zahlungsziel) || 14));
      return f < today;
    });
    const meinAufgaben = aufgaben.filter(a =>
      !a.erledigt && (Auth.isAdmin() || (a.zugewiesen_an || []).includes(Auth.userId()))
    );

    const curMonth = new Date().toISOString().slice(0, 7);
    const prevMonth = (() => { const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })();

    const umsatzMonat = rechnungen.filter(r => r.bezahlt_am?.startsWith(curMonth)).reduce((s,r) => s+(r.gesamt_brutto||0), 0);
    const umsatzVormonat = rechnungen.filter(r => r.bezahlt_am?.startsWith(prevMonth)).reduce((s,r) => s+(r.gesamt_brutto||0), 0);
    const umsatzTrend = umsatzVormonat > 0 ? Math.round(((umsatzMonat - umsatzVormonat) / umsatzVormonat) * 100) : null;

    const greeting = (() => {
      const h = new Date().getHours();
      if (h < 12) return 'Guten Morgen';
      if (h < 18) return 'Guten Tag';
      return 'Guten Abend';
    })();
    const userName = Auth.currentUser?.name?.split(' ')[0] || Auth.currentUser?.name || '';

    setContent(`
      <!-- Willkommens-Header -->
      <div style="margin-bottom:1.75rem">
        <div style="font-size:1.5rem;font-weight:800;letter-spacing:-.03em;color:var(--text)">
          ${greeting}${userName ? `, ${userName}` : ''}! 👋
        </div>
        <div style="font-size:.875rem;color:var(--text-muted);margin-top:.25rem">
          ${new Date().toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
          &nbsp;·&nbsp; ${laufendeAuftraege.length} laufende Aufträge · ${offeneRechnungen.length} offene Rechnungen
        </div>
      </div>

      <!-- Schnellaktionen -->
      <div class="quick-actions">
        <button class="quick-action-btn" onclick="navigateTo('auftraege');setTimeout(()=>AuftraegeModule.openForm(),400)">
          <i class="fa-solid fa-plus"></i> Neuer Auftrag
        </button>
        <button class="quick-action-btn" onclick="navigateTo('rechnungen');setTimeout(()=>RechnungenModule.openForm(),400)">
          <i class="fa-solid fa-file-invoice-dollar"></i> Neue Rechnung
        </button>
        <button class="quick-action-btn" onclick="navigateTo('anfragen');setTimeout(()=>AnfragenModule.openForm(),400)">
          <i class="fa-solid fa-file-lines"></i> Neues Angebot
        </button>
        <button class="quick-action-btn" onclick="navigateTo('kunden');setTimeout(()=>KundenModule.openForm(),400)">
          <i class="fa-solid fa-user-plus"></i> Neuer Kunde
        </button>
      </div>

      <!-- KPI Grid -->
      <div class="kpi-grid">
        <div class="kpi-card" onclick="navigateTo('anfragen')">
          <div class="kpi-card-top">
            <div class="kpi-icon-wrap"><i class="fa-solid fa-file-lines"></i></div>
            <span class="kpi-trend neutral"><i class="fa-solid fa-minus" style="font-size:.6rem"></i> Offen</span>
          </div>
          <div>
            <div class="kpi-value">${offeneAngebote.length}</div>
            <div class="kpi-label">Offene Angebote</div>
          </div>
        </div>

        <div class="kpi-card orange" onclick="navigateTo('auftraege')">
          <div class="kpi-card-top">
            <div class="kpi-icon-wrap"><i class="fa-solid fa-clipboard-list"></i></div>
            <span class="kpi-trend neutral"><i class="fa-solid fa-bolt" style="font-size:.6rem"></i> Aktiv</span>
          </div>
          <div>
            <div class="kpi-value">${laufendeAuftraege.length}</div>
            <div class="kpi-label">Laufende Aufträge</div>
          </div>
        </div>

        <div class="kpi-card red" onclick="navigateTo('rechnungen')">
          <div class="kpi-card-top">
            <div class="kpi-icon-wrap"><i class="fa-solid fa-file-invoice-dollar"></i></div>
            <span class="kpi-trend ${ueberfaellig.length ? 'down' : 'neutral'}">
              ${ueberfaellig.length ? `<i class="fa-solid fa-triangle-exclamation" style="font-size:.6rem"></i> ${ueberfaellig.length} überfällig` : '<i class="fa-solid fa-check" style="font-size:.6rem"></i> OK'}
            </span>
          </div>
          <div>
            <div class="kpi-value">${offeneRechnungen.length}</div>
            <div class="kpi-label">Offene Rechnungen</div>
          </div>
        </div>

        <div class="kpi-card green" onclick="navigateTo('rechnungen')">
          <div class="kpi-card-top">
            <div class="kpi-icon-wrap"><i class="fa-solid fa-euro-sign"></i></div>
            ${umsatzTrend !== null ? `<span class="kpi-trend ${umsatzTrend >= 0 ? 'up' : 'down'}">
              <i class="fa-solid fa-arrow-${umsatzTrend >= 0 ? 'up' : 'down'}" style="font-size:.6rem"></i> ${Math.abs(umsatzTrend)}%
            </span>` : '<span class="kpi-trend neutral">Monat</span>'}
          </div>
          <div>
            <div class="kpi-value kpi-currency">${formatCurrency(umsatzMonat)}</div>
            <div class="kpi-label">Umsatz diesen Monat</div>
          </div>
        </div>

        <div class="kpi-card purple" onclick="navigateTo('aufgaben')">
          <div class="kpi-card-top">
            <div class="kpi-icon-wrap"><i class="fa-solid fa-list-check"></i></div>
            <span class="kpi-trend ${meinAufgaben.length > 5 ? 'down' : 'neutral'}">Meine</span>
          </div>
          <div>
            <div class="kpi-value">${meinAufgaben.length}</div>
            <div class="kpi-label">Offene Aufgaben</div>
          </div>
        </div>

        <div class="kpi-card" onclick="navigateTo('kunden')">
          <div class="kpi-card-top">
            <div class="kpi-icon-wrap"><i class="fa-solid fa-users"></i></div>
            <span class="kpi-trend neutral">Gesamt</span>
          </div>
          <div>
            <div class="kpi-value">${kunden.length}</div>
            <div class="kpi-label">Kunden</div>
          </div>
        </div>
      </div>

      <!-- Hauptbereich: Linke Seite + Rechte Sidebar -->
      <div class="dash-side-grid">
        <!-- Linke Spalte -->
        <div style="display:flex;flex-direction:column;gap:1.125rem;min-width:0">

          <!-- Umsatz-Chart -->
          <div class="chart-card">
            <div class="card-header">
              <div>
                <div class="card-title">Umsatzentwicklung</div>
                <div class="card-subtitle">Eingehende Zahlungen der letzten 6 Monate</div>
              </div>
            </div>
            <canvas id="chart-umsatz"></canvas>
          </div>

          <!-- Angebote Nachfassen -->
          ${this.renderNachfassen(angebote)}

          <!-- Aktuelle Aufträge -->
          <div class="card" style="padding:0;overflow:hidden">
            <div class="card-header" style="padding:1.125rem 1.375rem;border-bottom:1px solid var(--card-border);margin:0">
              <div>
                <div class="card-title">Aktuelle Aufträge</div>
                <div class="card-subtitle">${laufendeAuftraege.length} in Bearbeitung</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="navigateTo('auftraege')">Alle anzeigen →</button>
            </div>
            ${laufendeAuftraege.length ? `
              <table>
                <thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Kunde</th><th>Status</th><th>Wert</th></tr></thead>
                <tbody>
                  ${laufendeAuftraege.slice(0,6).map(a => {
                    const k = kundenMap[a.kunde_id];
                    return `<tr onclick="navigateTo('auftraege')">
                      <td><strong>${a.nummer || '—'}</strong></td>
                      <td>${a.bezeichnung || '—'}</td>
                      <td>${k ? (k.firma || k.name) : '—'}</td>
                      <td>${getStatusBadge(a.workflow_status)}</td>
                      <td>${a.auftragswert ? formatCurrency(a.auftragswert) : '—'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>` : `<div class="table-empty"><div class="table-empty-icon"><i class="fa-regular fa-clipboard"></i></div><div class="table-empty-text">Keine laufenden Aufträge</div></div>`}
          </div>
        </div>

        <!-- Rechte Sidebar -->
        <div style="display:flex;flex-direction:column;gap:1.125rem">

          <!-- Status Donut -->
          <div class="chart-card">
            <div class="card-header">
              <div class="card-title">Aufträge nach Status</div>
            </div>
            <canvas id="chart-status"></canvas>
          </div>

          <!-- Meine Aufgaben -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Meine Aufgaben</div>
              <button class="btn btn-ghost btn-sm" onclick="navigateTo('aufgaben')">Alle →</button>
            </div>
            ${meinAufgaben.length ? `
              <div style="display:flex;flex-direction:column;gap:0">
                ${meinAufgaben.slice(0,5).map(a => `
                  <div style="display:flex;align-items:flex-start;gap:.75rem;padding:.6rem 0;border-bottom:1px solid var(--card-border)">
                    <input type="checkbox" style="margin-top:.2rem;width:15px;height:15px;accent-color:var(--blue);cursor:pointer;flex-shrink:0"
                      onchange="AufgabenModule.toggleErledigt('${a.id}',this.checked)" />
                    <div style="flex:1;min-width:0">
                      <div style="font-size:.855rem;font-weight:500;color:var(--text);line-height:1.3">${a.titel}</div>
                      ${a.faellig_am ? `<div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem"><i class="fa-regular fa-clock"></i> ${formatDate(a.faellig_am)}</div>` : ''}
                    </div>
                    ${getStatusBadge(a.prioritaet)}
                  </div>`).join('')}
              </div>` : `<p style="color:var(--text-muted);font-size:.875rem;text-align:center;padding:1rem 0">Keine offenen Aufgaben ✓</p>`}
          </div>

          <!-- Überfällige Rechnungen -->
          ${ueberfaellig.length ? `
            <div class="card" style="border-left:4px solid var(--red)">
              <div class="card-header">
                <div class="card-title" style="color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i> ${ueberfaellig.length} überfällig</div>
              </div>
              ${ueberfaellig.slice(0,3).map(r => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--card-border);font-size:.855rem">
                  <div>
                    <div style="font-weight:600">${r.nummer || '—'}</div>
                    <div style="font-size:.75rem;color:var(--text-muted)">${formatCurrency(r.gesamt_brutto || 0)}</div>
                  </div>
                  <button class="btn btn-danger btn-sm" onclick="navigateTo('rechnungen')">Öffnen</button>
                </div>`).join('')}
            </div>` : ''}
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
      <div class="nachfassen-card">
        <div class="card-header" style="margin:0 0 .75rem">
          <div>
            <div class="card-title"><i class="fa-solid fa-bell" style="color:var(--orange)"></i> Angebote nachfassen</div>
            <div class="card-subtitle">${faellig.length} Angebot${faellig.length>1?'e':''} warten auf Rückmeldung</div>
          </div>
        </div>
        ${faellig.map(a => `
          <div class="nachfassen-item">
            <div>
              <div style="font-size:.875rem;font-weight:600">${a.nummer || '—'}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">Fällig seit ${formatDate(a.erinnerung_am)}</div>
            </div>
            <button class="btn btn-warning btn-sm" onclick="navigateTo('anfragen')">Anzeigen</button>
          </div>`).join('')}
      </div>`;
  },

  renderCharts(auftraege, rechnungen) {
    const defaults = {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {},
    };

    /* Umsatz Liniendiagramm */
    const umsatzCtx = document.getElementById('chart-umsatz');
    if (umsatzCtx) {
      const months = [], data = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }));
        data.push(rechnungen.filter(r => r.bezahlt_am?.startsWith(d.toISOString().slice(0,7))).reduce((s,r) => s+(r.gesamt_brutto||0), 0));
      }
      const gradient = umsatzCtx.getContext('2d').createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, 'rgba(37,99,235,.18)');
      gradient.addColorStop(1, 'rgba(37,99,235,.01)');
      this._charts.push(new Chart(umsatzCtx, {
        type: 'line',
        data: { labels: months, datasets: [{ label: 'Umsatz €', data, borderColor: '#2563eb', backgroundColor: gradient, tension: 0.45, fill: true, pointBackgroundColor: '#2563eb', pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 }] },
        options: { ...defaults, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${formatCurrency(c.raw)}` } } }, scales: { y: { ticks: { callback: v => `${(v/1000).toFixed(0)}k €`, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.04)' } }, x: { grid: { display: false } } } },
      }));
    }

    /* Status Donut */
    const statusCtx = document.getElementById('chart-status');
    if (statusCtx) {
      const WORKFLOW_LABELS = { angebot:'Angebot', auftrag:'Auftrag', fertigung:'Fertigung', montage:'Montage', rechnung:'Rechnung', abgeschlossen:'Fertig' };
      const counts = {};
      auftraege.forEach(a => { counts[a.workflow_status] = (counts[a.workflow_status]||0) + 1; });
      const labels = Object.keys(counts).map(k => WORKFLOW_LABELS[k] || k);
      this._charts.push(new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data: Object.values(counts), backgroundColor: ['#2563eb','#f59e0b','#f97316','#8b5cf6','#3b82f6','#10b981'], borderWidth: 2, borderColor: 'var(--card)' }],
        },
        options: { responsive: true, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { font: { size: 11, family: 'Inter' }, padding: 12, boxWidth: 12, borderRadius: 3 } } } },
      }));
    }
  },
};
