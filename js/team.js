/* ═══════════════════════════════════════════════════════
   TEAM — Mitarbeiterübersicht mit Profilen & Fotos
═══════════════════════════════════════════════════════ */

const TeamModule = {
  searchQuery: '',
  filterRole: 'alle',
  viewMode: 'grid',   // 'grid' | 'list'

  async render() {
    setContent(`
      <div class="module-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.75rem">
        <div>
          <div class="module-title" style="font-size:1.5rem;font-weight:800;color:var(--navy)">Team</div>
          <div style="font-size:.875rem;color:var(--text-muted);margin-top:.2rem">Alle Mitarbeiter im Überblick</div>
        </div>
        ${Auth.isAdmin() ? `
        <button class="btn btn-primary" onclick="TeamModule.openAddMember()" style="display:flex;align-items:center;gap:.5rem">
          <i class="fa-solid fa-user-plus"></i> Mitarbeiter hinzufügen
        </button>` : ''}
      </div>

      <!-- Toolbar -->
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem">
        <div style="position:relative;flex:1;min-width:200px;max-width:340px">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:.8rem;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:.85rem"></i>
          <input type="text" id="team-search" placeholder="Name, Position suchen …"
            style="width:100%;padding:.55rem .75rem .55rem 2.25rem;border:1px solid var(--card-border);border-radius:var(--radius);background:var(--card);color:var(--text);font-size:.875rem"
            oninput="TeamModule.onSearch(this.value)" value="${this.searchQuery}" />
        </div>

        <select id="team-role-filter" onchange="TeamModule.onFilter(this.value)"
          style="padding:.55rem .75rem;border:1px solid var(--card-border);border-radius:var(--radius);background:var(--card);color:var(--text);font-size:.875rem;cursor:pointer">
          <option value="alle">Alle Rollen</option>
          <option value="admin">Administrator</option>
          <option value="mitarbeiter">Mitarbeiter</option>
        </select>

        <div style="display:flex;gap:.35rem;background:var(--card);border:1px solid var(--card-border);border-radius:var(--radius);padding:.2rem">
          <button id="view-grid-btn" onclick="TeamModule.setView('grid')"
            style="padding:.35rem .65rem;border-radius:6px;font-size:.85rem;transition:var(--transition);background:${this.viewMode==='grid'?'var(--navy)':'transparent'};color:${this.viewMode==='grid'?'#fff':'var(--text-muted)'}">
            <i class="fa-solid fa-grip"></i>
          </button>
          <button id="view-list-btn" onclick="TeamModule.setView('list')"
            style="padding:.35rem .65rem;border-radius:6px;font-size:.85rem;transition:var(--transition);background:${this.viewMode==='list'?'var(--navy)':'transparent'};color:${this.viewMode==='list'?'#fff':'var(--text-muted)'}">
            <i class="fa-solid fa-list"></i>
          </button>
        </div>
      </div>

      <!-- Statistik-Banner -->
      <div id="team-stats-banner" style="margin-bottom:1.75rem"></div>

      <!-- Team-Grid / List -->
      <div id="team-content">
        <div class="content-loading"><div class="spinner"></div><p>Laden...</p></div>
      </div>
    `);

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
    this._rerender();
  },

  async _loadAndRender() {
    this._allUsers = await DB.getAll('users');
    this._allAufgaben = await DB.getAll('aufgaben').catch(() => []);
    this._allZeiten = await DB.getAll('zeiterfassung').catch(() => []);
    this._renderStats(this._allUsers);
    this._rerender();
  },

  _renderStats(users) {
    const admins = users.filter(u => u.rolle === 'admin').length;
    const mita   = users.filter(u => u.rolle !== 'admin').length;
    const mitFoto = users.filter(u => u.foto_url).length;
    document.getElementById('team-stats-banner').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem">
        ${[
          { icon:'fa-users', label:'Gesamt', value: users.length, color:'var(--navy)' },
          { icon:'fa-user-shield', label:'Admins', value: admins, color:'var(--blue)' },
          { icon:'fa-hard-hat', label:'Mitarbeiter', value: mita, color:'var(--green)' },
          { icon:'fa-image', label:'Mit Foto', value: mitFoto, color:'var(--purple)' },
        ].map(s => `
          <div class="card" style="padding:.85rem 1rem;display:flex;align-items:center;gap:.85rem;border-left:3px solid ${s.color}">
            <div style="width:38px;height:38px;border-radius:10px;background:${s.color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fa-solid ${s.icon}" style="color:${s.color};font-size:1rem"></i>
            </div>
            <div>
              <div style="font-size:1.35rem;font-weight:800;line-height:1;color:var(--text)">${s.value}</div>
              <div style="font-size:.75rem;color:var(--text-muted);margin-top:.1rem">${s.label}</div>
            </div>
          </div>`).join('')}
      </div>`;
  },

  _filtered() {
    return (this._allUsers || []).filter(u => {
      const matchSearch = !this.searchQuery ||
        (u.name || '').toLowerCase().includes(this.searchQuery) ||
        (u.position || '').toLowerCase().includes(this.searchQuery) ||
        (u.email || '').toLowerCase().includes(this.searchQuery) ||
        (u.telefon || '').toLowerCase().includes(this.searchQuery);
      const matchRole = this.filterRole === 'alle' || u.rolle === this.filterRole;
      return matchSearch && matchRole;
    });
  },

  _rerender() {
    const users = this._filtered();
    const container = document.getElementById('team-content');
    if (!container) return;

    if (!users.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:4rem 2rem;color:var(--text-muted)">
          <i class="fa-solid fa-user-slash" style="font-size:2.5rem;margin-bottom:1rem;opacity:.4"></i>
          <p style="font-size:1rem;font-weight:600">Keine Mitarbeiter gefunden</p>
          <p style="font-size:.85rem;margin-top:.3rem">Passe die Suche oder den Filter an.</p>
        </div>`;
      return;
    }

    if (this.viewMode === 'grid') {
      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem">
          ${users.map(u => this._cardGrid(u)).join('')}
        </div>`;
    } else {
      container.innerHTML = `
        <div class="card" style="overflow:hidden;padding:0">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg);border-bottom:1px solid var(--card-border)">
                <th style="padding:.75rem 1rem;text-align:left;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Mitarbeiter</th>
                <th style="padding:.75rem 1rem;text-align:left;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Kontakt</th>
                <th style="padding:.75rem 1rem;text-align:left;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Rolle</th>
                <th style="padding:.75rem 1rem;text-align:left;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Aufgaben</th>
                <th style="padding:.75rem 1rem;text-align:right;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => this._rowList(u)).join('')}
            </tbody>
          </table>
        </div>`;
    }
  },

  _avatar(u, size = 52) {
    if (u.foto_url) {
      return `<img src="${u.foto_url}" alt="${u.name}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid var(--card-border)" />`;
    }
    const colors = ['#0f1e40','#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2'];
    const idx = (u.name || '?').charCodeAt(0) % colors.length;
    const initials = (u.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${colors[idx]};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(size*0.35)}px;flex-shrink:0;letter-spacing:.02em">${initials}</div>`;
  },

  _taskCount(userId) {
    return (this._allAufgaben || []).filter(a => !a.erledigt && (a.zugewiesen_an || []).includes(userId)).length;
  },

  _hoursThisMonth(userId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const eintraege = (this._allZeiten || []).filter(z => {
      if (z.user_id !== userId) return false;
      const d = new Date(z.datum || z.erstellt_am || 0);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const total = eintraege.reduce((s, z) => s + (z.dauer_minuten || 0), 0);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}:${String(m).padStart(2,'0')}`;
  },

  _roleBadge(u) {
    return u.rolle === 'admin'
      ? `<span style="font-size:.68rem;background:var(--navy);color:#fff;padding:.15rem .5rem;border-radius:20px;font-weight:700;letter-spacing:.03em">Admin</span>`
      : `<span style="font-size:.68rem;background:var(--green-light);color:var(--green);padding:.15rem .5rem;border-radius:20px;font-weight:700;border:1px solid var(--green)22">Mitarbeiter</span>`;
  },

  _cardGrid(u) {
    const tasks = this._taskCount(u.id);
    const hours = this._hoursThisMonth(u.id);
    const isMe = Auth.userId() === u.id;
    const canEdit = Auth.isAdmin() || isMe;

    const coverColors = [
      'linear-gradient(135deg,#0f1e40 0%,#2563eb 100%)',
      'linear-gradient(135deg,#1a1040 0%,#7c3aed 100%)',
      'linear-gradient(135deg,#0a3020 0%,#059669 100%)',
      'linear-gradient(135deg,#2d1010 0%,#dc2626 100%)',
      'linear-gradient(135deg,#2d1e00 0%,#d97706 100%)',
      'linear-gradient(135deg,#002030 0%,#0891b2 100%)',
    ];
    const coverIdx = (u.name || '').charCodeAt(0) % coverColors.length;

    return `
      <div class="team-card" onclick="TeamModule.openProfile('${u.id}')"
        style="background:var(--card);border:1px solid var(--card-border);border-radius:var(--radius-lg);overflow:hidden;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease;position:relative"
        onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,.12)'"
        onmouseleave="this.style.transform='';this.style.boxShadow=''">

        <!-- Cover-Gradient -->
        <div style="height:72px;background:${coverColors[coverIdx]};position:relative">
          ${isMe ? `<div style="position:absolute;top:.5rem;right:.6rem;font-size:.68rem;background:rgba(255,255,255,.2);color:#fff;padding:.15rem .5rem;border-radius:20px;font-weight:600;backdrop-filter:blur(4px)">Ich</div>` : ''}
        </div>

        <!-- Avatar überlappt Cover -->
        <div style="padding:0 1.15rem 1.15rem;margin-top:-28px">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:.65rem">
            <div style="border:3px solid var(--card);border-radius:50%;display:inline-block">
              ${this._avatar(u, 56)}
            </div>
            ${this._roleBadge(u)}
          </div>

          <div style="font-weight:700;font-size:1rem;color:var(--text);line-height:1.2">${u.name || '—'}</div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-top:.15rem">${u.position || 'Keine Position'}</div>

          <div style="margin-top:.85rem;display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
            <div style="background:var(--bg);border-radius:8px;padding:.5rem .65rem;text-align:center">
              <div style="font-size:1.1rem;font-weight:800;color:var(--navy)">${tasks}</div>
              <div style="font-size:.68rem;color:var(--text-muted);margin-top:.05rem">Aufgaben</div>
            </div>
            <div style="background:var(--bg);border-radius:8px;padding:.5rem .65rem;text-align:center">
              <div style="font-size:1.1rem;font-weight:800;color:var(--navy)">${hours}</div>
              <div style="font-size:.68rem;color:var(--text-muted);margin-top:.05rem">Std. (Monat)</div>
            </div>
          </div>

          ${u.telefon || u.email ? `
          <div style="margin-top:.85rem;display:flex;flex-direction:column;gap:.3rem">
            ${u.telefon ? `<div style="font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:.4rem"><i class="fa-solid fa-phone" style="width:12px;color:var(--blue-light)"></i>${u.telefon}</div>` : ''}
            ${u.email ? `<div style="font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:.4rem;word-break:break-all"><i class="fa-solid fa-envelope" style="width:12px;color:var(--blue-light)"></i>${u.email}</div>` : ''}
          </div>` : ''}

          ${canEdit ? `
          <div style="margin-top:.85rem;padding-top:.75rem;border-top:1px solid var(--card-border);display:flex;gap:.4rem" onclick="event.stopPropagation()">
            <button class="btn btn-secondary btn-sm" style="flex:1;font-size:.75rem" onclick="TeamModule.openEditModal('${u.id}')">
              <i class="fa-solid fa-pen"></i> Bearbeiten
            </button>
            <button class="btn btn-sm" style="flex:0;padding:.3rem .55rem;background:var(--bg);border:1px solid var(--card-border);border-radius:var(--radius)" title="Foto hochladen"
              onclick="TeamModule.triggerPhotoUpload('${u.id}')">
              <i class="fa-solid fa-camera" style="color:var(--text-muted)"></i>
            </button>
          </div>` : ''}
        </div>
      </div>`;
  },

  _rowList(u) {
    const tasks = this._taskCount(u.id);
    const isMe = Auth.userId() === u.id;
    const canEdit = Auth.isAdmin() || isMe;
    return `
      <tr style="border-bottom:1px solid var(--card-border);transition:background .15s" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''">
        <td style="padding:.85rem 1rem">
          <div style="display:flex;align-items:center;gap:.75rem;cursor:pointer" onclick="TeamModule.openProfile('${u.id}')">
            ${this._avatar(u, 40)}
            <div>
              <div style="font-weight:700;font-size:.9rem;color:var(--text)">${u.name}${isMe?` <span style="font-size:.65rem;background:var(--navy-light);color:#fff;padding:.1rem .4rem;border-radius:10px">Ich</span>`:''}
              </div>
              <div style="font-size:.75rem;color:var(--text-muted)">${u.position || '—'}</div>
            </div>
          </div>
        </td>
        <td style="padding:.85rem 1rem">
          <div style="font-size:.8rem;color:var(--text-muted)">${u.email || '—'}</div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-top:.15rem">${u.telefon || '—'}</div>
        </td>
        <td style="padding:.85rem 1rem">${this._roleBadge(u)}</td>
        <td style="padding:.85rem 1rem">
          <span style="font-size:.85rem;font-weight:600;color:${tasks>0?'var(--orange)':'var(--text-muted)'}">${tasks} offen</span>
        </td>
        <td style="padding:.85rem 1rem;text-align:right">
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:.4rem">
            <button class="btn btn-secondary btn-sm" onclick="TeamModule.openProfile('${u.id}')"><i class="fa-solid fa-eye"></i></button>
            ${canEdit ? `
            <button class="btn btn-secondary btn-sm" onclick="TeamModule.openEditModal('${u.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm" style="padding:.3rem .55rem;background:var(--bg);border:1px solid var(--card-border);border-radius:var(--radius)" title="Foto" onclick="TeamModule.triggerPhotoUpload('${u.id}')"><i class="fa-solid fa-camera" style="color:var(--text-muted)"></i></button>
            ` : ''}
          </div>
        </td>
      </tr>`;
  },

  /* ── Profil-Detailansicht im Modal ── */
  async openProfile(userId) {
    const u = (this._allUsers || []).find(x => x.id === userId);
    if (!u) return;
    const tasks = this._taskCount(u.id);
    const hours = this._hoursThisMonth(u.id);
    const canEdit = Auth.isAdmin() || Auth.userId() === u.id;

    const perms = u.berechtigungen || {};
    const permLabels = {
      dashboard:'Dashboard', kunden:'Kunden', anfragen:'Angebote', auftraege:'Aufträge',
      nachkalkulation:'Nachkalk.', rechnungen:'Rechnungen', aufgaben:'Aufgaben',
      kalender:'Kalender', zeiterfassung:'Zeiterfassung', chat:'Chat',
      urlaub:'Urlaub', tickets:'Tickets', einstellungen:'Einstellungen',
    };

    const activePerm = u.rolle === 'admin'
      ? Object.keys(permLabels)
      : Object.entries(perms).filter(([,v]) => v).map(([k]) => k);

    openModal(u.name, `
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap;align-items:flex-start">

        <!-- Linke Seite: Foto + Quick Stats -->
        <div style="flex:0 0 140px;display:flex;flex-direction:column;align-items:center;gap:.75rem">
          <div style="position:relative;cursor:${canEdit?'pointer':'default'}" ${canEdit?`onclick="TeamModule.triggerPhotoUpload('${u.id}',true)"`:''}
            title="${canEdit?'Foto ändern':''}">
            ${this._avatar(u, 100)}
            ${canEdit ? `<div style="position:absolute;bottom:2px;right:2px;width:26px;height:26px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;border:2px solid var(--card)"><i class="fa-solid fa-camera"></i></div>` : ''}
          </div>
          ${this._roleBadge(u)}
          <div style="text-align:center;font-size:.78rem;color:var(--text-muted);font-weight:600">${u.position||'—'}</div>

          <div style="width:100%;display:grid;gap:.4rem">
            <div style="background:var(--bg);border-radius:8px;padding:.55rem;text-align:center">
              <div style="font-size:1.3rem;font-weight:800;color:var(--navy)">${tasks}</div>
              <div style="font-size:.7rem;color:var(--text-muted)">Offene Aufgaben</div>
            </div>
            <div style="background:var(--bg);border-radius:8px;padding:.55rem;text-align:center">
              <div style="font-size:1.3rem;font-weight:800;color:var(--navy)">${hours}</div>
              <div style="font-size:.7rem;color:var(--text-muted)">Std. diesen Monat</div>
            </div>
          </div>
        </div>

        <!-- Rechte Seite: Details -->
        <div style="flex:1;min-width:200px">
          <div style="font-size:1.2rem;font-weight:800;color:var(--text);margin-bottom:.2rem">${u.name}</div>
          <div style="font-size:.85rem;color:var(--text-muted);margin-bottom:1.25rem">${u.email||'Keine E-Mail'}</div>

          ${this._detailRow('fa-phone','Telefon', u.telefon)}
          ${this._detailRow('fa-envelope','E-Mail', u.email)}
          ${this._detailRow('fa-location-dot','Adresse', u.adresse)}
          ${this._detailRow('fa-euro-sign','Stundensatz', u.stundensatz ? u.stundensatz + ' €/Std' : null)}
          ${this._detailRow('fa-umbrella-beach','Jahresurlaub', u.urlaub_tage_gesamt ? u.urlaub_tage_gesamt + ' Tage' : null)}

          ${activePerm.length ? `
          <div style="margin-top:1rem">
            <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.5rem">Berechtigungen</div>
            <div style="display:flex;flex-wrap:wrap;gap:.3rem">
              ${activePerm.map(p => `
                <span style="font-size:.72rem;padding:.2rem .5rem;border-radius:20px;background:var(--navy);color:#fff;font-weight:600">
                  ${permLabels[p]||p}
                </span>`).join('')}
            </div>
          </div>` : ''}

          ${canEdit ? `
          <div style="margin-top:1.25rem;display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="closeModal();TeamModule.openEditModal('${u.id}')">
              <i class="fa-solid fa-pen"></i> Bearbeiten
            </button>
            <button class="btn btn-secondary btn-sm" onclick="closeModal();TeamModule.triggerPhotoUpload('${u.id}')">
              <i class="fa-solid fa-camera"></i> Foto ändern
            </button>
          </div>` : ''}
        </div>
      </div>
    `, null, '', '680px');
  },

  _detailRow(icon, label, value) {
    if (!value) return '';
    return `
      <div style="display:flex;align-items:center;gap:.75rem;padding:.4rem 0;border-bottom:1px solid var(--card-border)">
        <div style="width:28px;height:28px;border-radius:7px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fa-solid ${icon}" style="font-size:.75rem;color:var(--blue)"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em">${label}</div>
          <div style="font-size:.875rem;color:var(--text);font-weight:500">${value}</div>
        </div>
      </div>`;
  },

  /* ── Foto-Upload ── */
  triggerPhotoUpload(userId, fromModal = false) {
    let input = document.getElementById('team-photo-input');
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
    input.onchange = e => this._uploadPhoto(userId, e.target.files[0], fromModal);
    input.click();
  },

  async _uploadPhoto(userId, file, fromModal) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Foto darf max. 5 MB groß sein', 'error'); return; }
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      await DB.update('users', userId, { foto_url: dataUrl });
      const idx = (this._allUsers || []).findIndex(u => u.id === userId);
      if (idx >= 0) this._allUsers[idx].foto_url = dataUrl;
      if (Auth.userId() === userId) {
        Auth.saveSession({ ...Auth.currentUser, foto_url: dataUrl });
      }
      showToast('Foto gespeichert', 'success');
      this._renderStats(this._allUsers);
      this._rerender();
      if (fromModal) {
        closeModal();
        await this.openProfile(userId);
      }
    };
    reader.readAsDataURL(file);
  },

  /* ── Bearbeiten-Modal ── */
  async openEditModal(userId) {
    const u = (this._allUsers || []).find(x => x.id === userId);
    if (!u) return;
    const isMe = Auth.userId() === u.id;

    openModal(`${u.name} bearbeiten`, `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Name<span class="required">*</span></label>
          <input class="form-input" id="te-name" value="${u.name||''}" /></div>
        <div class="form-group"><label class="form-label">Position</label>
          <input class="form-input" id="te-pos" value="${u.position||''}" placeholder="z.B. Schlosser, Monteur" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Telefon</label>
          <input class="form-input" id="te-tel" value="${u.telefon||''}" /></div>
        <div class="form-group"><label class="form-label">E-Mail</label>
          <input class="form-input" type="email" id="te-email" value="${u.email||''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Adresse</label>
        <input class="form-input" id="te-adresse" value="${u.adresse||''}" /></div>
      ${Auth.isAdmin() ? `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Stundensatz (€/Std)</label>
          <input class="form-input" type="number" id="te-satz" value="${u.stundensatz||0}" /></div>
        <div class="form-group"><label class="form-label">Jahresurlaub (Tage)</label>
          <input class="form-input" type="number" id="te-urlaub" value="${u.urlaub_tage_gesamt||28}" /></div>
      </div>
      ` : ''}
      ${u.foto_url ? `
      <div style="margin-top:.5rem">
        <button class="btn btn-danger btn-sm" onclick="TeamModule._removePhoto('${u.id}')">
          <i class="fa-solid fa-trash"></i> Foto entfernen
        </button>
      </div>` : ''}
    `, async () => {
      const name = document.getElementById('te-name').value.trim();
      if (!name) { showToast('Name ist ein Pflichtfeld', 'error'); return; }
      const updates = {
        name,
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
      const idx = (this._allUsers || []).findIndex(x => x.id === userId);
      if (idx >= 0) this._allUsers[idx] = { ...this._allUsers[idx], ...updates };
      if (isMe) {
        Auth.saveSession({ ...Auth.currentUser, ...updates });
        updateUserDisplay();
      }
      closeModal();
      showToast(`${name} gespeichert`, 'success');
      this._renderStats(this._allUsers);
      this._rerender();
    }, 'Speichern', '580px');
  },

  async _removePhoto(userId) {
    await DB.update('users', userId, { foto_url: null });
    const idx = (this._allUsers || []).findIndex(u => u.id === userId);
    if (idx >= 0) this._allUsers[idx].foto_url = null;
    closeModal();
    showToast('Foto entfernt', 'info');
    this._renderStats(this._allUsers);
    this._rerender();
  },

  /* ── Neuer Mitarbeiter (nur Admin) ── */
  async openAddMember() {
    openModal('Neuen Mitarbeiter hinzufügen', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Name<span class="required">*</span></label>
          <input class="form-input" id="ta-name" placeholder="Vor- und Nachname" /></div>
        <div class="form-group"><label class="form-label">Position</label>
          <input class="form-input" id="ta-pos" placeholder="z.B. Schlosser, Monteur" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">E-Mail</label>
          <input class="form-input" type="email" id="ta-email" /></div>
        <div class="form-group"><label class="form-label">Telefon</label>
          <input class="form-input" id="ta-tel" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">PIN (4-stellig)<span class="required">*</span></label>
          <input class="form-input pin-input" type="password" id="ta-pin" maxlength="4" inputmode="numeric" placeholder="1234" /></div>
        <div class="form-group"><label class="form-label">Stundensatz (€/Std)</label>
          <input class="form-input" type="number" id="ta-satz" placeholder="45" /></div>
      </div>
      <div class="form-group"><label class="form-label">Jahresurlaub (Tage)</label>
        <input class="form-input" type="number" id="ta-urlaub" value="28" /></div>
    `, async () => {
      const name = document.getElementById('ta-name').value.trim();
      const pin = document.getElementById('ta-pin').value;
      if (!name) { showToast('Name ist Pflichtfeld', 'error'); return; }
      if (pin.length !== 4 || isNaN(pin)) { showToast('PIN muss genau 4 Ziffern haben', 'error'); return; }
      const newUser = {
        name,
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
      showToast(`${name} wurde hinzugefügt`, 'success');
      await this._loadAndRender();
    }, 'Hinzufügen', '580px');
  },
};
