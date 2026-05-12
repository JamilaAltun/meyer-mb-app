/* Nachricht aus dem text-Feld dekodieren (unterstützt reinen Text + JSON mit Bildern) */
function _chatDecode(m) {
  try {
    if (m.text?.startsWith('{"_c":1')) {
      const p = JSON.parse(m.text);
      return { ...m, text: p.text || '', bilder: p.bilder || [] };
    }
  } catch {}
  return { ...m, bilder: [] };
}

/* Nachricht ins text-Feld kodieren */
function _chatEncode(text, bilder) {
  if (!bilder.length) return text;
  return JSON.stringify({ _c: 1, text: text || '', bilder });
}

const ChatModule = {
  activeContact: null,
  _pendingFiles: [],

  async render() {
    const users = await DB.getAll('users');
    const currentId = Auth.userId();
    const contacts = users.filter(u => u.id !== currentId);

    setContent(`
      <div class="module-header"><div class="module-title">Chat</div></div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="chat-layout">
          <div class="chat-list">
            ${contacts.length ? contacts.map(u => `
              <div class="chat-list-item ${this.activeContact===u.id?'active':''}" onclick="ChatModule.openContact('${u.id}')">
                <div class="chat-avatar-sm">${u.name.charAt(0)}</div>
                <div class="chat-list-info">
                  <div class="chat-list-name">${u.name}</div>
                  <div class="chat-list-preview">${u.position||'—'}</div>
                </div>
              </div>`).join('')
            : '<div style="padding:1rem;color:var(--text-muted);font-size:.85rem">Keine weiteren Nutzer</div>'}
          </div>
          <div class="chat-window" id="chat-window">
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:.9rem">
              Kontakt auswählen
            </div>
          </div>
        </div>
      </div>`);

    if (this.activeContact) this.openContact(this.activeContact);
  },

  async openContact(userId) {
    this.activeContact = userId;
    ChatModule._pendingFiles = [];
    const users = await DB.getAll('users');
    const contact = users.find(u => u.id === userId);
    if (!contact) return;

    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.chat-list-item').forEach(el => {
      if (el.getAttribute('onclick')?.includes(userId)) el.classList.add('active');
    });

    const currentId = Auth.userId();
    const allMsgs = await DB.getAll('chat_nachrichten');
    const msgs = allMsgs
      .filter(m =>
        (m.von_user_id === currentId && m.an_user_id === userId) ||
        (m.von_user_id === userId && m.an_user_id === currentId)
      )
      .sort((a, b) => new Date(a.erstellt_am) - new Date(b.erstellt_am))
      .map(_chatDecode);

    for (const m of msgs.filter(m => m.an_user_id === currentId && !m.gelesen)) {
      await DB.update('chat_nachrichten', m.id, { gelesen: true });
    }
    updateBadges();

    const win = document.getElementById('chat-window');
    win.innerHTML = `
      <div class="chat-window-header">
        <div class="chat-avatar-sm">${contact.name.charAt(0)}</div>
        <div><strong>${contact.name}</strong><br><small style="color:var(--text-muted)">${contact.position||'—'}</small></div>
      </div>
      <div class="chat-messages" id="chat-msgs">
        ${msgs.length
          ? msgs.map(m => this._renderMsg(m, currentId, contact)).join('')
          : '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:.875rem">Noch keine Nachrichten. Schreib etwas!</div>'}
      </div>
      <div class="chat-input-area">
        <div class="chat-image-preview hidden" id="chat-img-preview">
          <div class="chat-img-preview-list" id="chat-img-preview-list"></div>
        </div>
        <div class="chat-input-bar">
          <input type="file" id="chat-file-input" accept="image/*" multiple style="display:none" />
          <button class="chat-img-btn" onclick="document.getElementById('chat-file-input').click()" title="Bilder senden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <input class="chat-input" id="chat-input" placeholder="Nachricht schreiben..." />
          <button class="btn btn-primary" id="chat-send-btn" onclick="ChatModule.send('${userId}')">Senden</button>
        </div>
      </div>`;

    const msgsEl = document.getElementById('chat-msgs');
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

    document.getElementById('chat-input')?.addEventListener('keyup', e => {
      if (e.key === 'Enter') ChatModule.send(userId);
    });

    document.getElementById('chat-file-input')?.addEventListener('change', e => {
      ChatModule._onFilesSelected(e);
    });
  },

  _renderMsg(m, currentId, contact) {
    const isMine = m.von_user_id === currentId;
    const avatar = isMine ? 'Ich' : contact.name.charAt(0);
    const bilder = m.bilder || [];
    let content = '';
    if (bilder.length) {
      content += `<div class="chat-img-grid">${bilder.map(src =>
        `<img class="chat-bubble-img" src="${src}" alt="Bild" onclick="ChatModule._openImg(this.src)" />`
      ).join('')}</div>`;
    }
    if (m.text) content += `<div class="chat-bubble">${m.text}</div>`;
    if (!content) content = `<div class="chat-bubble"></div>`;
    return `
      <div class="chat-msg ${isMine?'mine':''}">
        <div class="chat-avatar-sm" style="width:28px;height:28px;font-size:.75rem">${avatar}</div>
        <div>${content}<div class="chat-time">${formatDateTime(m.erstellt_am)}</div></div>
      </div>`;
  },

  _compressImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  },

  _onFilesSelected(e) {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (!files.length) return;

    for (const file of files) {
      const idx = ChatModule._pendingFiles.length;
      ChatModule._pendingFiles.push(file);

      const preview = document.getElementById('chat-img-preview');
      const list   = document.getElementById('chat-img-preview-list');
      if (!preview || !list) return;

      const previewUrl = URL.createObjectURL(file);
      const item = document.createElement('div');
      item.className = 'chat-img-preview-item';
      item.dataset.idx = idx;
      item.innerHTML = `
        <img src="${previewUrl}" alt="Vorschau" />
        <button class="chat-img-remove" onclick="ChatModule.removeImage(${idx})" title="Entfernen">✕</button>`;
      list.appendChild(item);
      preview.classList.remove('hidden');
    }
  },

  removeImage(idx) {
    ChatModule._pendingFiles[idx] = null;
    document.querySelector(`.chat-img-preview-item[data-idx="${idx}"]`)?.remove();
    if (!ChatModule._pendingFiles.some(Boolean)) {
      document.getElementById('chat-img-preview')?.classList.add('hidden');
    }
  },

  async send(toUserId) {
    const input = document.getElementById('chat-input');
    const text  = input?.value.trim();
    const files = ChatModule._pendingFiles.filter(Boolean);

    if (!text && !files.length) return;

    const btn = document.getElementById('chat-send-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      /* Bilder komprimieren */
      const bilder = [];
      for (const file of files) {
        const b64 = await ChatModule._compressImage(file);
        if (b64) bilder.push(b64);
      }

      /* Alles ins text-Feld kodieren */
      const encodedText = _chatEncode(text, bilder);

      await DB.insert('chat_nachrichten', {
        von_user_id: Auth.userId(),
        an_user_id: toUserId,
        text: encodedText,
        gelesen: false,
      });

      if (input) input.value = '';
      ChatModule._pendingFiles = [];
      await ChatModule.openContact(toUserId);
    } catch (err) {
      console.error('[Chat] Senden fehlgeschlagen:', err);
      showToast('Nachricht konnte nicht gesendet werden', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Senden'; }
    }
  },

  _openImg(src) {
    if (!src) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out';
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.6)';
    overlay.appendChild(img);
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  },
};
