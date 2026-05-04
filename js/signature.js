const SignatureModule = {
  canvas: null,
  ctx: null,
  drawing: false,
  lastX: 0,
  lastY: 0,

  openPad(auftragId, auftragNummer) {
    openModal(`Unterschrift – Auftrag ${auftragNummer}`, `
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:.75rem">
        Bitte hier unterschreiben:
      </p>
      <div style="border:2px solid var(--card-border);border-radius:var(--radius);overflow:hidden;background:#fff">
        <canvas id="sig-canvas" width="500" height="200" style="display:block;width:100%;touch-action:none;cursor:crosshair"></canvas>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:.75rem">
        <button class="btn btn-ghost btn-sm" onclick="SignatureModule.clear()">Löschen</button>
        <span style="flex:1"></span>
        <small style="color:var(--text-muted);align-self:center">Unterschrift des Kunden</small>
      </div>
    `, () => this.save(auftragId), 'Speichern');

    requestAnimationFrame(() => this.initCanvas());
  },

  initCanvas() {
    this.canvas = document.getElementById('sig-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.strokeStyle = '#1a1a1a';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.canvas.addEventListener('mousedown', e => this.startDraw(e));
    this.canvas.addEventListener('mousemove', e => this.draw(e));
    this.canvas.addEventListener('mouseup', () => { this.drawing = false; });
    this.canvas.addEventListener('mouseleave', () => { this.drawing = false; });

    this.canvas.addEventListener('touchstart', e => { e.preventDefault(); this.startDraw(e.touches[0]); }, { passive: false });
    this.canvas.addEventListener('touchmove', e => { e.preventDefault(); this.draw(e.touches[0]); }, { passive: false });
    this.canvas.addEventListener('touchend', () => { this.drawing = false; });
  },

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  },

  startDraw(e) {
    this.drawing = true;
    const pos = this.getPos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
    this.ctx.fill();
  },

  draw(e) {
    if (!this.drawing) return;
    const pos = this.getPos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.lastX = pos.x;
    this.lastY = pos.y;
  },

  clear() {
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },

  isEmpty() {
    if (!this.canvas || !this.ctx) return true;
    const data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    return !data.some(v => v !== 0);
  },

  async save(auftragId) {
    if (this.isEmpty()) {
      showToast('Bitte zuerst unterschreiben', 'error');
      return;
    }
    const dataUrl = this.canvas.toDataURL('image/png');
    const existing = (await DB.getAll('unterschriften')).find(u => u.auftrag_id === auftragId);
    if (existing) {
      await DB.update('unterschriften', existing.id, { storage_url: dataUrl, datum: new Date().toISOString(), unterzeichnet_von: Auth.userId() });
    } else {
      await DB.insert('unterschriften', { auftrag_id: auftragId, storage_url: dataUrl, datum: new Date().toISOString(), unterzeichnet_von: Auth.userId() });
    }
    closeModal();
    showToast('Unterschrift gespeichert', 'success');
  },

  async renderInAuftrag(auftragId, auftragNummer) {
    const sigs = await DB.getAll('unterschriften');
    const sig = sigs.find(s => s.auftrag_id === auftragId);
    const users = await DB.getAll('users');
    const um = {}; users.forEach(u => um[u.id] = u);

    return `
      <div class="card">
        <div class="card-header"><span class="card-title">Kundenunterschrift</span></div>
        ${sig ? `
          <div style="margin-bottom:.75rem">
            <img src="${sig.storage_url}" alt="Unterschrift" style="max-width:100%;border:1px solid var(--card-border);border-radius:var(--radius);background:#fff" />
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.4rem">
              Unterzeichnet: ${formatDate(sig.datum)} – ${um[sig.unterzeichnet_von]?.name || '—'}
            </div>
          </div>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-ghost btn-sm" onclick="SignatureModule.openPad('${auftragId}','${auftragNummer}')">Neu unterschreiben</button>
            <button class="btn btn-ghost btn-sm" onclick="SignatureModule.download('${auftragId}','${auftragNummer}')">⬇ Download</button>
          </div>
        ` : `
          <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:.75rem">Noch keine Unterschrift vorhanden.</p>
          <button class="btn btn-primary btn-sm" onclick="SignatureModule.openPad('${auftragId}','${auftragNummer}')">✍ Jetzt unterschreiben</button>
        `}
      </div>`;
  },

  async download(auftragId, auftragNummer) {
    const sigs = await DB.getAll('unterschriften');
    const sig = sigs.find(s => s.auftrag_id === auftragId);
    if (!sig) return;
    const a = document.createElement('a');
    a.href = sig.storage_url;
    a.download = `Unterschrift_${auftragNummer}.png`;
    a.click();
  },
};
