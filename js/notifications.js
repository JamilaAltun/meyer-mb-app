/* ═══════════════════════════════════════════════════════
   NOTIFICATIONS — Browser-Benachrichtigungen & Erinnerungen
═══════════════════════════════════════════════════════ */

const NotificationsModule = {
  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  async send(title, body, icon = 'assets/logo-placeholder.svg') {
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, icon });
  },

  async checkAndShow() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    try {
      /* Angebote zum Nachfassen */
      const angebote = await DB.getAll('angebote');
      const faellig = angebote.filter(a => {
        if (!a.erinnerung_am || a.status === 'angenommen' || a.status === 'abgelehnt') return false;
        return new Date(a.erinnerung_am) <= today;
      });
      if (faellig.length) {
        showToast(`${faellig.length} Angebot${faellig.length > 1 ? 'e' : ''} zum Nachfassen fällig`, 'warning', 6000);
      }

      /* Überfällige Rechnungen */
      const rechnungen = await DB.getAll('rechnungen');
      const ueberfaellig = rechnungen.filter(r => {
        if (r.status === 'bezahlt') return false;
        if (!r.datum || !r.zahlungsziel) return false;
        const faelligDate = new Date(r.datum);
        const tage = parseInt(r.zahlungsziel) || 14;
        faelligDate.setDate(faelligDate.getDate() + tage);
        return faelligDate < today;
      });
      if (ueberfaellig.length) {
        showToast(`${ueberfaellig.length} überfällige Rechnung${ueberfaellig.length > 1 ? 'en' : ''}`, 'error', 6000);
        this.send('Überfällige Rechnungen', `${ueberfaellig.length} Rechnung(en) sind überfällig`);
      }

      /* Aufgaben heute fällig */
      const aufgaben = await DB.getAll('aufgaben');
      const aufgabenHeute = aufgaben.filter(a => {
        if (a.erledigt) return false;
        if (!a.faellig_am) return false;
        const d = new Date(a.faellig_am); d.setHours(0,0,0,0);
        return d <= today;
      });
      if (aufgabenHeute.length) {
        showToast(`${aufgabenHeute.length} Aufgabe${aufgabenHeute.length > 1 ? 'n' : ''} heute fällig`, 'warning', 5000);
      }

    } catch (e) { /* offline */ }

    /* Permission anfragen wenn noch nicht */
    if (Notification.permission === 'default') {
      setTimeout(() => this.requestPermission(), 3000);
    }
  },
};
