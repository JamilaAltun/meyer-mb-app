const PdfModule = {
  async generateAngebot(angebotId) {
    const a = await DB.getById('angebote', angebotId);
    const kunden = await DB.getAll('kunden');
    const k = kunden.find(c => c.id === a.kunde_id);
    const s = Settings.get();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const briefpapier = a.briefpapier_modus;
    const topMargin = briefpapier ? 60 : 20;

    if (!briefpapier) {
      /* Firmenkopf */
      doc.setFillColor(13, 16, 74);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(16); doc.setFont('helvetica','bold');
      doc.text(s.firma_name || 'Meyer Metallbau GmbH', 15, 15);
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text([s.strasse||'', `${s.plz||''} ${s.ort||''}`, s.telefon||''].filter(Boolean).join(' • '), 15, 24);
      doc.setTextColor(0,0,0);
    }

    let y = topMargin + 10;
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.setTextColor(0,0,0);
    doc.text('ANGEBOT', 15, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    y += 6;
    doc.text(`Angebotsnummer: ${a.nummer}`, 15, y); y += 5;
    doc.text(`Datum: ${formatDate(a.datum)}`, 15, y); y += 5;
    if (a.gueltig_bis) { doc.text(`Gültig bis: ${formatDate(a.gueltig_bis)}`, 15, y); y += 5; }

    if (k) {
      y += 5;
      doc.setFont('helvetica','bold'); doc.text('Kunde:', 15, y); doc.setFont('helvetica','normal');
      y += 5; doc.text(k.firma || k.name, 15, y);
      if (k.ansprechpartner) { y += 4; doc.text(k.ansprechpartner, 15, y); }
      if (k.adresse) { y += 4; doc.text(`${k.adresse}, ${k.plz||''} ${k.ort||''}`, 15, y); }
    }

    y += 10;
    doc.setFillColor(13,16,74); doc.setTextColor(255,255,255);
    doc.rect(15, y, 180, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('Pos.', 17, y+5); doc.text('Bezeichnung', 28, y+5); doc.text('Menge', 120, y+5); doc.text('Einheit', 135, y+5); doc.text('EP (€)', 150, y+5); doc.text('GP (€)', 170, y+5);

    y += 9; doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(8);
    (a.positionen||[]).forEach((p, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(String(i+1), 17, y);
      doc.text(p.bezeichnung||'', 28, y, { maxWidth: 90 });
      doc.text(String(p.menge||1), 120, y);
      doc.text(p.einheit||'Stk', 135, y);
      doc.text(formatCurrency(p.einzelpreis||0), 148, y, { align: 'right' });
      doc.text(formatCurrency((p.menge||1)*(p.einzelpreis||0)), 195, y, { align: 'right' });
      y += 6;
      doc.setDrawColor(230,230,230); doc.line(15, y-1, 195, y-1);
    });

    y += 5;
    doc.setFont('helvetica','bold');
    doc.text('Nettobetrag:', 130, y); doc.text(formatCurrency(a.gesamt_netto||0), 195, y, { align: 'right' }); y += 5;
    doc.setFont('helvetica','normal');
    doc.text(`MwSt. ${a.mwst_satz||19}%:`, 130, y); doc.text(formatCurrency((a.gesamt_brutto||0)-(a.gesamt_netto||0)), 195, y, { align: 'right' }); y += 5;
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Gesamtbetrag:', 130, y); doc.text(formatCurrency(a.gesamt_brutto||0), 195, y, { align: 'right' });

    if (!briefpapier) {
      y = 275;
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100);
      doc.text(`${s.firma_name||''} • ${s.strasse||''}, ${s.plz||''} ${s.ort||''} • Tel: ${s.telefon||''} • ${s.email||''}`, 105, y, { align: 'center' });
      y += 4;
      if (s.steuernummer) doc.text(`StNr: ${s.steuernummer}`, 105, y, { align: 'center' });
    }

    doc.save(`Angebot_${a.nummer}.pdf`);
    showToast('PDF gespeichert', 'success');
  },

  async generateRechnung(rechnungId) {
    const r = await DB.getById('rechnungen', rechnungId);
    const kunden = await DB.getAll('kunden');
    const k = kunden.find(c => c.id === r.kunde_id);
    const s = Settings.get();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const briefpapier = r.briefpapier_modus;
    const topMargin = briefpapier ? 60 : 20;

    if (!briefpapier) {
      doc.setFillColor(13,16,74); doc.rect(0,0,210,35,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont('helvetica','bold');
      doc.text(s.firma_name || 'Meyer Metallbau GmbH', 15, 15);
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text([s.strasse||'', `${s.plz||''} ${s.ort||''}`, `Tel: ${s.telefon||''}`].filter(Boolean).join(' • '), 15, 24);
      doc.setTextColor(0,0,0);
    }

    let y = topMargin + 10;
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
    doc.text(r.typ === 'schluss' ? 'SCHLUSSRECHNUNG' : 'ABSCHLAGSRECHNUNG', 15, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); y += 7;
    doc.text(`Rechnungsnummer: ${r.nummer}`, 15, y); y += 5;
    doc.text(`Datum: ${formatDate(r.datum)}`, 15, y); y += 5;
    if (r.leistungszeitraum) { doc.text(`Leistungszeitraum: ${r.leistungszeitraum}`, 15, y); y += 5; }
    doc.text(`Zahlungsziel: ${r.zahlungsziel || s.zahlungsziel_standard || '14 Tage netto'}`, 15, y); y += 5;
    if (s.skonto_text) { doc.text(s.skonto_text, 15, y); y += 5; }

    if (k) {
      y += 5; doc.setFont('helvetica','bold'); doc.text('Rechnungsempfänger:', 15, y); doc.setFont('helvetica','normal');
      y += 5; doc.text(k.firma || k.name, 15, y);
      if (k.adresse) { y += 4; doc.text(`${k.adresse}, ${k.plz||''} ${k.ort||''}`, 15, y); }
    }

    y += 10;
    doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text(`Nettobetrag:`, 130, y); doc.text(formatCurrency(r.gesamt_netto||0), 195, y, { align:'right' }); y += 5;
    doc.setFont('helvetica','normal');
    doc.text(`MwSt. ${r.mwst_satz||19}%:`, 130, y); doc.text(formatCurrency((r.gesamt_brutto||0)-(r.gesamt_netto||0)), 195, y, { align:'right' }); y += 5;
    doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text('Gesamtbetrag:', 130, y); doc.text(formatCurrency(r.gesamt_brutto||0), 195, y, { align:'right' });

    y += 15; doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text('Bankverbindung:', 15, y); y += 4;
    if (s.iban) doc.text(`IBAN: ${s.iban}`, 15, y); y += 4;
    if (s.bic) doc.text(`BIC: ${s.bic}`, 15, y);

    if (!briefpapier) {
      y = 275; doc.setFontSize(7); doc.setTextColor(100,100,100);
      const footer = [`${s.firma_name||''}`, s.steuernummer ? `StNr: ${s.steuernummer}` : '', s.ust_id ? `USt-ID: ${s.ust_id}` : ''].filter(Boolean).join(' • ');
      doc.text(footer, 105, y, { align: 'center' });
    }

    doc.save(`Rechnung_${r.nummer}.pdf`);
    showToast('PDF gespeichert', 'success');
  },

  async generateMonthReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const s = Settings.get();
    const users = await DB.getAll('users');
    const allZeit = await DB.getAll('zeiterfassung');
    const month = new Date().toISOString().slice(0,7);
    const monthLabel = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    doc.setFillColor(13,16,74); doc.rect(0,0,210,30,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('MONATSREPORT ARBEITSZEITEN', 15, 13);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`${s.firma_name||''} • ${monthLabel}`, 15, 22);
    doc.setTextColor(0,0,0);

    let y = 40;
    users.forEach(u => {
      const eintraege = allZeit.filter(e => e.user_id === u.id && e.datum?.startsWith(month));
      const total = eintraege.reduce((s,e) => s+(e.gesamt_minuten||0), 0);
      doc.setFont('helvetica','bold'); doc.setFontSize(10);
      doc.text(`${u.name} (${u.position||'—'})`, 15, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(8);
      doc.text(`Gesamt: ${formatDuration(total)}`, 140, y); y += 6;
      eintraege.forEach(e => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${formatDate(e.datum)}`, 20, y);
        doc.text(`${formatTime(e.start_zeit)} – ${e.end_zeit ? formatTime(e.end_zeit) : '—'}`, 55, y);
        doc.text(formatDuration(e.gesamt_minuten), 120, y);
        y += 5;
      });
      y += 5;
    });

    doc.save(`Monatsreport_${month}.pdf`);
    showToast('Monatsreport gespeichert', 'success');
  },
};
