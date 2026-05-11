/* ═══════════════════════════════════════════════════════
   DEMO-DATEN — Beispieldaten für Testzwecke
   Lädt realistische Musterdaten in den localStorage.
═══════════════════════════════════════════════════════ */

const DemoData = {

  /* Stilles Laden beim ersten App-Start (kein UI nötig) */
  seed() {
    const kunden    = this._kunden();
    const anfragen  = this._anfragen(kunden);
    const angebote  = this._angebote(kunden);
    const auftraege = this._auftraege(kunden, angebote);
    const rechnungen = this._rechnungen(kunden, auftraege);
    const nachkalk  = this._nachkalkulation(auftraege);

    LS.set('kunden',          kunden);
    LS.set('anfragen',        anfragen);
    LS.set('angebote',        angebote);
    LS.set('auftraege',       auftraege);
    LS.set('rechnungen',      rechnungen);
    LS.set('nachkalkulation', nachkalk);
  },

  /* Manuelles Laden über Einstellungen (mit UI-Feedback) */
  load() {
    this.seed();
    showToast('Demo-Daten geladen — viel Spaß beim Testen!', 'success', 4000);
    navigateTo(currentModule || 'dashboard');
  },

  clear() {
    ['kunden','anfragen','angebote','auftraege','rechnungen','nachkalkulation'].forEach(t => LS.set(t, []));
    showToast('Demo-Daten gelöscht', 'info');
    navigateTo(currentModule || 'dashboard');
  },

  /* ── Kunden ── */
  _kunden() {
    return [
      {
        id: 'demo-k001', erstellt_am: '2025-01-10T08:00:00.000Z',
        firma: 'Baugesellschaft Müller GmbH', name: 'Thomas Müller',
        ansprechpartner: 'Thomas Müller', telefon: '0211 / 44 55 66',
        email: 't.mueller@bau-mueller.de', strasse: 'Industriestr. 18',
        plz: '40210', ort: 'Düsseldorf', notizen: 'Stammkunde seit 2018',
      },
      {
        id: 'demo-k002', erstellt_am: '2025-02-14T09:30:00.000Z',
        firma: '', name: 'Hans Schmidt',
        ansprechpartner: '', telefon: '0177 / 123 45 67',
        email: 'h.schmidt@email.de', strasse: 'Birkenweg 5',
        plz: '45131', ort: 'Essen', notizen: '',
      },
      {
        id: 'demo-k003', erstellt_am: '2025-03-03T10:00:00.000Z',
        firma: 'Architekturbüro Weber & Partner GmbH', name: 'Sandra Weber',
        ansprechpartner: 'Sandra Weber', telefon: '0201 / 87 65 43',
        email: 's.weber@weber-architekten.de', strasse: 'Goethestr. 22',
        plz: '45127', ort: 'Essen', notizen: 'Projekte in NRW-Gebiet',
      },
    ];
  },

  /* ── Anfragen ── */
  _anfragen(kunden) {
    return [
      {
        id: 'demo-anf001', erstellt_am: '2025-03-15T08:45:00.000Z',
        kunde_id: kunden[0].id,
        datum: '2025-03-15',
        beschreibung: 'Anfrage für Treppengeländer Edelstahl V2A, ca. 12 lfd. Meter, 3-geschossig, Wohngebäude Neubau. Montage gewünscht.',
        status: 'angebot_erstellt',
      },
      {
        id: 'demo-anf002', erstellt_am: '2025-04-02T11:20:00.000Z',
        kunde_id: kunden[1].id,
        datum: '2025-04-02',
        beschreibung: 'Anfrage für Einfahrtstor Stahl verzinkt, zweiflügelig, Breite 4,0 m × Höhe 1,8 m, mit elektrischem Torantrieb.',
        status: 'neu',
      },
      {
        id: 'demo-anf003', erstellt_am: '2025-04-20T14:00:00.000Z',
        kunde_id: kunden[2].id,
        datum: '2025-04-20',
        beschreibung: 'Balkongeländer für Mehrfamilienhaus, 3 Balkone à 4,0 m Breite, Stahl pulverbeschichtet RAL 7016 Anthrazitgrau.',
        status: 'neu',
      },
    ];
  },

  /* ── Angebote ── */
  _angebote(kunden) {
    return [
      {
        id: 'demo-ang001', erstellt_am: '2025-03-18T09:00:00.000Z',
        nummer: 'A-2025-001',
        kunde_id: kunden[0].id,
        datum: '2025-03-18',
        gueltig_bis: '2025-04-18',
        mwst_satz: 19,
        status: 'angenommen',
        gesamt_netto: 2130.00,
        gesamt_brutto: 2534.70,
        notizen: 'Lieferzeit ca. 3 Wochen nach Auftragserteilung. Montage inkl.',
        briefpapier_modus: false,
        positionen: [
          { id: 'pos-001a', bezeichnung: 'Geländerholm Edelstahl V2A, ø 42 mm, geschliffen', menge: 4, einheit: 'Stk', einzelpreis: 180.00 },
          { id: 'pos-001b', bezeichnung: 'Handlaufpfosten Edelstahl V2A, h = 90 cm', menge: 8, einheit: 'Stk', einzelpreis: 95.00 },
          { id: 'pos-001c', bezeichnung: 'Füllstäbe Edelstahl V2A, ø 12 mm', menge: 48, einheit: 'Stk', einzelpreis: 8.50 },
          { id: 'pos-001d', bezeichnung: 'Montage und Befestigung inkl. Anfahrt', menge: 1, einheit: 'pauschal', einzelpreis: 650.00 },
        ],
      },
      {
        id: 'demo-ang002', erstellt_am: '2025-04-05T10:30:00.000Z',
        nummer: 'A-2025-002',
        kunde_id: kunden[1].id,
        datum: '2025-04-05',
        gueltig_bis: '2025-05-05',
        mwst_satz: 19,
        status: 'gesendet',
        gesamt_netto: 2030.00,
        gesamt_brutto: 2415.70,
        notizen: 'Strom-Anschluss durch Elektrofachbetrieb des Kunden. Fundamente bauseits.',
        briefpapier_modus: false,
        positionen: [
          { id: 'pos-002a', bezeichnung: 'Einfahrtstor Stahl feuerverzinkt, 2-flügelig 4,0 × 1,8 m', menge: 1, einheit: 'Stk', einzelpreis: 1200.00 },
          { id: 'pos-002b', bezeichnung: 'Elektrischer Torantrieb inkl. 2× Fernbedienung', menge: 1, einheit: 'Stk', einzelpreis: 450.00 },
          { id: 'pos-002c', bezeichnung: 'Montage, Einstellung und Inbetriebnahme', menge: 1, einheit: 'pauschal', einzelpreis: 380.00 },
        ],
      },
      {
        id: 'demo-ang003', erstellt_am: '2025-04-22T13:15:00.000Z',
        nummer: 'A-2025-003',
        kunde_id: kunden[2].id,
        datum: '2025-04-22',
        gueltig_bis: '2025-05-22',
        mwst_satz: 19,
        status: 'entwurf',
        gesamt_netto: 2160.00,
        gesamt_brutto: 2570.40,
        notizen: 'RAL 7016 Anthrazitgrau, Pulverbeschichtung 2-schichtig.',
        briefpapier_modus: false,
        positionen: [
          { id: 'pos-003a', bezeichnung: 'Balkongeländer Stahl pulverbeschichtet RAL 7016, h = 110 cm', menge: 12, einheit: 'm', einzelpreis: 135.00 },
          { id: 'pos-003b', bezeichnung: 'Wandanschluss-Set inkl. Dübel und Abdeckkappen', menge: 3, einheit: 'Stk', einzelpreis: 45.00 },
          { id: 'pos-003c', bezeichnung: 'Montage (3 Balkone)', menge: 1, einheit: 'pauschal', einzelpreis: 495.00 },
        ],
      },
    ];
  },

  /* ── Aufträge ── */
  _auftraege(kunden, angebote) {
    return [
      {
        id: 'demo-au001', erstellt_am: '2025-03-22T09:00:00.000Z',
        nummer: 'AU-2025-001',
        angebot_id: angebote[0].id,
        kunde_id: kunden[0].id,
        bezeichnung: 'Treppengeländer Edelstahl – Wohnanlage Düsseldorf',
        workflow_status: 'montage',
        auftragswert: 2534.70,
        notizen: 'Montagetermin KW 20. Bauleiter: M. Hoffmann, Tel. 0170 / 999 88 77',
      },
      {
        id: 'demo-au002', erstellt_am: '2025-04-08T11:00:00.000Z',
        nummer: 'AU-2025-002',
        angebot_id: angebote[1].id,
        kunde_id: kunden[1].id,
        bezeichnung: 'Einfahrtstor Stahl – Essen Birkenweg',
        workflow_status: 'fertig',
        auftragswert: 2415.70,
        notizen: 'Abgenommen 23.04.2025',
      },
    ];
  },

  /* ── Rechnungen ── */
  _rechnungen(kunden, auftraege) {
    return [
      {
        id: 'demo-r001', erstellt_am: '2025-04-01T08:00:00.000Z',
        nummer: 'R-2025-001',
        typ: 'abschlag',
        kunde_id: kunden[0].id,
        auftrag_id: auftraege[0].id,
        datum: '2025-04-01',
        leistungszeitraum: 'März 2025',
        zahlungsziel: '14 Tage netto',
        mwst_satz: 19,
        gesamt_netto: 1065.00,
        gesamt_brutto: 1267.35,
        status: 'offen',
        briefpapier_modus: false,
      },
      {
        id: 'demo-r002', erstellt_am: '2025-04-25T10:00:00.000Z',
        nummer: 'R-2025-002',
        typ: 'schluss',
        kunde_id: kunden[1].id,
        auftrag_id: auftraege[1].id,
        datum: '2025-04-25',
        leistungszeitraum: 'April 2025',
        zahlungsziel: '14 Tage netto',
        mwst_satz: 19,
        gesamt_netto: 2030.00,
        gesamt_brutto: 2415.70,
        status: 'bezahlt',
        bezahlt_am: '2025-05-02T00:00:00.000Z',
        briefpapier_modus: false,
      },
    ];
  },

  /* ── Nachkalkulation ── */
  _nachkalkulation(auftraege) {
    return [
      {
        id: 'demo-nk001', erstellt_am: '2025-05-02T09:00:00.000Z',
        auftrag_id: auftraege[0].id,
        material_soll: 850.00,
        material_ist:  920.00,
        lohn_soll:     620.00,
        fremd_soll:    0,
        fremd_ist:     0,
        sonstige_ist:  35.00,
      },
      {
        id: 'demo-nk002', erstellt_am: '2025-04-26T08:00:00.000Z',
        auftrag_id: auftraege[1].id,
        material_soll: 1200.00,
        material_ist:  1180.00,
        lohn_soll:     380.00,
        fremd_soll:    0,
        fremd_ist:     0,
        sonstige_ist:  20.00,
      },
    ];
  },
};
