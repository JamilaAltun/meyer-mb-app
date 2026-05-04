const ChatModule = {
  activeContact: null,

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
              </div>`).join('') : '<div style="padding:1rem;color:var(--text-muted);font-size:.85rem">Keine weiteren Nutzer</div>'}
          </div>
          <div class="chat-window" id="chat-window">
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:.9rem">
              👈 Kontakt auswählen
            </div>
          </div>
        </div>
      </div>`);

    if (this.activeContact) this.openContact(this.activeContact);
  },

  async openContact(userId) {
    this.activeContact = userId;
    const users = await DB.getAll('users');
    const contact = users.find(u => u.id === userId);
    if (!contact) return;

    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.chat-list-item').forEach(el => {
      if (el.getAttribute('onclick')?.includes(userId)) el.classList.add('active');
    });

    const currentId = Auth.userId();
    const allMsgs = await DB.getAll('chat_nachrichten');
    const msgs = allMsgs.filter(m =>
      (m.von_user_id === currentId && m.an_user_id === userId) ||
      (m.von_user_id === userId && m.an_user_id === currentId)
    ).sort((a,b) => new Date(a.erstellt_am) - new Date(b.erstellt_am));

    /* Als gelesen markieren */
    for (const m of msgs.filter(m => m.an_user_id === currentId && !m.gelesen)) {
      await DB.update('chat_nachrichten', m.id, { gelesen: true });
    }
    updateBadges();

    const window = document.getElementById('chat-window');
    window.innerHTML = `
      <div class="chat-window-header">
        <div class="chat-avatar-sm">${contact.name.charAt(0)}</div>
        <div><strong>${contact.name}</strong><br><small style="color:var(--text-muted)">${contact.position||'—'}</small></div>
      </div>
      <div class="chat-messages" id="chat-msgs">
        ${msgs.length ? msgs.map(m => `
          <div class="chat-msg ${m.von_user_id===currentId?'mine':''}">
            <div class="chat-avatar-sm" style="width:28px;height:28px;font-size:.75rem">${m.von_user_id===currentId?'Ich':contact.name.charAt(0)}</div>
            <div>
              <div class="chat-bubble">${m.text}</div>
              <div class="chat-time">${formatDateTime(m.erstellt_am)}</div>
            </div>
          </div>`).join('') : '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:.875rem">Noch keine Nachrichten. Schreib etwas! 👋</div>'}
      </div>
      <div class="chat-input-bar">
        <input class="chat-input" id="chat-input" placeholder="Nachricht schreiben..." />
        <button class="btn btn-primary" onclick="ChatModule.send('${userId}')">Senden</button>
      </div>`;

    const msgsEl = document.getElementById('chat-msgs');
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

    document.getElementById('chat-input')?.addEventListener('keyup', e => {
      if (e.key === 'Enter') ChatModule.send(userId);
    });
  },

  async send(toUserId) {
    const input = document.getElementById('chat-input');
    const text = input?.value.trim();
    if (!text) return;
    await DB.insert('chat_nachrichten', { von_user_id: Auth.userId(), an_user_id: toUserId, text, gelesen: false });
    input.value = '';
    await this.openContact(toUserId);
  },
};
