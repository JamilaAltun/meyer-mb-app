/* ═══════════════════════════════════════════════════════
   KARTE — Auftragsmap Deutschland (Leaflet + OpenStreetMap)
═══════════════════════════════════════════════════════ */

const KarteModule = {
  _map:          null,
  _markers:      [],
  _auftraege:    [],
  _kundenMap:    {},
  _filterStatus: 'alle',
  _geocacheKey:  'mmg_geocache_v1',
  _geocodeQueue: null,

  async render() {
    const [auftraege, kunden] = await Promise.all([
      DB.getAll('auftraege'),
      DB.getAll('kunden'),
    ]);

    this._auftraege    = auftraege;
    this._kundenMap    = {};
    this._geocodeQueue = Promise.resolve();
    kunden.forEach(k => { this._kundenMap[k.id] = k; });

    const aktiv         = auftraege.filter(a => a.workflow_status !== 'abgeschlossen').length;
    const inMontage     = auftraege.filter(a => a.workflow_status === 'montage').length;
    const abgeschlossen = auftraege.filter(a => a.workflow_status === 'abgeschlossen').length;

    setContent(`
      <div class="module-header">
        <div>
          <div class="module-title">Auftragsmap</div>
          <div class="module-subtitle">${auftraege.length} Aufträge · Deutschland</div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
          <div class="karte-stat-pill" style="background:var(--blue-50);color:var(--blue)">
            <i class="fa-solid fa-circle-dot"></i> ${aktiv} Aktiv
          </div>
          <div class="karte-stat-pill" style="background:var(--purple-light);color:var(--purple)">
            <i class="fa-solid fa-screwdriver-wrench"></i> ${inMontage} Montage
          </div>
          <div class="karte-stat-pill" style="background:var(--green-light);color:var(--green)">
            <i class="fa-solid fa-circle-check"></i> ${abgeschlossen} Fertig
          </div>
        </div>
      </div>

      <div class="table-toolbar" style="margin-bottom:.75rem">
        <div class="filter-chips" id="karte-filter-chips">
          ${['alle', ...WORKFLOW].map(s => `
            <div class="chip${this._filterStatus === s ? ' active' : ''}"
                 onclick="KarteModule.setFilter('${s}')">
              ${s === 'alle' ? 'Alle' : WORKFLOW_LABELS[s]}
            </div>`).join('')}
        </div>
        <span class="table-count" id="karte-count">${auftraege.length} Aufträge</span>
      </div>

      <div id="auftraege-karte" style="border-radius:12px;overflow:hidden;box-shadow:0 4px 8px rgba(0,0,0,.08);border:1px solid var(--card-border);background:var(--bg)"></div>
    `);

    /* Warte bis Browser gerendert hat, dann Höhe berechnen */
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));

    const el = document.getElementById('auftraege-karte');
    if (!el) return;

    const top    = el.getBoundingClientRect().top;
    const height = Math.max(420, window.innerHeight - top - 24);
    el.style.height = height + 'px';

    await this._initMap(el);
  },

  setFilter(status) {
    this._filterStatus = status;
    document.querySelectorAll('#karte-filter-chips .chip').forEach((chip, i) => {
      chip.classList.toggle('active', ['alle', ...WORKFLOW][i] === status);
    });
    const n = status === 'alle'
      ? this._auftraege.length
      : this._auftraege.filter(a => a.workflow_status === status).length;
    const el = document.getElementById('karte-count');
    if (el) el.textContent = `${n} Aufträge`;
    this._refreshMarkers();
  },

  async _initMap(el) {
    if (this._map) { this._map.remove(); this._map = null; }
    this._markers = [];

    if (typeof L === 'undefined') {
      el.innerHTML = `<div class="karte-loading">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Karte konnte nicht geladen werden – bitte Seite neu laden.
      </div>`;
      return;
    }

    this._map = L.map(el, {
      center:      [51.3, 10.5],
      zoom:        6,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this._map);

    setTimeout(() => this._map?.invalidateSize(), 150);

    this._addLegend();

    if (this._auftraege.length === 0) {
      this._showEmptyHint();
    } else {
      await this._refreshMarkers();
    }
  },

  _showEmptyHint() {
    if (!this._map) return;
    const info = L.control({ position: 'topright' });
    info.onAdd = () => {
      const d = L.DomUtil.create('div');
      d.innerHTML = `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem 1rem;font-family:Inter,sans-serif;font-size:.82rem;color:#64748b;box-shadow:0 2px 8px rgba(0,0,0,.1)">
        <i class="fa-solid fa-info-circle"></i> Noch keine Aufträge vorhanden
      </div>`;
      return d;
    };
    info.addTo(this._map);
  },

  async _refreshMarkers() {
    if (!this._map) return;

    this._markers.forEach(m => m.remove());
    this._markers = [];

    const visible = this._filterStatus === 'alle'
      ? this._auftraege
      : this._auftraege.filter(a => a.workflow_status === this._filterStatus);

    const byKunde = {};
    visible.forEach(a => {
      if (!byKunde[a.kunde_id]) byKunde[a.kunde_id] = [];
      byKunde[a.kunde_id].push(a);
    });

    for (const [kundeId, orders] of Object.entries(byKunde)) {
      const kunde = this._kundenMap[kundeId];
      if (!kunde?.ort) continue;

      const coords = await this._geocode(kunde.plz, kunde.ort);
      if (!coords || !this._map) continue;

      const color = this._dominantColor(orders);
      const icon  = L.divIcon({
        className:   '',
        html:        `<div class="karte-marker" style="--mc:${color}">${orders.length > 1 ? orders.length : ''}</div>`,
        iconSize:    [36, 36],
        iconAnchor:  [18, 18],
        popupAnchor: [0, -20],
      });

      const marker = L.marker([coords.lat, coords.lng], { icon });
      marker.bindPopup(this._buildPopup(orders, kunde), { maxWidth: 310, minWidth: 240 });
      marker.addTo(this._map);
      this._markers.push(marker);
    }
  },

  _dominantColor(orders) {
    const priority = ['montage', 'fertigung', 'auftrag', 'rechnung', 'angebot', 'abgeschlossen'];
    const set = new Set(orders.map(o => o.workflow_status));
    for (const s of priority) {
      if (set.has(s)) return KANBAN_DOT_COLORS[s] || '#6b7280';
    }
    return '#6b7280';
  },

  _buildPopup(orders, kunde) {
    const name    = kunde.firma || kunde.name || '—';
    const adresse = [kunde.strasse, `${kunde.plz || ''} ${kunde.ort || ''}`.trim()].filter(Boolean).join(', ');
    const rows    = orders.map(a => {
      const wert = a.auftragswert
        ? Number(a.auftragswert).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
        : '';
      return `
        <div class="karte-popup-order">
          <span class="badge ${WORKFLOW_COLORS[a.workflow_status] || ''}">${WORKFLOW_LABELS[a.workflow_status] || a.workflow_status}</span>
          <div class="karte-popup-order-info">
            <div class="karte-popup-order-title">${a.bezeichnung || a.nummer || '—'}</div>
            ${a.nummer || wert ? `<div class="karte-popup-order-meta">${[a.nummer, wert].filter(Boolean).join(' · ')}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="karte-popup-inner">
        <div class="karte-popup-header">
          <div class="karte-popup-kunde">${name}</div>
          ${adresse ? `<div class="karte-popup-addr"><i class="fa-solid fa-location-dot"></i> ${adresse}</div>` : ''}
        </div>
        <div class="karte-popup-orders">${rows}</div>
        <div class="karte-popup-footer">
          <button class="btn btn-secondary btn-sm" onclick="navigateTo('auftraege')">
            <i class="fa-solid fa-arrow-right"></i> Zu Aufträgen
          </button>
        </div>
      </div>`;
  },

  _addLegend() {
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'karte-legend');
      div.innerHTML = `
        <div class="karte-legend-title">Status</div>
        ${WORKFLOW.map(s => `
          <div class="karte-legend-row">
            <span class="karte-legend-dot" style="background:${KANBAN_DOT_COLORS[s]}"></span>
            <span>${WORKFLOW_LABELS[s]}</span>
          </div>`).join('')}`;
      return div;
    };
    legend.addTo(this._map);
  },

  _geocode(plz, ort) {
    this._geocodeQueue = this._geocodeQueue.then(() => this._doGeocode(plz, ort));
    return this._geocodeQueue;
  },

  async _doGeocode(plz, ort) {
    const cache = JSON.parse(localStorage.getItem(this._geocacheKey) || '{}');
    const key   = `${plz || ''}-${ort}`.replace(/\s+/g, '').toLowerCase();
    if (cache[key]) return cache[key];

    try {
      await new Promise(r => setTimeout(r, 350));
      const q   = encodeURIComponent(`${plz || ''} ${ort}, Deutschland`.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=de`,
        { headers: { 'Accept-Language': 'de' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        cache[key]   = coords;
        localStorage.setItem(this._geocacheKey, JSON.stringify(cache));
        return coords;
      }
    } catch (e) {
      console.warn('Geocoding fehlgeschlagen:', plz, ort, e);
    }
    return null;
  },
};
