/* ═══════════════════════════════════════════════════════
   APP.JS — Router, Navigation, Initialisierung
═══════════════════════════════════════════════════════ */

let currentModule = null;

/* ── Globale Hilfsfunktionen ── */
function showToast(message, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${message}</span>
    <span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function openModal(title, bodyHtml, onConfirm, confirmLabel = 'OK', size = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const footer = document.getElementById('modal-footer');
  if (onConfirm) {
    footer.classList.remove('hidden');
    footer.innerHTML = `
      <button class="btn btn-secondary" id="modal-cancel-btn">Abbrechen</button>
      <button class="btn btn-primary" id="modal-confirm-btn">${confirmLabel}</button>`;
    document.getElementById('modal-confirm-btn').onclick = onConfirm;
    document.getElementById('modal-cancel-btn').onclick = closeModal;
  } else {
    footer.classList.add('hidden');
  }
  if (size) document.getElementById('modal-box').style.maxWidth = size;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-box').style.maxWidth = '';
  document.getElementById('modal-footer').innerHTML = '';
}

function confirmDelete(name, onConfirm) {
  openModal('Löschen bestätigen',
    `<p>Soll <strong>${name}</strong> wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.</p>`,
    onConfirm, 'Ja, löschen');
  document.getElementById('modal-confirm-btn').className = 'btn btn-danger';
}

function setContent(html) {
  document.getElementById('main-content').innerHTML = html;
}

/* ── Router ── */
const modules = {
  dashboard:       () => DashboardModule.render(),
  kunden:          () => KundenModule.render(),
  anfragen:        () => AnfragenModule.render(),
  auftraege:       () => AuftraegeModule.render(),
  nachkalkulation: () => NachkalkulationModule.render(),
  rechnungen:      () => RechnungenModule.render(),
  aufgaben:        () => AufgabenModule.render(),
  kalender:        () => KalenderModule.render(),
  chat:            () => ChatModule.render(),
  urlaub:          () => UrlaubModule.render(),
  tickets:         () => TicketsModule.render(),
  einstellungen:   () => EinstellungenModule.render(),
};

async function navigateTo(moduleName) {
  if (!Auth.can(moduleName) && moduleName !== 'dashboard') {
    showToast('Kein Zugriff auf diesen Bereich', 'error');
    return;
  }

  currentModule = moduleName;

  /* Sidebar aktiv-Klasse */
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-module') === moduleName);
  });

  /* Topbar Titel */
  const labels = {
    dashboard: '🏠 Dashboard', kunden: '👥 Kunden',
    anfragen: '📨 Anfragen & Angebote', auftraege: '📋 Aufträge',
    nachkalkulation: '📊 Nachkalkulation', rechnungen: '🧾 Rechnungen',
    aufgaben: '✅ Aufgaben', kalender: '📅 Kalender',
    chat: '💬 Chat', urlaub: '🏖️ Urlaub',
    tickets: '🎫 Tickets', einstellungen: '⚙️ Einstellungen',
  };
  document.getElementById('topbar-title').textContent = labels[moduleName] || moduleName;

  /* Sidebar auf Mobil schließen */
  closeSidebar();

  /* Modul rendern */
  setContent('<div class="content-loading"><div class="spinner"></div><p>Laden...</p></div>');
  try {
    await modules[moduleName]?.();
  } catch (e) {
    console.error('Modul-Fehler:', e);
    setContent(`<div class="content-loading"><p>Fehler beim Laden. <button class="btn btn-secondary btn-sm" onclick="navigateTo('${moduleName}')">Erneut versuchen</button></p></div>`);
  }
}

/* ── App initialisieren ── */
async function initApp() {
  const u = Auth.currentUser;
  if (!u) return;

  /* Benutzeranzeige */
  updateUserDisplay();

  /* Logo aus Einstellungen */
  const settings = Settings.get();
  if (settings.logo_url) {
    document.getElementById('sidebar-logo-img').src = settings.logo_url;
  }

  /* Berechtigungen anwenden */
  applyPermissions();

  /* Navigation */
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.getAttribute('data-module'));
    });
  });

  /* Profil-Panel */
  initProfilePanel();

  /* Zeiterfassung-Widget */
  ZeiterfassungModule.initWidget();

  /* Sidebar Mobile */
  document.getElementById('hamburger-btn').addEventListener('click', openSidebar);
  document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  /* Modal schließen */
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  /* Globale Suche */
  initGlobalSearch();

  /* Dark Mode wiederherstellen */
  const savedTheme = localStorage.getItem('mmg_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  /* Sync-Indikator */
  const syncDiv = document.createElement('div');
  syncDiv.className = 'sync-indicator';
  syncDiv.innerHTML = '<div class="sync-dot online"></div><span class="sync-label">Online</span>';
  document.body.appendChild(syncDiv);

  /* Notifications prüfen */
  NotificationsModule.checkAndShow();

  /* Badge-Zähler */
  updateBadges();

  /* Start-Modul */
  const startModule = Auth.can('dashboard') ? 'dashboard' : Object.keys(modules).find(m => Auth.can(m)) || 'dashboard';
  navigateTo(startModule);
}

/* ── Sidebar Mobile Funktionen ── */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
  document.getElementById('sidebar-overlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

/* ── Globale Suche ── */
function initGlobalSearch() {
  const input = document.getElementById('global-search');
  const results = document.getElementById('search-results');
  let searchTimer;

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { results.classList.add('hidden'); return; }
    searchTimer = setTimeout(async () => {
      const found = await DB.search([
        { table: 'kunden', label: 'Kunde', icon: '👥', fields: ['name', 'firma', 'telefon'] },
        { table: 'auftraege', label: 'Auftrag', icon: '📋', fields: ['nummer', 'bezeichnung'] },
        { table: 'angebote', label: 'Angebot', icon: '📨', fields: ['nummer'] },
        { table: 'rechnungen', label: 'Rechnung', icon: '🧾', fields: ['nummer'] },
        { table: 'aufgaben', label: 'Aufgabe', icon: '✅', fields: ['titel', 'beschreibung'] },
      ], q);
      if (!found.length) {
        results.innerHTML = '<div class="search-result-item" style="color:var(--text-muted)">Keine Ergebnisse</div>';
      } else {
        results.innerHTML = found.map(f =>
          `<div class="search-result-item" data-table="${f.table}" data-id="${f.row.id}">
            <span>${f.icon}</span>
            <span class="search-result-type">${f.label}</span>
            <span>${f.display}</span>
          </div>`
        ).join('');
        results.querySelectorAll('.search-result-item[data-table]').forEach(el => {
          el.addEventListener('click', () => {
            navigateTo(el.dataset.table === 'aufgaben' ? 'aufgaben' : el.dataset.table);
            results.classList.add('hidden');
            input.value = '';
          });
        });
      }
      results.classList.remove('hidden');
    }, 250);
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.add('hidden');
    }
  });
}

/* ── Badge-Zähler ── */
async function updateBadges() {
  try {
    const userId = Auth.userId();

    /* Aufgaben (offene, zugewiesene) */
    const aufgaben = await DB.getAll('aufgaben');
    const offeneAufgaben = aufgaben.filter(a => !a.erledigt && (Auth.isAdmin() || (a.zugewiesen_an || []).includes(userId)));
    setBadge('aufgaben', offeneAufgaben.length);

    /* Tickets (offene) */
    const tickets = await DB.getAll('tickets', Auth.isAdmin() ? {} : { erstellt_von: userId });
    const offeneTickets = tickets.filter(t => t.status !== 'erledigt');
    setBadge('tickets', offeneTickets.length);

    /* Chat (ungelesene) */
    const msgs = await DB.getAll('chat_nachrichten', { an_user_id: userId });
    const ungelesen = msgs.filter(m => !m.gelesen);
    setBadge('chat', ungelesen.length);

    /* Urlaub (ausstehende Anträge, nur Admin) */
    if (Auth.isAdmin()) {
      const urlaub = await DB.getAll('urlaub', { status: 'abwartend' });
      setBadge('urlaub', urlaub.length);
    }
  } catch (e) { /* still offline? */ }
}

function setBadge(module, count) {
  const badge = document.getElementById(`badge-${module}`);
  if (!badge) return;
  if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.classList.remove('hidden'); }
  else { badge.classList.add('hidden'); }
}

/* ── APP STARTEN ── */
/* Service Worker registrieren */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'SYNC_REQUESTED') syncPendingData?.();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initStorage();
  Auth.loadSession();

  if (Auth.currentUser) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    initApp();
  } else {
    await initLogin();
  }
});
