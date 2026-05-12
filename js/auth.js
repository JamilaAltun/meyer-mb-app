/* ═══════════════════════════════════════════════════════
   AUTH — Login, PIN, Session, Berechtigungen
═══════════════════════════════════════════════════════ */

const Auth = {
  currentUser: null,

  /* Session laden */
  loadSession() {
    try {
      const s = sessionStorage.getItem('mmg_session');
      if (s) this.currentUser = JSON.parse(s);
    } catch { this.currentUser = null; }
  },

  /* Session speichern */
  saveSession(user) {
    this.currentUser = user;
    sessionStorage.setItem('mmg_session', JSON.stringify(user));
  },

  /* Logout */
  logout() {
    this.currentUser = null;
    sessionStorage.removeItem('mmg_session');
  },

  /* Berechtigung prüfen */
  can(permission) {
    if (!this.currentUser) return false;
    if (this.currentUser.rolle === 'admin') return true;
    if (permission === 'zeiterfassung') return true; // jeder Mitarbeiter hat Zugriff
    if (permission === 'team') return true;           // jeder Mitarbeiter sieht das Team
    const perms = this.currentUser.berechtigungen || {};
    return !!perms[permission];
  },

  /* Ist Admin? */
  isAdmin() {
    return this.currentUser?.rolle === 'admin';
  },

  /* Aktuelle Benutzer-ID */
  userId() {
    return this.currentUser?.id;
  },

  /* Anzeigename */
  userName() {
    return this.currentUser?.name || 'Unbekannt';
  },
};

/* ── Login-Screen initialisieren ── */
async function initLogin() {
  const screen = document.getElementById('login-screen');
  const app = document.getElementById('app-shell');
  const select = document.getElementById('login-user-select');
  const pinInput = document.getElementById('login-pin');
  const loginBtn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  /* Sicherstellen dass Demo-Nutzer vorhanden (erster Start) */
  await ensureDefaultUsers();

  /* Mitarbeiterliste laden */
  const users = await DB.getAll('users');
  select.innerHTML = '<option value="">— Bitte wählen —</option>';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.name + (u.position ? ` (${u.position})` : '');
    select.appendChild(opt);
  });

  /* Logo aus Einstellungen */
  const settings = Settings.get();
  if (settings.logo_url) {
    const logoEl = document.getElementById('login-logo-img');
    if (logoEl) logoEl.src = settings.logo_url;
  }

  /* Login-Button */
  loginBtn.onclick = async () => {
    errorEl.classList.add('hidden');
    const userId = select.value;
    const pin = pinInput.value;

    if (!userId) { showError('Bitte einen Mitarbeiter auswählen.'); return; }
    if (!pin) { showError('Bitte PIN eingeben.'); return; }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Anmelden...';

    try {
      const user = await DB.getById('users', userId);
      if (!user) { showError('Benutzer nicht gefunden.'); return; }

      /* PIN prüfen (einfacher Hash-Vergleich) */
      const pinHash = simpleHash(pin);
      if (user.pin_hash !== pinHash && user.pin_hash !== pin) {
        showError('Falscher PIN. Bitte erneut versuchen.');
        return;
      }

      /* Einloggen */
      Auth.saveSession(user);
      screen.classList.add('hidden');
      app.classList.remove('hidden');
      initApp();

    } catch (e) {
      showError('Fehler beim Anmelden. Bitte erneut versuchen.');
      console.error(e);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Anmelden';
    }
  };

  /* Enter-Taste */
  pinInput.addEventListener('keyup', e => { if (e.key === 'Enter') loginBtn.click(); });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    pinInput.value = '';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Anmelden';
  }
}

/* ── Profil-Panel ── */
function initProfilePanel() {
  const panel = document.getElementById('profile-panel');
  const overlay = document.getElementById('profile-overlay');
  const closeBtn = document.getElementById('profile-close-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const darkToggle = document.getElementById('darkmode-toggle');
  const editBtn = document.getElementById('profile-edit-btn');
  const userEl = document.getElementById('sidebar-user');

  const open = () => {
    const u = Auth.currentUser;
    if (!u) return;
    document.getElementById('profile-avatar-large').textContent = u.name?.charAt(0).toUpperCase() || '?';
    document.getElementById('profile-name-display').textContent = u.name || '—';
    document.getElementById('profile-position-display').textContent = u.position || '—';

    const fields = document.getElementById('profile-fields');
    fields.innerHTML = [
      ['Adresse', u.adresse],
      ['Telefon', u.telefon],
      ['E-Mail', u.email],
      ['Position', u.position],
    ].filter(([, v]) => v).map(([l, v]) =>
      `<div class="profile-field-row">
        <span class="profile-field-label">${l}</span>
        <span class="profile-field-value">${v}</span>
      </div>`
    ).join('');

    darkToggle.checked = document.documentElement.getAttribute('data-theme') === 'dark';
    panel.classList.remove('hidden');
    overlay.classList.remove('hidden');
  };

  const close = () => {
    panel.classList.add('hidden');
    overlay.classList.add('hidden');
  };

  userEl.addEventListener('click', open);
  userEl.addEventListener('keyup', e => { if (e.key === 'Enter') open(); });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);

  logoutBtn.addEventListener('click', () => {
    if (typeof ZeiterfassungModule !== 'undefined') {
      const zs = ZeiterfassungModule;
      if (zs.state && zs.state.status === 'working') {
        const now = new Date().toISOString();
        zs.state.status = 'paused';
        zs.state.pauseStart = now;
        if (zs.state.log) zs.state.log.push({ type: 'pause', time: now });
        zs.saveState();
      }
      clearInterval(zs.timerInterval);
      clearInterval(zs._teamRefreshInterval);
      zs.timerInterval = null;
      zs.state = null;
      zs.userTab = null;
    }
    Auth.logout();
    close();
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-pin').value = '';
  });

  darkToggle.addEventListener('change', () => {
    const isDark = darkToggle.checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('mmg_theme', isDark ? 'dark' : 'light');
  });

  editBtn.addEventListener('click', () => {
    close();
    openProfileEditModal();
  });
}

function openProfileEditModal() {
  const u = Auth.currentUser;
  if (!u) return;
  openModal('Profil bearbeiten', `
    <div class="form-group"><label class="form-label">Name</label>
      <input class="form-input" id="pe-name" value="${u.name || ''}" /></div>
    <div class="form-group"><label class="form-label">Adresse</label>
      <input class="form-input" id="pe-adresse" value="${u.adresse || ''}" /></div>
    <div class="form-group"><label class="form-label">Telefon</label>
      <input class="form-input" id="pe-telefon" value="${u.telefon || ''}" /></div>
    <div class="form-group"><label class="form-label">E-Mail</label>
      <input class="form-input" id="pe-email" value="${u.email || ''}" /></div>
  `, async () => {
    const updates = {
      name: document.getElementById('pe-name').value.trim(),
      adresse: document.getElementById('pe-adresse').value.trim(),
      telefon: document.getElementById('pe-telefon').value.trim(),
      email: document.getElementById('pe-email').value.trim(),
    };
    await DB.update('users', u.id, updates);
    Auth.saveSession({ ...u, ...updates });
    updateUserDisplay();
    closeModal();
    showToast('Profil gespeichert', 'success');
  }, 'Speichern');
}

/* ── Sidebar-Nutzer aktualisieren ── */
function updateUserDisplay() {
  const u = Auth.currentUser;
  if (!u) return;
  document.getElementById('user-name').textContent = u.name || '—';
  document.getElementById('user-position').textContent = u.position || '—';
  document.getElementById('user-avatar').textContent = u.name?.charAt(0).toUpperCase() || '?';
}

/* ── Navigation nach Berechtigungen filtern ── */
function applyPermissions() {
  const navItems = document.querySelectorAll('[data-perm]');
  navItems.forEach(item => {
    const perm = item.getAttribute('data-perm');
    if (!Auth.can(perm)) {
      item.style.display = 'none';
    } else {
      item.style.display = '';
    }
  });
}

/* ── Demo-Nutzer anlegen (erster Start) ── */
async function ensureDefaultUsers() {
  const users = await DB.getAll('users');
  if (users.length > 0) return;

  const defaults = [
    { id: 'admin-001', name: 'Admin', position: 'Administrator', rolle: 'admin',
      pin_hash: simpleHash('1234'), telefon: '', adresse: '', email: 'admin@meyer-metallbau.de',
      berechtigungen: allPerms(), stundensatz: 0, urlaub_tage_gesamt: 30, dark_mode: false,
      erstellt_am: new Date().toISOString() },
  ];

  for (const u of defaults) await DB.insert('users', u);
  LS.set('users', defaults);

  /* Beispieldaten beim ersten Start automatisch laden */
  DemoData.seed();

  /* Standard-Einstellungen */
  if (!Settings.get().firma_name) {
    Settings.set({
      firma_name: 'Meyer Metallbau GmbH',
      strasse: '', plz: '', ort: '', telefon: '', email: '',
      steuernummer: '', ust_id: '', iban: '', bic: '', geschaeftsfuehrer: '',
      logo_url: '', zahlungsziel_standard: '14 Tage netto', skonto_text: '',
      angebot_startnummer: 1, rechnung_startnummer: 1,
    });
  }
}

function allPerms() {
  return { dashboard: true, kunden: true, anfragen: true, auftraege: true, nachkalkulation: true,
    rechnungen: true, aufgaben: true, kalender: true, zeiterfassung: true, chat: true, urlaub: true, tickets: true, einstellungen: true, team: true };
}

/* Einfacher Hash für PINs (nicht kryptografisch sicher, ausreichend für lokale App) */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'h' + Math.abs(hash).toString(36);
}
