const EinstellungenModule = {
  activeTab: 'firma',

  async render() {
    setContent(`
      <div class="module-header"><div class="module-title">Einstellungen</div></div>
      <div class="tabs">
        ${[['firma','Firmendaten'],['logo','Logo'],['mitarbeiter','Mitarbeiter & Berechtigungen'],['nummern','Nummernkreise'],['zahlung','Zahlungsbedingungen'],['zeiterfassung','Zeiterfassung'],['backup','Backups'],['demo','Demo-Daten']].map(([k,l]) =>
          `<div class="tab-btn ${this.activeTab===k?'active':''}" onclick="EinstellungenModule.activeTab='${k}';EinstellungenModule.renderTab()">${l}</div>`
        ).join('')}
      </div>
      <div id="einst-tab-content"></div>`);
    this.renderTab();
  },

  renderTab() {
    const container = document.getElementById('einst-tab-content');
    document.querySelectorAll('.tab-btn').forEach(b => {
      const tabs = ['firma','logo','mitarbeiter','nummern','zahlung','zeiterfassung','backup'];
      b.classList.toggle('active', tabs.some((t,i) => b.getAttribute('onclick')?.includes(`'${t}'`) && this.activeTab === t));
    });
    const map = { firma: () => this.renderFirma(), logo: () => this.renderLogo(), mitarbeiter: () => this.renderMitarbeiter(), nummern: () => this.renderNummern(), zahlung: () => this.renderZahlung(), zeiterfassung: () => this.renderZeiterfassung(), backup: () => BackupModule.renderTab(), demo: () => this.renderDemo() };
    map[this.activeTab]?.();
  },

  renderFirma() {
    const s = Settings.get();
    document.getElementById('einst-tab-content').innerHTML = `
      <div class="card" style="max-width:600px">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Firmenname</label><input class="form-input" id="s-name" value="${s.firma_name||''}" /></div>
          <div class="form-group"><label class="form-label">Geschäftsführer</label><input class="form-input" id="s-gf" value="${s.geschaeftsfuehrer||''}" /></div>
        </div>
        <div class="form-group"><label class="form-label">Straße</label><input class="form-input" id="s-str" value="${s.strasse||''}" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">PLZ</label><input class="form-input" id="s-plz" value="${s.plz||''}" /></div>
          <div class="form-group"><label class="form-label">Ort</label><input class="form-input" id="s-ort" value="${s.ort||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Telefon</label><input class="form-input" id="s-tel" value="${s.telefon||''}" /></div>
          <div class="form-group"><label class="form-label">E-Mail</label><input class="form-input" id="s-email" value="${s.email||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Steuernummer</label><input class="form-input" id="s-stnr" value="${s.steuernummer||''}" /></div>
          <div class="form-group"><label class="form-label">USt-ID</label><input class="form-input" id="s-ustid" value="${s.ust_id||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">IBAN</label><input class="form-input" id="s-iban" value="${s.iban||''}" /></div>
          <div class="form-group"><label class="form-label">BIC</label><input class="form-input" id="s-bic" value="${s.bic||''}" /></div>
        </div>
        <button class="btn btn-primary" onclick="EinstellungenModule.saveFirma()">Speichern</button>
      </div>`;
  },

  saveFirma() {
    Settings.set({
      firma_name: document.getElementById('s-name').value.trim(),
      geschaeftsfuehrer: document.getElementById('s-gf').value.trim(),
      strasse: document.getElementById('s-str').value.trim(),
      plz: document.getElementById('s-plz').value.trim(),
      ort: document.getElementById('s-ort').value.trim(),
      telefon: document.getElementById('s-tel').value.trim(),
      email: document.getElementById('s-email').value.trim(),
      steuernummer: document.getElementById('s-stnr').value.trim(),
      ust_id: document.getElementById('s-ustid').value.trim(),
      iban: document.getElementById('s-iban').value.trim(),
      bic: document.getElementById('s-bic').value.trim(),
    });
    showToast('Firmendaten gespeichert', 'success');
  },

  renderLogo() {
    const s = Settings.get();
    document.getElementById('einst-tab-content').innerHTML = `
      <div class="card" style="max-width:500px">
        <div class="card-header"><span class="card-title">Firmenlogo</span></div>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem">Das Logo erscheint in der Sidebar, auf dem Login-Bildschirm und in allen PDFs.</p>
        ${s.logo_url
          ? `<div style="margin-bottom:1rem;padding:.75rem;background:#ffffff;border:1px solid var(--card-border);border-radius:var(--radius);display:inline-block">
               <img src="${s.logo_url}" alt="Logo" style="max-height:80px;max-width:220px;object-fit:contain" />
             </div>`
          : '<p style="color:var(--text-muted);margin-bottom:1rem;font-size:.875rem">Noch kein Logo hochgeladen.</p>'}
        <div class="upload-zone" onclick="document.getElementById('logo-file').click()" style="cursor:pointer">
          <div class="upload-icon"><i class="fa-solid fa-cloud-arrow-up" style="font-size:1.5rem;color:var(--navy)"></i></div>
          <div class="upload-text">${s.logo_url ? 'Logo ersetzen' : 'Logo hochladen'}</div>
          <div class="upload-hint">PNG, JPG oder SVG — wird sofort in der App angezeigt</div>
        </div>
        <input type="file" id="logo-file" accept="image/*" style="display:none" onchange="EinstellungenModule.uploadLogo(this)" />
        ${s.logo_url ? `<button class="btn btn-danger btn-sm" style="margin-top:.75rem" onclick="EinstellungenModule.removeLogo()">Logo entfernen</button>` : ''}
      </div>`;
  },

  uploadLogo(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      Settings.set({ logo_url: e.target.result });
      document.getElementById('sidebar-logo-img').src = e.target.result;
      const loginLogo = document.getElementById('login-logo-img');
      if (loginLogo) loginLogo.src = e.target.result;
      showToast('Logo gespeichert', 'success');
      this.renderLogo();
    };
    reader.readAsDataURL(file);
  },

  removeLogo() {
    Settings.set({ logo_url: '' });
    document.getElementById('sidebar-logo-img').src = 'assets/logo-placeholder.svg';
    showToast('Logo entfernt', 'info');
    this.renderLogo();
  },

  async renderMitarbeiter() {
    const users = await DB.getAll('users');
    const perms = ['dashboard','kunden','anfragen','auftraege','nachkalkulation','rechnungen','aufgaben','kalender','zeiterfassung','chat','urlaub','tickets','team','einstellungen'];
    const permLabels = { dashboard:'Dashboard', kunden:'Kunden', anfragen:'Angebote', auftraege:'Aufträge', nachkalkulation:'Nachkalk.', rechnungen:'Rechnungen', aufgaben:'Aufgaben', kalender:'Kalender', zeiterfassung:'Zeiterfassung', chat:'Chat', urlaub:'Urlaub', tickets:'Tickets', team:'Team', einstellungen:'Einstellungen' };

    document.getElementById('einst-tab-content').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;flex-wrap:wrap;gap:.75rem">
        <div>
          <div style="font-weight:700;font-size:1rem;margin-bottom:.2rem">Mitarbeiterverwaltung</div>
          <div style="font-size:.82rem;color:var(--text-muted)">${users.length} Mitarbeiter — Haken setzen um Zugriff zu erlauben</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="EinstellungenModule.openUserForm()">
          <i class="fa-solid fa-user-plus"></i> Mitarbeiter anlegen
        </button>
      </div>

      <!-- Mitarbeiter-Karten -->
      <div style="display:grid;gap:.75rem;margin-bottom:1.5rem">
        ${users.map(u => `
          <div class="card" style="padding:1rem">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.85rem">
              <div style="display:flex;align-items:center;gap:.75rem">
                <div style="width:40px;height:40px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0">${u.name.charAt(0)}</div>
                <div>
                  <div style="font-weight:700">${u.name} ${u.rolle==='admin'?'<span style="font-size:.68rem;background:var(--navy);color:#fff;padding:.1rem .4rem;border-radius:4px;margin-left:.3rem">Admin</span>':''}</div>
                  <div style="font-size:.78rem;color:var(--text-muted)">${u.position||'—'}</div>
                </div>
              </div>
              <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                <button class="btn btn-warning btn-sm" onclick="EinstellungenModule.resetPin('${u.id}','${u.name.replace(/'/g,'')}')">PIN zurücksetzen</button>
                <button class="btn btn-secondary btn-sm" onclick="EinstellungenModule.sendInvite('${u.name.replace(/'/g,'')}','${u.position||''}')">Einladung senden</button>
                ${u.rolle !== 'admin' ? `<button class="btn btn-danger btn-sm" onclick="EinstellungenModule.deleteUser('${u.id}','${u.name.replace(/'/g,'')}')">Löschen</button>` : ''}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
              <label style="font-size:.82rem;color:var(--text-muted)">Stundensatz:</label>
              <input type="number" value="${u.stundensatz||0}" style="width:70px;padding:.25rem .4rem;border:1px solid var(--card-border);border-radius:4px;font-size:.82rem;background:var(--card);color:var(--text)" onchange="EinstellungenModule.saveStundensatz('${u.id}',this.value)" />
              <span style="font-size:.78rem;color:var(--text-muted)">€/Std</span>
            </div>
            <div style="font-size:.78rem;font-weight:600;color:var(--text-muted);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.04em">Berechtigungen</div>
            <div style="display:flex;flex-wrap:wrap;gap:.35rem">
              ${perms.map(p => `
                <label style="display:flex;align-items:center;gap:.3rem;padding:.3rem .6rem;border:1px solid var(--card-border);border-radius:20px;font-size:.78rem;cursor:${u.rolle==='admin'?'default':'pointer'};background:${u.rolle==='admin'||u.berechtigungen?.[p]?'var(--navy)':'transparent'};color:${u.rolle==='admin'||u.berechtigungen?.[p]?'#fff':'var(--text-muted)'}">
                  <input type="checkbox" style="display:none" ${u.rolle==='admin'||u.berechtigungen?.[p]?'checked':''} ${u.rolle==='admin'?'disabled':''} onchange="EinstellungenModule.togglePermLabel(this,'${u.id}','${p}',this.checked)" />
                  ${permLabels[p]}
                </label>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
  },

  togglePermLabel(el, userId, perm, value) {
    const label = el.closest('label');
    label.style.background = value ? 'var(--navy)' : 'transparent';
    label.style.color = value ? '#fff' : 'var(--text-muted)';
    this.togglePerm(userId, perm, value);
  },

  async deleteUser(userId, name) {
    confirmDelete(name, async () => {
      await DB.delete('users', userId);
      showToast(`${name} wurde gelöscht`, 'info');
      this.renderMitarbeiter();
    });
  },

  sendInvite(name, position) {
    const s = Settings.get();
    const appUrl = window.location.href;
    const subject = encodeURIComponent(`Zugang zur Meyer Metallbau App`);
    const body = encodeURIComponent(
`Hallo ${name},

du wurdest als ${position || 'Mitarbeiter'} für die ${s.firma_name || 'Meyer Metallbau GmbH'} App eingerichtet.

So geht es:
1. Öffne folgende Adresse im Browser: ${appUrl}
2. Wähle deinen Namen aus der Liste
3. Gib deinen 4-stelligen PIN ein

Bei Fragen wende dich an den Administrator.

${s.firma_name || 'Meyer Metallbau GmbH'}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
    showToast('E-Mail-Programm wurde geöffnet', 'success');
  },

  async togglePerm(userId, perm, value) {
    const user = await DB.getById('users', userId);
    if (!user || user.rolle === 'admin') return;
    const perms = { ...(user.berechtigungen || {}), [perm]: value };
    await DB.update('users', userId, { berechtigungen: perms });
  },

  async saveStundensatz(userId, value) {
    await DB.update('users', userId, { stundensatz: parseFloat(value)||0 });
    showToast('Stundensatz gespeichert', 'success');
  },

  async resetPin(userId, name) {
    openModal(`PIN zurücksetzen: ${name}`, `
      <div class="form-group"><label class="form-label">Neuer PIN (4 Stellen)</label>
        <input class="form-input pin-input" type="password" id="new-pin" maxlength="4" inputmode="numeric" /></div>
    `, async () => {
      const pin = document.getElementById('new-pin').value;
      if (pin.length !== 4 || isNaN(pin)) { showToast('PIN muss 4-stellig numerisch sein', 'error'); return; }
      await DB.update('users', userId, { pin_hash: simpleHash(pin) });
      closeModal(); showToast(`PIN für ${name} zurückgesetzt`, 'success');
    }, 'Setzen');
  },

  async openUserForm() {
    openModal('Neuer Mitarbeiter anlegen', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Name<span class="required">*</span></label><input class="form-input" id="nu-name" placeholder="Vor- und Nachname" /></div>
        <div class="form-group"><label class="form-label">Position</label><input class="form-input" id="nu-pos" placeholder="z.B. Monteur, Schlosser" /></div>
      </div>
      <div class="form-group"><label class="form-label">E-Mail (für Einladung)</label><input class="form-input" type="email" id="nu-email" placeholder="mitarbeiter@firma.de" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">PIN (4-stellig)<span class="required">*</span></label><input class="form-input pin-input" type="password" id="nu-pin" maxlength="4" inputmode="numeric" placeholder="z.B. 1234" /></div>
        <div class="form-group"><label class="form-label">Stundensatz (€/Std)</label><input class="form-input" type="number" id="nu-satz" placeholder="45" /></div>
      </div>
      <div class="form-group"><label class="form-label">Jahresurlaub (Tage)</label><input class="form-input" type="number" id="nu-urlaub" value="28" /></div>
      <div style="margin-top:.5rem">
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.875rem">
          <input type="checkbox" id="nu-invite" checked />
          Nach dem Anlegen Einladungs-E-Mail öffnen
        </label>
      </div>
    `, async () => {
      const name = document.getElementById('nu-name').value.trim();
      const pin = document.getElementById('nu-pin').value;
      const email = document.getElementById('nu-email').value.trim();
      const invite = document.getElementById('nu-invite').checked;
      if (!name || pin.length !== 4) { showToast('Name und 4-stelliger PIN sind Pflichtfelder', 'error'); return; }
      const pos = document.getElementById('nu-pos').value.trim();
      await DB.insert('users', {
        name, position: pos, email,
        pin_hash: simpleHash(pin), rolle: 'mitarbeiter',
        stundensatz: parseFloat(document.getElementById('nu-satz').value)||0,
        urlaub_tage_gesamt: parseInt(document.getElementById('nu-urlaub').value)||28,
        berechtigungen: { dashboard: true, aufgaben: true, kalender: true, chat: true, tickets: true, zeiterfassung: true, team: true },
        dark_mode: false
      });
      closeModal();
      showToast(`${name} wurde angelegt`, 'success');
      this.renderMitarbeiter();
      if (invite) {
        const s = Settings.get();
        const subject = encodeURIComponent(`Zugang zur ${s.firma_name || 'Meyer Metallbau'} App`);
        const body = encodeURIComponent(`Hallo ${name},\n\ndu wurdest als ${pos || 'Mitarbeiter'} in der App eingerichtet.\n\nApp-Adresse: ${window.location.href}\nDein PIN: ${pin}\n\nBitte ändere deinen PIN nach dem ersten Login.\n\n${s.firma_name || 'Meyer Metallbau GmbH'}`);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`);
      }
    }, 'Anlegen', 'lg');
  },

  renderNummern() {
    const s = Settings.get();
    document.getElementById('einst-tab-content').innerHTML = `
      <div class="card" style="max-width:400px">
        <div class="form-group"><label class="form-label">Nächste Angebotsnummer</label><input class="form-input" type="number" id="s-ang-nr" value="${s.angebot_startnummer||1}" /></div>
        <div class="form-group"><label class="form-label">Nächste Rechnungsnummer</label><input class="form-input" type="number" id="s-rech-nr" value="${s.rechnung_startnummer||1}" /></div>
        <div class="form-group"><label class="form-label">Nächste Auftragsnummer</label><input class="form-input" type="number" id="s-auf-nr" value="${s.auftrag_startnummer||1}" /></div>
        <button class="btn btn-primary" onclick="EinstellungenModule.saveNummern()">Speichern</button>
      </div>`;
  },

  saveNummern() {
    Settings.set({ angebot_startnummer: parseInt(document.getElementById('s-ang-nr').value)||1, rechnung_startnummer: parseInt(document.getElementById('s-rech-nr').value)||1, auftrag_startnummer: parseInt(document.getElementById('s-auf-nr').value)||1 });
    showToast('Nummernkreise gespeichert', 'success');
  },

  renderZahlung() {
    const s = Settings.get();
    document.getElementById('einst-tab-content').innerHTML = `
      <div class="card" style="max-width:400px">
        <div class="form-group"><label class="form-label">Standard-Zahlungsziel</label><input class="form-input" id="s-zahlungsziel" value="${s.zahlungsziel_standard||'14 Tage netto'}" placeholder="z.B. 14 Tage netto" /></div>
        <div class="form-group"><label class="form-label">Skonto-Text (optional)</label><input class="form-input" id="s-skonto" value="${s.skonto_text||''}" placeholder="z.B. 2% Skonto bei Zahlung innerhalb 7 Tagen" /></div>
        <button class="btn btn-primary" onclick="EinstellungenModule.saveZahlung()">Speichern</button>
      </div>`;
  },

  saveZahlung() {
    Settings.set({ zahlungsziel_standard: document.getElementById('s-zahlungsziel').value.trim(), skonto_text: document.getElementById('s-skonto').value.trim() });
    showToast('Zahlungsbedingungen gespeichert', 'success');
  },

  renderZeiterfassung() {
    const kategorien = Settings.get().zeit_kategorien || [];
    document.getElementById('einst-tab-content').innerHTML = `
      <div class="card" style="max-width:600px">
        <div class="card-header"><span class="card-title">Projektkategorien</span></div>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem">
          Definieren Sie Bereiche, die Mitarbeiter bei der Zeiterfassung auswählen können (z.B. "Werkstatt", "Büro", "Instandhaltung"). Aktive Aufträge werden automatisch als Optionen angeboten.
        </p>
        <div id="zeit-kat-list" style="margin-bottom:1rem">
          ${kategorien.length ? kategorien.map((k, i) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;background:var(--bg);border-radius:var(--radius);margin-bottom:.4rem">
              <span style="font-weight:500">${k}</span>
              <button class="btn btn-danger btn-sm" onclick="EinstellungenModule.removeZeitKategorie(${i})">Entfernen</button>
            </div>`).join('')
          : '<p style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">Noch keine Kategorien definiert</p>'}
        </div>
        <div style="display:flex;gap:.5rem">
          <input class="form-input" id="zeit-kat-input" placeholder="Neue Kategorie (z.B. Werkstatt)" onkeydown="if(event.key==='Enter')EinstellungenModule.addZeitKategorie()" />
          <button class="btn btn-primary" onclick="EinstellungenModule.addZeitKategorie()">Hinzufügen</button>
        </div>
      </div>`;
  },

  addZeitKategorie() {
    const input = document.getElementById('zeit-kat-input');
    const val = input?.value.trim();
    if (!val) return;
    const kategorien = Settings.get().zeit_kategorien || [];
    if (kategorien.includes(val)) { showToast('Diese Kategorie existiert bereits', 'warn'); return; }
    Settings.set({ zeit_kategorien: [...kategorien, val] });
    showToast(`"${val}" hinzugefügt`, 'success');
    this.renderZeiterfassung();
  },

  removeZeitKategorie(index) {
    const kategorien = [...(Settings.get().zeit_kategorien || [])];
    kategorien.splice(index, 1);
    Settings.set({ zeit_kategorien: kategorien });
    this.renderZeiterfassung();
  },

  renderDemo() {
    document.getElementById('einst-tab-content').innerHTML = `
      <div class="card" style="max-width:560px">
        <div class="card-header"><span class="card-title">Demo-Daten</span></div>
        <p style="font-size:.875rem;color:var(--text-muted);margin-bottom:1.25rem;line-height:1.6">
          Lädt realistische Musterdaten (Kunden, Anfragen, Angebote, Aufträge, Rechnungen, Nachkalkulation) in die App, damit alle Bereiche direkt befüllt angezeigt werden.
        </p>

        <div style="background:var(--bg);border-radius:var(--radius);padding:1rem;margin-bottom:1.25rem;font-size:.85rem;line-height:1.7">
          <div style="font-weight:700;margin-bottom:.5rem;font-size:.9rem">Enthaltene Beispieldaten:</div>
          <div><strong>Kunden:</strong> Baugesellschaft Müller GmbH · Hans Schmidt · Architekturbüro Weber</div>
          <div><strong>Anfragen:</strong> Treppengeländer · Einfahrtstor · Balkongeländer</div>
          <div><strong>Angebote:</strong> A-2025-001 (angenommen) · A-2025-002 (gesendet) · A-2025-003 (Entwurf)</div>
          <div><strong>Aufträge:</strong> AU-2025-001 (Montage) · AU-2025-002 (Fertig)</div>
          <div><strong>Rechnungen:</strong> R-2025-001 Abschlag (offen) · R-2025-002 Schluss (bezahlt)</div>
          <div><strong>Nachkalkulation:</strong> Soll/Ist-Werte für beide Aufträge</div>
        </div>

        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="EinstellungenModule.confirmLoadDemo()">
            Demo-Daten laden
          </button>
          <button class="btn btn-danger" onclick="EinstellungenModule.confirmClearDemo()">
            Demo-Daten löschen
          </button>
        </div>
        <p style="font-size:.78rem;color:var(--text-muted);margin-top:.75rem">
          Hinweis: Beim Laden werden alle vorhandenen Daten in den genannten Bereichen überschrieben.
        </p>
      </div>`;
  },

  confirmLoadDemo() {
    openModal('Demo-Daten laden', `
      <p>Alle vorhandenen Einträge in <strong>Kunden, Anfragen, Angebote, Aufträge, Rechnungen und Nachkalkulation</strong> werden durch die Beispieldaten ersetzt.</p>
      <p style="margin-top:.5rem">Fortfahren?</p>
    `, () => { closeModal(); DemoData.load(); }, 'Ja, laden');
  },

  confirmClearDemo() {
    openModal('Demo-Daten löschen', `
      <p>Alle Einträge in <strong>Kunden, Anfragen, Angebote, Aufträge, Rechnungen und Nachkalkulation</strong> werden gelöscht.</p>
      <p style="margin-top:.5rem">Wirklich löschen?</p>
    `, () => { closeModal(); DemoData.clear(); }, 'Ja, alles löschen');
    document.getElementById('modal-confirm-btn').className = 'btn btn-danger';
  },
};
