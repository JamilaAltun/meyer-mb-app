/* ═══════════════════════════════════════════════════════
   TEAM — Mitarbeiterübersicht mit Profilen & Fotos
═══════════════════════════════════════════════════════ */

const TeamModule = {
  searchQuery: '',
  filterRole: 'alle',
  viewMode: 'grid',
  _allUsers: [],
  _allAufgaben: [],
  _allZeiten: [],

  async render() {
    const adminBtn = Auth.isAdmin()
      ? '<button class="btn btn-primary" onclick="TeamModule.openAddMember()" style="display:flex;align-items:center;gap:.5rem"><i class="fa-solid fa-user-plus"></i> Mitarbeiter hinzufügen</button>'
      : '';

    setContent(
      '<div class="module-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.75rem">' +
        '<div>' +
          '<div class="module-title" style="font-size:1.5rem;font-weight:800;color:var(--navy)">Team</div>' +
          '<div style="font-size:.875rem;color:var(--text-muted);margin-top:.2rem">Alle Mitarbeiter im Überblick</div>' +
        '</div>' +
        adminBtn +
      '</div>' +

      '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem">' +
        '<div style="position:relative;flex:1;min-width:200px;max-width:340px">' +
          '<i class="fa-solid fa-magnifying-glass" style="position:absolute;left:.8rem;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:.85rem"></i>' +
          '<input type="text" id="team-search" placeholder="Name, Position suchen ..." ' +
            'style="width:100%;padding:.55rem .75rem .55rem 2.25rem;border:1px solid var(--card-border);border-radius:var(--radius);background:var(--card);color:var(--text);font-size:.875rem" ' +
            'oninput="TeamModule.onSearch(this.value)" />' +
        '</div>' +
        '<select id="team-role-filter" onchange="TeamModule.onFilter(this.value)" ' +
          'style="padding:.55rem .75rem;border:1px solid var(--card-border);border-radius:var(--radius);background:var(--card);color:var(--text);font-size:.875rem;cursor:pointer">' +
          '<option value="alle">Alle Rollen</option>' +
          '<option value="admin">Administrator</option>' +
          '<option value="mitarbeiter">Mitarbeiter</option>' +
        '</select>' +
        '<div style="display:flex;gap:.35rem;background:var(--card);border:1px solid var(--card-border);border-radius:var(--radius);padding:.2rem">' +
          '<button id="view-grid-btn" onclick="TeamModule.setView(\'grid\')" ' +
            'style="padding:.35rem .65rem;border-radius:6px;font-size:.85rem;background:var(--navy);color:#fff">' +
            '<i class="fa-solid fa-grip"></i>' +
          '</button>' +
          '<button id="view-list-btn" onclick="TeamModule.setView(\'list\')" ' +
            'style="padding:.35rem .65rem;border-radius:6px;font-size:.85rem;background:transparent;color:var(--text-muted)">' +
            '<i class="fa-solid fa-list"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div id="team-stats-banner" style="margin-bottom:1.75rem"></div>' +

      '<div id="team-content">' +
        '<div class="content-loading"><div class="spinner"></div><p>Laden...</p></div>' +
      '</div>'
    );

    await this._loadAndRender();
  },

  onSearch(q) {
    this.searchQuery = q.toLowerCase();
    this._rerender();
  },

  onFilter(role) {
    this.filterRole = role;
    this._rerender();
  },

  setView(mode) {
    this.viewMode = mode;
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');
    if (gridBtn) {
      gridBtn.style.background = mode === 'grid' ? 'var(--navy)' : 'transparent';
      gridBtn.style.color = mode === 'grid' ? '#fff' : 'var(--text-muted)';
    }
    if (listBtn) {
      listBtn.style.background = mode === 'list' ? 'var(--navy)' : 'transparent';
      listBtn.style.color = mode === 'list' ? '#fff' : 'var(--text-muted)';
    }
    this._rerender();
  },

  async _loadAndRender() {
    try {
      this._allUsers = await DB.getAll('users');
    } catch (e) {
      this._allUsers = [];
    }
    try {
      this._allAufgaben = await DB.getAll('aufgaben');
    } catch (e) {
      this._allAufgaben = [];
    }
    try {
      this._allZeiten = await DB.getAll('zeiterfassung');
    } catch (e) {
      this._allZeiten = [];
    }
    this._renderStats();
    this._rerender();
  },

  _renderStats() {
    const banner = document.getElementById('team-stats-banner');
    if (!banner) return;
    const users = this._allUsers;
    const admins = users.filter(function(u) { return u.rolle === 'admin'; }).length;
    const mitarb = users.filter(function(u) { return u.rolle !== 'admin'; }).length;
    const mitFoto = users.filter(function(u) { return u.foto_url; }).length;

    var stats = [
      { icon: 'fa-users',       label: 'Gesamt',      value: users.length, color: 'var(--navy)' },
      { icon: 'fa-user-shield', label: 'Admins',       value: admins,       color: 'var(--blue)' },
      { icon: 'fa-hard-hat',    label: 'Mitarbeiter',  value: mitarb,       color: 'var(--green)' },
      { icon: 'fa-image',       label: 'Mit Foto',     value: mitFoto,      color: 'var(--purple)' },
    ];

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem">';
    for (var i = 0; i < stats.length; i++) {
      var s = stats[i];
      html += '<div class="card" style="padding:.85rem 1rem;display:flex;align-items:center;gap:.85rem;border-left:3px solid ' + s.color + '">';
      html += '<div style="width:38px;height:38px;border-radius:10px;background:' + s.color + '22;display:flex;align-items:center;justify-content:center;flex-shrink:0">';
      html += '<i class="fa-solid ' + s.icon + '" style="color:' + s.color + ';font-size:1rem"></i></div>';
      html += '<div><div style="font-size:1.35rem;font-weight:800;line-height:1;color:var(--text)">' + s.value + '</div>';
      html += '<div style="font-size:.75rem;color:var(--text-muted);margin-top:.1rem">' + s.label + '</div></div></div>';
    }
    html += '</div>';
    banner.innerHTML = html;
  },

  _filtered() {
    var self = this;
    return this._allUsers.filter(function(u) {
      var q = self.searchQuery;
      var matchSearch = !q ||
        (u.name || '').toLowerCase().indexOf(q) >= 0 ||
        (u.position || '').toLowerCase().indexOf(q) >= 0 ||
        (u.email || '').toLowerCase().indexOf(q) >= 0 ||
        (u.telefon || '').toLowerCase().indexOf(q) >= 0;
      var matchRole = self.filterRole === 'alle' || u.rolle === self.filterRole;
      return matchSearch && matchRole;
    });
  },

  _taskCount(userId) {
    return this._allAufgaben.filter(function(a) {
      return !a.erledigt && Array.isArray(a.zugewiesen_an) && a.zugewiesen_an.indexOf(userId) >= 0;
    }).length;
  },

  _hoursThisMonth(userId) {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var total = 0;
    this._allZeiten.forEach(function(z) {
      if (z.user_id !== userId) return;
      var d = new Date(z.datum || z.erstellt_am || 0);
      if (d.getFullYear() === year && d.getMonth() === month) {
        total += (z.gesamt_minuten || z.dauer_minuten || 0);
      }
    });
    var h = Math.floor(total / 60);
    var m = total % 60;
    return h + ':' + (m < 10 ? '0' : '') + m;
  },

  _avatarHtml(u, size) {
    size = size || 52;
    if (u.foto_url) {
      return '<img src="' + u.foto_url + '" alt="" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;border:2px solid var(--card-border)" />';
    }
    var colors = ['#0f1e40','#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2'];
    var idx = (u.name || 'A').charCodeAt(0) % colors.length;
    var parts = (u.name || '?').split(' ');
    var initials = '';
    for (var i = 0; i < Math.min(parts.length, 2); i++) {
      if (parts[i]) initials += parts[i][0].toUpperCase();
    }
    var fs = Math.round(size * 0.35);
    return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + colors[idx] + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + fs + 'px;flex-shrink:0">' + initials + '</div>';
  },

  _roleBadgeHtml(u) {
    if (u.rolle === 'admin') {
      return '<span style="font-size:.68rem;background:var(--navy);color:#fff;padding:.15rem .5rem;border-radius:20px;font-weight:700">Admin</span>';
    }
    return '<span style="font-size:.68rem;background:var(--green-light);color:var(--green);padding:.15rem .5rem;border-radius:20px;font-weight:700;border:1px solid rgba(34,197,94,.2)">Mitarbeiter</span>';
  },

  _rerender() {
    var container = document.getElementById('team-content');
    if (!container) return;
    var users = this._filtered();

    if (!users.length) {
      container.innerHTML =
        '<div style="text-align:center;padding:4rem 2rem;color:var(--text-muted)">' +
          '<i class="fa-solid fa-user-slash" style="font-size:2.5rem;margin-bottom:1rem;opacity:.4;display:block"></i>' +
          '<p style="font-size:1rem;font-weight:600">Keine Mitarbeiter gefunden</p>' +
          '<p style="font-size:.85rem;margin-top:.3rem">Passe die Suche oder den Filter an.</p>' +
        '</div>';
      return;
    }

    if (this.viewMode === 'grid') {
      this._renderGrid(container, users);
    } else {
      this._renderList(container, users);
    }
  },

  _coverColor(u) {
    var covers = [
      'linear-gradient(135deg,#0f1e40 0%,#2563eb 100%)',
      'linear-gradient(135deg,#1a1040 0%,#7c3aed 100%)',
      'linear-gradient(135deg,#0a3020 0%,#059669 100%)',
      'linear-gradient(135deg,#2d1010 0%,#dc2626 100%)',
      'linear-gradient(135deg,#2d1e00 0%,#d97706 100%)',
      'linear-gradient(135deg,#002030 0%,#0891b2 100%)',
    ];
    var idx = (u.name || 'A').charCodeAt(0) % covers.length;
    return covers[idx];
  },

  _renderGrid(container, users) {
    var self = this;
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem">';
    users.forEach(function(u) {
      var tasks = self._taskCount(u.id);
      var hours = self._hoursThisMonth(u.id);
      var isMe = Auth.userId() === u.id;
      var canEdit = Auth.isAdmin() || isMe;

      html += '<div class="card" style="overflow:hidden;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease;padding:0" ' +
        'onclick="TeamModule.openProfile(\'' + u.id + '\')" ' +
        'onmouseenter="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 8px 24px rgba(0,0,0,.12)\'" ' +
        'onmouseleave="this.style.transform=\'\';this.style.boxShadow=\'\'">';

      /* Body */
      html += '<div style="padding:1.15rem 1.15rem 1.15rem">';

      /* Avatar */
      html += '<div style="margin-bottom:.6rem;display:flex;align-items:center;justify-content:space-between">';
      html += self._avatarHtml(u, 56);
      if (isMe) {
        html += '<span style="font-size:.68rem;background:var(--navy-light);color:#fff;padding:.15rem .5rem;border-radius:20px;font-weight:600">Ich</span>';
      } else {
        html += '<span></span>';
      }
      html += '</div>';

      /* Name + Badge in einer Zeile */
      html += '<div style="display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;margin-bottom:.15rem">';
      html += '<div style="font-weight:700;font-size:1rem;color:var(--text);line-height:1.2">' + (u.name || '—') + '</div>';
      html += self._roleBadgeHtml(u);
      html += '</div>';
      html += '<div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.85rem">' + (u.position || 'Keine Position') + '</div>';

      /* Stats */
      html += '<div style="margin-top:.85rem;display:grid;grid-template-columns:1fr 1fr;gap:.5rem">';
      html += '<div style="background:var(--bg);border-radius:8px;padding:.5rem .65rem;text-align:center">';
      html += '<div style="font-size:1.1rem;font-weight:800;color:var(--navy)">' + tasks + '</div>';
      html += '<div style="font-size:.68rem;color:var(--text-muted);margin-top:.05rem">Aufgaben</div></div>';
      html += '<div style="background:var(--bg);border-radius:8px;padding:.5rem .65rem;text-align:center">';
      html += '<div style="font-size:1.1rem;font-weight:800;color:var(--navy)">' + hours + '</div>';
      html += '<div style="font-size:.68rem;color:var(--text-muted);margin-top:.05rem">Std. (Monat)</div></div>';
      html += '</div>';

      /* Kontakt */
      if (u.telefon || u.email) {
        html += '<div style="margin-top:.85rem;display:flex;flex-direction:column;gap:.3rem">';
        if (u.telefon) {
          html += '<div style="font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:.4rem">' +
            '<i class="fa-solid fa-phone" style="width:12px;color:var(--blue-light)"></i>' + u.telefon + '</div>';
        }
        if (u.email) {
          html += '<div style="font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:.4rem;word-break:break-all">' +
            '<i class="fa-solid fa-envelope" style="width:12px;color:var(--blue-light)"></i>' + u.email + '</div>';
        }
        html += '</div>';
      }

      /* Aktionen */
      if (canEdit) {
        html += '<div style="margin-top:.85rem;padding-top:.75rem;border-top:1px solid var(--card-border);display:flex;gap:.4rem" onclick="event.stopPropagation()">';
        html += '<button class="btn btn-secondary btn-sm" style="flex:1;font-size:.75rem" onclick="TeamModule.openEditModal(\'' + u.id + '\')">' +
          '<i class="fa-solid fa-pen"></i> Bearbeiten</button>';
        html += '<button class="btn btn-sm" style="flex:0;padding:.3rem .55rem;background:var(--bg);border:1px solid var(--card-border);border-radius:var(--radius)" ' +
          'title="Foto hochladen" onclick="TeamModule.triggerPhotoUpload(\'' + u.id + '\')">' +
          '<i class="fa-solid fa-camera" style="color:var(--text-muted)"></i></button>';
        html += '</div>';
      }

      html += '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
  },

  _renderList(container, users) {
    var self = this;
    var html = '<div class="card" style="overflow:hidden;padding:0">';
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<thead><tr style="background:var(--bg);border-bottom:1px solid var(--card-border)">';
    html += '<th style="padding:.75rem 1rem;text-align:left;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Mitarbeiter</th>';
    html += '<th style="padding:.75rem 1rem;text-align:left;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Kontakt</th>';
    html += '<th style="padding:.75rem 1rem;text-align:left;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Rolle</th>';
    html += '<th style="padding:.75rem 1rem;text-align:left;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Aufgaben</th>';
    html += '<th style="padding:.75rem 1rem;text-align:right;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Aktionen</th>';
    html += '</tr></thead><tbody>';

    users.forEach(function(u) {
      var tasks = self._taskCount(u.id);
      var isMe = Auth.userId() === u.id;
      var canEdit = Auth.isAdmin() || isMe;

      html += '<tr style="border-bottom:1px solid var(--card-border)" ' +
        'onmouseenter="this.style.background=\'var(--bg)\'" onmouseleave="this.style.background=\'\'">';

      html += '<td style="padding:.85rem 1rem">';
      html += '<div style="display:flex;align-items:center;gap:.75rem;cursor:pointer" onclick="TeamModule.openProfile(\'' + u.id + '\')">';
      html += self._avatarHtml(u, 40);
      html += '<div><div style="font-weight:700;font-size:.9rem;color:var(--text)">' + (u.name || '—');
      if (isMe) html += ' <span style="font-size:.65rem;background:var(--navy-light);color:#fff;padding:.1rem .4rem;border-radius:10px">Ich</span>';
      html += '</div><div style="font-size:.75rem;color:var(--text-muted)">' + (u.position || '—') + '</div></div></div></td>';

      html += '<td style="padding:.85rem 1rem">';
      html += '<div style="font-size:.8rem;color:var(--text-muted)">' + (u.email || '—') + '</div>';
      html += '<div style="font-size:.8rem;color:var(--text-muted);margin-top:.15rem">' + (u.telefon || '—') + '</div>';
      html += '</td>';

      html += '<td style="padding:.85rem 1rem">' + self._roleBadgeHtml(u) + '</td>';

      html += '<td style="padding:.85rem 1rem">';
      html += '<span style="font-size:.85rem;font-weight:600;color:' + (tasks > 0 ? 'var(--orange)' : 'var(--text-muted)') + '">' + tasks + ' offen</span>';
      html += '</td>';

      html += '<td style="padding:.85rem 1rem;text-align:right">';
      html += '<div style="display:flex;align-items:center;justify-content:flex-end;gap:.4rem">';
      html += '<button class="btn btn-secondary btn-sm" onclick="TeamModule.openProfile(\'' + u.id + '\')"><i class="fa-solid fa-eye"></i></button>';
      if (canEdit) {
        html += '<button class="btn btn-secondary btn-sm" onclick="TeamModule.openEditModal(\'' + u.id + '\')"><i class="fa-solid fa-pen"></i></button>';
        html += '<button class="btn btn-sm" style="padding:.3rem .55rem;background:var(--bg);border:1px solid var(--card-border);border-radius:var(--radius)" ' +
          'onclick="TeamModule.triggerPhotoUpload(\'' + u.id + '\')"><i class="fa-solid fa-camera" style="color:var(--text-muted)"></i></button>';
      }
      html += '</div></td></tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /* ── Vollständige Profilseite ── */
  async openProfile(userId) {
    var u = null;
    for (var i = 0; i < this._allUsers.length; i++) {
      if (this._allUsers[i].id === userId) { u = this._allUsers[i]; break; }
    }
    if (!u) return;

    /* Daten laden */
    var alleAufgaben, alleZeiten, alleUrlaub, alleAuftraege;
    try { alleAufgaben  = await DB.getAll('aufgaben'); }    catch(e) { alleAufgaben  = []; }
    try { alleZeiten    = await DB.getAll('zeiterfassung'); } catch(e) { alleZeiten    = []; }
    try { alleUrlaub    = await DB.getAll('urlaub');        } catch(e) { alleUrlaub    = []; }
    try { alleAuftraege = await DB.getAll('auftraege');     } catch(e) { alleAuftraege = []; }

    var auftraegeMap = {};
    alleAuftraege.forEach(function(a) { auftraegeMap[a.id] = a; });

    /* Nutzerspezifische Daten */
    var meineAufgaben = alleAufgaben.filter(function(a) {
      return Array.isArray(a.zugewiesen_an) && a.zugewiesen_an.indexOf(u.id) >= 0;
    });
    var offeneAufgaben    = meineAufgaben.filter(function(a) { return !a.erledigt; });
    var erledigteAufgaben = meineAufgaben.filter(function(a) { return a.erledigt; }).slice(0, 5);

    var meineZeiten = alleZeiten.filter(function(z) { return z.user_id === u.id; });
    var now = new Date();
    var thisYear = now.getFullYear(), thisMonth = now.getMonth();
    var zeitenDiesenMonat = meineZeiten.filter(function(z) {
      var d = new Date(z.datum || z.erstellt_am || 0);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    });
    var minutenMonat = zeitenDiesenMonat.reduce(function(s, z) { return s + (z.gesamt_minuten || 0); }, 0);
    var minutenGesamt = meineZeiten.reduce(function(s, z) { return s + (z.gesamt_minuten || 0); }, 0);
    function toHM(min) { return Math.floor(min/60) + ':' + (min%60 < 10 ? '0' : '') + (min%60); }

    var meineUrlaub = alleUrlaub.filter(function(v) { return v.user_id === u.id; });
    var urlaubVerbraucht = meineUrlaub.filter(function(v) { return v.status === 'genehmigt'; })
      .reduce(function(s, v) { return s + (v.tage || 0); }, 0);
    var urlaubGesamt  = u.urlaub_tage_gesamt || 30;
    var urlaubRest    = Math.max(0, urlaubGesamt - urlaubVerbraucht);

    var canEdit = Auth.isAdmin() || Auth.userId() === u.id;
    var self    = this;

    var permLabels = { dashboard:'Dashboard', kunden:'Kunden', anfragen:'Angebote', auftraege:'Aufträge',
      nachkalkulation:'Nachkalk.', rechnungen:'Rechnungen', aufgaben:'Aufgaben',
      kalender:'Kalender', zeiterfassung:'Zeiterfassung', chat:'Chat',
      urlaub:'Urlaub', tickets:'Tickets', einstellungen:'Einstellungen', team:'Team' };
    var activePerms = [];
    if (u.rolle === 'admin') {
      activePerms = Object.keys(permLabels);
    } else {
      var pb = u.berechtigungen || {};
      Object.keys(pb).forEach(function(k) { if (pb[k]) activePerms.push(k); });
    }

    /* ── Seite aufbauen ── */
    var html = '';

    /* Zurück-Header */
    html += '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem">';
    html += '<button class="btn btn-secondary btn-sm" onclick="TeamModule.render()" style="display:flex;align-items:center;gap:.4rem">' +
      '<i class="fa-solid fa-arrow-left"></i> Zurück</button>';
    html += '<span style="font-size:.85rem;color:var(--text-muted)">Team / ' + (u.name || '—') + '</span>';
    html += '</div>';

    /* Profil-Header-Karte */
    html += '<div class="card" style="padding:1.5rem;margin-bottom:1.25rem">';
    html += '<div style="display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap">';

    /* Avatar */
    html += '<div style="position:relative;flex-shrink:0' + (canEdit ? ';cursor:pointer' : '') + '" ' +
      (canEdit ? 'onclick="TeamModule.triggerPhotoUpload(\'' + u.id + '\')" title="Foto ändern"' : '') + '>';
    html += self._avatarHtml(u, 80);
    if (canEdit) {
      html += '<div style="position:absolute;bottom:0;right:0;width:24px;height:24px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65rem;border:2px solid var(--card)">' +
        '<i class="fa-solid fa-camera"></i></div>';
    }
    html += '</div>';

    /* Name & Info */
    html += '<div style="flex:1;min-width:180px">';
    html += '<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.2rem">';
    html += '<h2 style="font-size:1.35rem;font-weight:800;color:var(--text);margin:0">' + (u.name || '—') + '</h2>';
    html += self._roleBadgeHtml(u);
    html += '</div>';
    html += '<div style="font-size:.9rem;color:var(--text-muted);margin-bottom:.6rem">' + (u.position || 'Keine Position') + '</div>';
    var kontaktItems = [];
    if (u.telefon) kontaktItems.push('<i class="fa-solid fa-phone" style="color:var(--blue-light)"></i> ' + u.telefon);
    if (u.email)   kontaktItems.push('<i class="fa-solid fa-envelope" style="color:var(--blue-light)"></i> ' + u.email);
    if (u.adresse) kontaktItems.push('<i class="fa-solid fa-location-dot" style="color:var(--blue-light)"></i> ' + u.adresse);
    if (kontaktItems.length) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:.75rem">';
      kontaktItems.forEach(function(k) {
        html += '<span style="font-size:.8rem;color:var(--text-muted);display:flex;align-items:center;gap:.3rem">' + k + '</span>';
      });
      html += '</div>';
    }
    html += '</div>';

    /* Edit-Button */
    if (canEdit) {
      html += '<div style="display:flex;gap:.4rem;flex-shrink:0">';
      html += '<button class="btn btn-primary btn-sm" onclick="TeamModule.openEditModal(\'' + u.id + '\')">' +
        '<i class="fa-solid fa-pen"></i> Bearbeiten</button>';
      html += '</div>';
    }
    html += '</div></div>';

    /* Stat-Karten */
    var stats = [
      { icon:'fa-list-check',      label:'Offene Aufgaben',    value: offeneAufgaben.length,    color:'var(--orange)' },
      { icon:'fa-circle-check',    label:'Erledigte Aufgaben', value: erledigteAufgaben.length, color:'var(--green)'  },
      { icon:'fa-clock',           label:'Stunden (Monat)',    value: toHM(minutenMonat),       color:'var(--blue)'   },
      { icon:'fa-hourglass-half',  label:'Stunden (Gesamt)',   value: toHM(minutenGesamt),      color:'var(--navy)'   },
      { icon:'fa-umbrella-beach',  label:'Urlaub verbraucht',  value: urlaubVerbraucht + ' / ' + urlaubGesamt + ' T', color:'var(--purple)' },
      { icon:'fa-sun',             label:'Resturlaub',         value: urlaubRest + ' Tage',     color:urlaubRest < 5 ? 'var(--red)' : 'var(--green)' },
    ];
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.75rem;margin-bottom:1.25rem">';
    stats.forEach(function(s) {
      html += '<div class="card" style="padding:.85rem 1rem;border-left:3px solid ' + s.color + '">';
      html += '<div style="display:flex;align-items:center;gap:.6rem">';
      html += '<div style="width:32px;height:32px;border-radius:8px;background:' + s.color + '22;display:flex;align-items:center;justify-content:center;flex-shrink:0">';
      html += '<i class="fa-solid ' + s.icon + '" style="color:' + s.color + ';font-size:.85rem"></i></div>';
      html += '<div><div style="font-size:1.1rem;font-weight:800;color:var(--text);line-height:1">' + s.value + '</div>';
      html += '<div style="font-size:.7rem;color:var(--text-muted);margin-top:.1rem">' + s.label + '</div></div>';
      html += '</div></div>';
    });
    html += '</div>';

    /* Zwei-Spalten-Layout */
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;align-items:start">';

    /* ── LINKE SPALTE: Aufgaben ── */
    html += '<div style="display:flex;flex-direction:column;gap:1.25rem">';

    /* Offene Aufgaben */
    html += '<div class="card" style="padding:0">';
    html += '<div style="padding:.85rem 1rem;border-bottom:1px solid var(--card-border);display:flex;align-items:center;justify-content:space-between">';
    html += '<span style="font-weight:700;font-size:.9rem">Offene Aufgaben</span>';
    html += '<span style="font-size:.75rem;background:var(--orange-light);color:var(--orange);padding:.15rem .5rem;border-radius:20px;font-weight:700">' + offeneAufgaben.length + '</span>';
    html += '</div>';
    if (offeneAufgaben.length === 0) {
      html += '<div style="padding:1.25rem;text-align:center;color:var(--text-muted);font-size:.85rem">Keine offenen Aufgaben</div>';
    } else {
      offeneAufgaben.forEach(function(a) {
        var prio = a.prioritaet === 'hoch' ? 'var(--red)' : a.prioritaet === 'niedrig' ? 'var(--green)' : 'var(--orange)';
        var auftrag = a.auftrag_id && auftraegeMap[a.auftrag_id] ? auftraegeMap[a.auftrag_id].bezeichnung || auftraegeMap[a.auftrag_id].nummer || '' : '';
        html += '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--card-border);display:flex;align-items:flex-start;gap:.75rem">';
        html += '<div style="width:8px;height:8px;border-radius:50%;background:' + prio + ';margin-top:.35rem;flex-shrink:0"></div>';
        html += '<div style="flex:1">';
        html += '<div style="font-size:.875rem;font-weight:600;color:var(--text)">' + (a.titel || '—') + '</div>';
        if (a.beschreibung) html += '<div style="font-size:.75rem;color:var(--text-muted);margin-top:.1rem">' + a.beschreibung + '</div>';
        var meta = [];
        if (a.faellig_am) meta.push('<i class="fa-solid fa-calendar-day"></i> ' + a.faellig_am);
        if (auftrag)       meta.push('<i class="fa-solid fa-clipboard-list"></i> ' + auftrag);
        if (meta.length) html += '<div style="font-size:.72rem;color:var(--text-muted);margin-top:.25rem;display:flex;gap:.75rem;flex-wrap:wrap">' + meta.join('') + '</div>';
        html += '</div></div>';
      });
    }
    html += '</div>';

    /* Zuletzt erledigte Aufgaben */
    html += '<div class="card" style="padding:0">';
    html += '<div style="padding:.85rem 1rem;border-bottom:1px solid var(--card-border);display:flex;align-items:center;justify-content:space-between">';
    html += '<span style="font-weight:700;font-size:.9rem">Zuletzt erledigt</span>';
    html += '<span style="font-size:.75rem;background:var(--green-light);color:var(--green);padding:.15rem .5rem;border-radius:20px;font-weight:700">' + erledigteAufgaben.length + '</span>';
    html += '</div>';
    if (erledigteAufgaben.length === 0) {
      html += '<div style="padding:1.25rem;text-align:center;color:var(--text-muted);font-size:.85rem">Noch keine erledigten Aufgaben</div>';
    } else {
      erledigteAufgaben.forEach(function(a) {
        html += '<div style="padding:.65rem 1rem;border-bottom:1px solid var(--card-border);display:flex;align-items:center;gap:.6rem">';
        html += '<i class="fa-solid fa-circle-check" style="color:var(--green);font-size:.85rem;flex-shrink:0"></i>';
        html += '<span style="font-size:.85rem;color:var(--text-muted);text-decoration:line-through">' + (a.titel || '—') + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';
    html += '</div>'; /* Ende linke Spalte */

    /* ── RECHTE SPALTE: Zeiten + Urlaub ── */
    html += '<div style="display:flex;flex-direction:column;gap:1.25rem">';

    /* Letzte Zeiteinträge */
    var letzteZeiten = meineZeiten.slice(0, 8);
    html += '<div class="card" style="padding:0">';
    html += '<div style="padding:.85rem 1rem;border-bottom:1px solid var(--card-border);display:flex;align-items:center;justify-content:space-between">';
    html += '<span style="font-weight:700;font-size:.9rem">Letzte Zeiteinträge</span>';
    html += '<span style="font-size:.75rem;color:var(--text-muted)">' + toHM(minutenMonat) + ' h diesen Monat</span>';
    html += '</div>';
    if (letzteZeiten.length === 0) {
      html += '<div style="padding:1.25rem;text-align:center;color:var(--text-muted);font-size:.85rem">Noch keine Zeiterfassung</div>';
    } else {
      letzteZeiten.forEach(function(z) {
        var auftrag = z.auftrag_id && auftraegeMap[z.auftrag_id] ? (auftraegeMap[z.auftrag_id].bezeichnung || auftraegeMap[z.auftrag_id].nummer || '') : '';
        var label = z.projekt_label || auftrag || 'Allgemein';
        var hm    = toHM(z.gesamt_minuten || 0);
        var datum = z.datum ? z.datum : (z.erstellt_am ? z.erstellt_am.slice(0, 10) : '—');
        html += '<div style="padding:.65rem 1rem;border-bottom:1px solid var(--card-border);display:flex;align-items:center;justify-content:space-between;gap:.5rem">';
        html += '<div style="flex:1">';
        html += '<div style="font-size:.85rem;font-weight:600;color:var(--text)">' + label + '</div>';
        html += '<div style="font-size:.72rem;color:var(--text-muted)">' + datum + '</div>';
        html += '</div>';
        html += '<div style="font-size:.9rem;font-weight:700;color:var(--navy);flex-shrink:0">' + hm + '</div>';
        html += '</div>';
      });
    }
    html += '</div>';

    /* Urlaubsanträge */
    html += '<div class="card" style="padding:0">';
    html += '<div style="padding:.85rem 1rem;border-bottom:1px solid var(--card-border)">';
    html += '<span style="font-weight:700;font-size:.9rem">Urlaub</span>';
    html += '<div style="margin-top:.5rem;display:flex;gap:.5rem">';
    html += '<div style="flex:1;background:var(--bg);border-radius:8px;padding:.5rem .65rem;text-align:center">';
    html += '<div style="font-size:1.2rem;font-weight:800;color:var(--navy)">' + urlaubVerbraucht + '</div>';
    html += '<div style="font-size:.7rem;color:var(--text-muted)">Verbraucht</div></div>';
    html += '<div style="flex:1;background:var(--bg);border-radius:8px;padding:.5rem .65rem;text-align:center">';
    html += '<div style="font-size:1.2rem;font-weight:800;color:' + (urlaubRest < 5 ? 'var(--red)' : 'var(--green)') + '">' + urlaubRest + '</div>';
    html += '<div style="font-size:.7rem;color:var(--text-muted)">Verbleibend</div></div>';
    html += '<div style="flex:1;background:var(--bg);border-radius:8px;padding:.5rem .65rem;text-align:center">';
    html += '<div style="font-size:1.2rem;font-weight:800;color:var(--text)">' + urlaubGesamt + '</div>';
    html += '<div style="font-size:.7rem;color:var(--text-muted)">Gesamt / Jahr</div></div>';
    html += '</div></div>';
    if (meineUrlaub.length === 0) {
      html += '<div style="padding:1.25rem;text-align:center;color:var(--text-muted);font-size:.85rem">Keine Urlaubsanträge</div>';
    } else {
      meineUrlaub.slice(0, 6).forEach(function(v) {
        var statusColor = v.status === 'genehmigt' ? 'var(--green)' : v.status === 'abgelehnt' ? 'var(--red)' : 'var(--orange)';
        var statusLabel = v.status === 'genehmigt' ? 'Genehmigt' : v.status === 'abgelehnt' ? 'Abgelehnt' : 'Ausstehend';
        html += '<div style="padding:.65rem 1rem;border-bottom:1px solid var(--card-border);display:flex;align-items:center;justify-content:space-between;gap:.5rem">';
        html += '<div>';
        html += '<div style="font-size:.85rem;font-weight:600;color:var(--text)">' + (v.von_datum || '—') + ' – ' + (v.bis_datum || '—') + '</div>';
        html += '<div style="font-size:.72rem;color:var(--text-muted)">' + (v.tage || 0) + ' Tage</div>';
        html += '</div>';
        html += '<span style="font-size:.72rem;padding:.15rem .45rem;border-radius:20px;font-weight:700;background:' + statusColor + '22;color:' + statusColor + '">' + statusLabel + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';

    /* Berechtigungen */
    if (activePerms.length) {
      html += '<div class="card" style="padding:1rem">';
      html += '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:.6rem">Berechtigungen</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:.3rem">';
      activePerms.forEach(function(p) {
        html += '<span style="font-size:.72rem;padding:.2rem .5rem;border-radius:20px;background:var(--navy);color:#fff;font-weight:600">' + (permLabels[p] || p) + '</span>';
      });
      html += '</div></div>';
    }

    html += '</div>'; /* Ende rechte Spalte */
    html += '</div>'; /* Ende grid */

    setContent(html);
    document.getElementById('topbar-title').textContent = u.name || 'Profil';
  },

  /* ── Foto Upload ── */
  triggerPhotoUpload(userId, fromModal) {
    var input = document.getElementById('team-photo-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'team-photo-input';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
    }
    input.onchange = null;
    input.value = '';
    var self = this;
    input.onchange = function(e) { self._uploadPhoto(userId, e.target.files[0], fromModal); };
    input.click();
  },

  async _uploadPhoto(userId, file, fromModal) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Foto darf max. 5 MB groß sein', 'error'); return; }
    var self = this;
    var reader = new FileReader();
    reader.onload = async function(e) {
      var dataUrl = e.target.result;
      try {
        await DB.update('users', userId, { foto_url: dataUrl });
      } catch (err) {
        /* Supabase-Spalte fehlt ggf. — in localStorage trotzdem speichern */
        var all = LS.get('users');
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === userId) { all[i].foto_url = dataUrl; break; }
        }
        LS.set('users', all);
      }
      for (var i = 0; i < self._allUsers.length; i++) {
        if (self._allUsers[i].id === userId) { self._allUsers[i].foto_url = dataUrl; break; }
      }
      if (Auth.userId() === userId) {
        Auth.saveSession(Object.assign({}, Auth.currentUser, { foto_url: dataUrl }));
      }
      showToast('Foto gespeichert', 'success');
      self._renderStats();
      if (fromModal) {
        self.openProfile(userId);
      } else {
        self._rerender();
      }
    };
    reader.readAsDataURL(file);
  },

  /* ── Bearbeiten ── */
  async openEditModal(userId) {
    var u = null;
    for (var i = 0; i < this._allUsers.length; i++) {
      if (this._allUsers[i].id === userId) { u = this._allUsers[i]; break; }
    }
    if (!u) return;
    var isMe = Auth.userId() === u.id;
    var self = this;

    var adminFields = '';
    if (Auth.isAdmin()) {
      adminFields =
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Stundensatz (€/Std)</label>' +
            '<input class="form-input" type="number" id="te-satz" value="' + (u.stundensatz || 0) + '" /></div>' +
          '<div class="form-group"><label class="form-label">Jahresurlaub (Tage)</label>' +
            '<input class="form-input" type="number" id="te-urlaub" value="' + (u.urlaub_tage_gesamt || 28) + '" /></div>' +
        '</div>';
    }

    var fotoBtn = u.foto_url
      ? '<div style="margin-top:.5rem"><button class="btn btn-danger btn-sm" onclick="TeamModule._removePhoto(\'' + u.id + '\')"><i class="fa-solid fa-trash"></i> Foto entfernen</button></div>'
      : '';

    openModal(u.name + ' bearbeiten',
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Name<span class="required">*</span></label>' +
          '<input class="form-input" id="te-name" value="' + (u.name || '') + '" /></div>' +
        '<div class="form-group"><label class="form-label">Position</label>' +
          '<input class="form-input" id="te-pos" value="' + (u.position || '') + '" /></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Telefon</label>' +
          '<input class="form-input" id="te-tel" value="' + (u.telefon || '') + '" /></div>' +
        '<div class="form-group"><label class="form-label">E-Mail</label>' +
          '<input class="form-input" type="email" id="te-email" value="' + (u.email || '') + '" /></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Adresse</label>' +
        '<input class="form-input" id="te-adresse" value="' + (u.adresse || '') + '" /></div>' +
      adminFields +
      fotoBtn,
      async function() {
        var name = document.getElementById('te-name').value.trim();
        if (!name) { showToast('Name ist ein Pflichtfeld', 'error'); return; }
        var updates = {
          name: name,
          position: document.getElementById('te-pos').value.trim(),
          telefon: document.getElementById('te-tel').value.trim(),
          email: document.getElementById('te-email').value.trim(),
          adresse: document.getElementById('te-adresse').value.trim(),
        };
        if (Auth.isAdmin()) {
          updates.stundensatz = parseFloat(document.getElementById('te-satz').value) || 0;
          updates.urlaub_tage_gesamt = parseInt(document.getElementById('te-urlaub').value) || 28;
        }
        await DB.update('users', userId, updates);
        for (var i = 0; i < self._allUsers.length; i++) {
          if (self._allUsers[i].id === userId) {
            self._allUsers[i] = Object.assign({}, self._allUsers[i], updates);
            break;
          }
        }
        if (isMe) {
          Auth.saveSession(Object.assign({}, Auth.currentUser, updates));
          updateUserDisplay();
        }
        closeModal();
        showToast(name + ' gespeichert', 'success');
        self._renderStats();
        self._rerender();
        if (currentModule === 'team') self.openProfile(userId);
      },
      'Speichern', '580px'
    );
  },

  async _removePhoto(userId) {
    try { await DB.update('users', userId, { foto_url: null }); } catch (e) {}
    for (var i = 0; i < this._allUsers.length; i++) {
      if (this._allUsers[i].id === userId) { this._allUsers[i].foto_url = null; break; }
    }
    closeModal();
    showToast('Foto entfernt', 'info');
    this._renderStats();
    this._rerender();
  },

  /* ── Neuer Mitarbeiter (Admin) ── */
  async openAddMember() {
    var self = this;
    openModal('Neuen Mitarbeiter hinzufügen',
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Name<span class="required">*</span></label>' +
          '<input class="form-input" id="ta-name" placeholder="Vor- und Nachname" /></div>' +
        '<div class="form-group"><label class="form-label">Position</label>' +
          '<input class="form-input" id="ta-pos" placeholder="z.B. Schlosser, Monteur" /></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">E-Mail</label>' +
          '<input class="form-input" type="email" id="ta-email" /></div>' +
        '<div class="form-group"><label class="form-label">Telefon</label>' +
          '<input class="form-input" id="ta-tel" /></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">PIN (4-stellig)<span class="required">*</span></label>' +
          '<input class="form-input pin-input" type="password" id="ta-pin" maxlength="4" inputmode="numeric" placeholder="1234" /></div>' +
        '<div class="form-group"><label class="form-label">Stundensatz (€/Std)</label>' +
          '<input class="form-input" type="number" id="ta-satz" placeholder="45" /></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Jahresurlaub (Tage)</label>' +
        '<input class="form-input" type="number" id="ta-urlaub" value="28" /></div>',
      async function() {
        var name = document.getElementById('ta-name').value.trim();
        var pin = document.getElementById('ta-pin').value;
        if (!name) { showToast('Name ist Pflichtfeld', 'error'); return; }
        if (pin.length !== 4 || isNaN(pin)) { showToast('PIN muss genau 4 Ziffern haben', 'error'); return; }
        var newUser = {
          name: name,
          position: document.getElementById('ta-pos').value.trim(),
          email: document.getElementById('ta-email').value.trim(),
          telefon: document.getElementById('ta-tel').value.trim(),
          pin_hash: simpleHash(pin),
          rolle: 'mitarbeiter',
          stundensatz: parseFloat(document.getElementById('ta-satz').value) || 0,
          urlaub_tage_gesamt: parseInt(document.getElementById('ta-urlaub').value) || 28,
          berechtigungen: { dashboard: true, aufgaben: true, kalender: true, chat: true, tickets: true, zeiterfassung: true, team: true },
          dark_mode: false,
          erstellt_am: new Date().toISOString(),
        };
        await DB.insert('users', newUser);
        closeModal();
        showToast(name + ' wurde hinzugefügt', 'success');
        await self._loadAndRender();
      },
      'Hinzufügen', '580px'
    );
  },
};
