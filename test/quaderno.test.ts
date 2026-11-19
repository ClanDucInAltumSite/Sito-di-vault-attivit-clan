// test/quaderno.test.ts
// Test unitari per il Quaderno di Clan: verbali, verifiche di percorso e generazione WhatsApp

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDb,
  resetDbInstanceForTesting,
  getQuadernoPagine,
  QuadernoPagina,
  Evento,
  OdgPunto,
} from '../src/lib/db';
import {
  saveQuadernoPagina,
  deleteQuadernoPagina,
} from '../src/lib/admin_actions';
import {
  buildQuadernoWhatsAppMessage,
  formatContentForWhatsApp,
  EMOJI_FLEUR_DE_LIS,
  EMOJI_PIN,
  EMOJI_CALENDAR,
  EMOJI_SPIRAL_CALENDAR,
  EMOJI_MEMO,
  EMOJI_CLIPBOARD,
} from '../src/lib/whatsapp';
import { supabase } from '../src/lib/supabase';
import { SENTINEL_DATA_DA_DEFINIRE, TAG_DATA_DA_DEFINIRE } from '../src/lib/calendario';
import { parseInlineText } from '../src/features/quaderno/QuadernoDocRenderer';
import {
  renderMarkdownToContainer,
  domToMarkdown,
  parseInlineToDomNodes,
  stripQuadernoSnippet,
} from '../src/features/quaderno/quaderno_dom';

describe('Quaderno di Clan (quaderno.test.ts)', () => {
  beforeEach(async () => {
    resetDbInstanceForTesting();
    const db = await getDb();
    const stores = ['giochi', 'bans', 'canti', 'eventi', 'odg_punti', 'allegati', 'quaderno', 'sync_meta'];
    const tx = db.transaction(stores, 'readwrite');
    for (const s of stores) {
      await tx.objectStore(s).clear();
    }
    await tx.done;
    vi.restoreAllMocks();
  });

  it('1. saveQuadernoPagina richiede titolo e data obbligatori', async () => {
    await expect(
      saveQuadernoPagina({ data: '', titolo: 'Titolo', contenuto: '' })
    ).rejects.toThrow('data della pagina del quaderno è obbligatoria');

    await expect(
      saveQuadernoPagina({ data: '2026-11-02', titolo: '   ', contenuto: '' })
    ).rejects.toThrow('titolo della pagina del quaderno è obbligatorio');
  });

  it('2. saveQuadernoPagina salva nuovo record e aggiorna record esistente in IndexedDB e Supabase', async () => {
    let insertedPayload: any = null;
    let updatedPayload: any = null;

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'quaderno') {
        return {
          insert: (payload: any) => ({
            select: () => ({
              single: async () => {
                insertedPayload = payload;
                return { data: payload, error: null };
              },
            }),
          }),
          update: (payload: any) => ({
            eq: (_field: string, val: string) => ({
              select: () => ({
                single: async () => {
                  updatedPayload = { ...payload, id: val };
                  return { data: updatedPayload, error: null };
                },
              }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    // Inserimento
    const created = await saveQuadernoPagina({
      data: '2026-11-02',
      titolo: 'Verifica Route Estiva',
      categoria: 'verifica',
      contenuto: 'Tutto il Clan ha partecipato attivamente alla verifica di cammino e servizio.',
    });

    expect(created.id).toBeDefined();
    expect(created.titolo).toBe('Verifica Route Estiva');
    expect(created.categoria).toBe('verifica');
    expect(insertedPayload).not.toBeNull();

    // Lettura da IndexedDB
    let all = await getQuadernoPagine(false);
    expect(all.length).toBe(1);
    expect(all[0].titolo).toBe('Verifica Route Estiva');

    // Modifica
    const updated = await saveQuadernoPagina({
      id: created.id,
      data: '2026-11-03',
      titolo: 'Verifica Route Estiva - Conclusione',
      categoria: 'verifica',
      contenuto: 'Aggiornati anche gli impegni per l\'anno nuovo.',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.titolo).toBe('Verifica Route Estiva - Conclusione');
    expect(updatedPayload).not.toBeNull();

    all = await getQuadernoPagine(false);
    expect(all.length).toBe(1);
    expect(all[0].titolo).toBe('Verifica Route Estiva - Conclusione');
    expect(all[0].data).toBe('2026-11-03');
  });

  it('3. getQuadernoPagine ordina per data decrescente (più recenti prima) e filtra i cancellati', async () => {
    const db = await getDb();
    const p1: QuadernoPagina = {
      id: 'q1',
      data: '2026-10-15',
      titolo: 'Apertura Anno',
      categoria: 'riunione',
      contenuto: 'Verbale apertura',
      created_at: '2026-10-15T18:00:00Z',
      updated_at: '2026-10-15T18:00:00Z',
      deleted_at: null,
    };
    const p2: QuadernoPagina = {
      id: 'q2',
      data: '2026-11-01',
      titolo: 'Verifica Autunnale',
      categoria: 'verifica',
      contenuto: 'Testo verifica',
      created_at: '2026-11-01T18:00:00Z',
      updated_at: '2026-11-01T18:00:00Z',
      deleted_at: null,
    };
    const p3Deleted: QuadernoPagina = {
      id: 'q3',
      data: '2026-11-10',
      titolo: 'Bozza Cancellata',
      categoria: 'libero',
      contenuto: 'Da cancellare',
      created_at: '2026-11-10T18:00:00Z',
      updated_at: '2026-11-10T18:00:00Z',
      deleted_at: '2026-11-10T19:00:00Z',
    };

    await db.put('quaderno', p1);
    await db.put('quaderno', p2);
    await db.put('quaderno', p3Deleted);

    const active = await getQuadernoPagine(false);
    expect(active.length).toBe(2);
    expect(active[0].id).toBe('q2'); // 2026-11-01 viene prima di 2026-10-15
    expect(active[1].id).toBe('q1');

    const all = await getQuadernoPagine(true);
    expect(all.length).toBe(3);
    expect(all[0].id).toBe('q3'); // 2026-11-10
  });

  it('4. deleteQuadernoPagina imposta il soft-delete (deleted_at)', async () => {
    const db = await getDb();
    const pagina: QuadernoPagina = {
      id: 'q-del',
      data: '2026-11-02',
      titolo: 'Pagina da Eliminare',
      categoria: 'punto_strada',
      contenuto: 'Contenuto...',
      created_at: '2026-11-02T10:00:00Z',
      updated_at: '2026-11-02T10:00:00Z',
      deleted_at: null,
    };
    await db.put('quaderno', pagina);

    vi.spyOn(supabase, 'from').mockReturnValue({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    } as any);

    await deleteQuadernoPagina('q-del');

    const inDb = (await db.get('quaderno', 'q-del')) as QuadernoPagina;
    expect(inDb.deleted_at).not.toBeNull();

    const list = await getQuadernoPagine(false);
    expect(list.length).toBe(0);
  });

  it('5. buildQuadernoWhatsAppMessage compone correttamente il messaggio scout con prossima riunione', () => {
    const pagina: QuadernoPagina = {
      id: 'q-wa',
      data: '2026-11-02',
      titolo: 'Verbale Riunione di Capitolo',
      categoria: 'riunione',
      contenuto: 'Approvato il capitolo sul volontariato e stabilite le tre tappe di approfondimento.',
      created_at: '2026-11-02T20:45:00Z',
      updated_at: '2026-11-02T20:45:00Z',
      deleted_at: null,
    };

    const nextMeetingFixed: Evento = {
      id: 'meet-succ',
      titolo: 'Riunione Ordinaria',
      tipo: 'riunione',
      inizio: '2026-11-09T20:45:00.000Z',
      fine: '2026-11-09T22:30:00.000Z',
      tutto_il_giorno: false,
      luogo: 'Sede Scout',
      descrizione: null,
      responsabile: null,
      cosa_portare: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };

    const odg: OdgPunto[] = [
      {
        id: 'p1',
        evento_id: 'meet-succ',
        testo: 'Presentazione contatti associazioni',
        ordine: 1,
        completato: false,
        riportato_da: null,
        created_at: '',
        updated_at: '',
        deleted_at: null,
      },
    ];

    const message = buildQuadernoWhatsAppMessage({
      pagina,
      nextMeeting: nextMeetingFixed,
      nextOdgPunti: odg,
    });

    expect(message).toContain(`${EMOJI_FLEUR_DE_LIS} *CLAN DUC IN ALTUM* ${EMOJI_FLEUR_DE_LIS}`);
    expect(message).toContain('*Verbale Riunione di Capitolo*');
    expect(message).toContain('Approvato il capitolo sul volontariato');
    expect(message).toContain(`${EMOJI_SPIRAL_CALENDAR} *PROSSIMA RIUNIONE:*`);
    expect(message).toContain('Sede Scout');
    expect(message).toContain(`${EMOJI_CLIPBOARD} *ORDINE DEL GIORNO (ODG):*`);
    expect(message).toContain('1. Presentazione contatti associazioni');
  });

  it('6. buildQuadernoWhatsAppMessage mostra esattamente "📅 Data: Da concordare insieme" se la prossima riunione è da definire', () => {
    const pagina: QuadernoPagina = {
      id: 'q-wa-tbd',
      data: '2026-11-02',
      titolo: 'Verifica Cammino',
      categoria: 'verifica',
      contenuto: 'Verifica completata con esito molto positivo.',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };

    const nextMeetingTbd: Evento = {
      id: 'meet-tbd',
      titolo: 'Prossima Riunione',
      tipo: 'riunione',
      inizio: SENTINEL_DATA_DA_DEFINIRE,
      fine: null,
      tutto_il_giorno: true,
      luogo: null,
      descrizione: TAG_DATA_DA_DEFINIRE,
      responsabile: null,
      cosa_portare: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };

    const message = buildQuadernoWhatsAppMessage({
      pagina,
      nextMeeting: nextMeetingTbd,
      nextOdgPunti: [],
    });

    expect(message).toContain(`${EMOJI_CALENDAR} Data: Da concordare insieme`);
    expect(message).toContain('_In fase di definizione_');
  });

  it('7. buildQuadernoWhatsAppMessage gestisce assenza di prossima riunione', () => {
    const pagina: QuadernoPagina = {
      id: 'q-wa-none',
      data: '2026-11-02',
      titolo: 'Appunti Libero',
      categoria: 'libero',
      contenuto: 'Idee per la veglia natalizia.',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };

    const message = buildQuadernoWhatsAppMessage({
      pagina,
      nextMeeting: null,
    });

    expect(message).toContain('_Da programmare_');
    expect(message).not.toContain('ORDINE DEL GIORNO');
  });

  it('8. accetta tutte le 4 nuove categorie ufficiali (riunione, punto_strada, verifica, libero)', async () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      insert: (payload: any) => ({
        select: () => ({
          single: async () => ({ data: payload, error: null }),
        }),
      }),
    } as any);

    const cat1 = await saveQuadernoPagina({ data: '2026-11-02', titolo: 'Verbale', categoria: 'riunione', contenuto: '' });
    const cat2 = await saveQuadernoPagina({ data: '2026-11-02', titolo: 'Punto Strada', categoria: 'punto_strada', contenuto: '' });
    const cat3 = await saveQuadernoPagina({ data: '2026-11-02', titolo: 'Verifica Anno', categoria: 'verifica', contenuto: '' });
    const cat4 = await saveQuadernoPagina({ data: '2026-11-02', titolo: 'Veglia di Clan', categoria: 'libero', contenuto: '' });

    expect(cat1.categoria).toBe('riunione');
    expect(cat2.categoria).toBe('punto_strada');
    expect(cat3.categoria).toBe('verifica');
    expect(cat4.categoria).toBe('libero');
  });

  it('9. formatContentForWhatsApp converte immagini base64 e markdown arricchito in formato WhatsApp pulito', () => {
    const rawContent = [
      '# Intestazione Documento',
      'Ecco una foto scattata durante la route:',
      '![Foto bivacco](data:image/webp;base64,UklGRmQAAABXRUJQVlA4...)',
      '---',
      'Punti chiave:',
      '- **Grassetto** e *corsivo*',
      '- ==yellow:Punto evidenziato giallo==',
      '- ==coral:Attenzione urgente==',
      '- [color:purple:Testo viola marchio]',
      '- ~~Elemento scartato~~',
    ].join('\n');

    const formatted = formatContentForWhatsApp(rawContent);

    // Non deve contenere la data URL base64
    expect(formatted).not.toContain('data:image/webp;base64');
    expect(formatted).toContain('[Foto: Foto bivacco]');
    // Intestazione convertita in grassetto WhatsApp
    expect(formatted).toContain('*Intestazione Documento*');
    // Separatore orizzontale
    expect(formatted).toContain('━━━━━━━━━━━━━━━━━━━━');
    // Evidenziatori convertiti in testo leggibile
    expect(formatted).toContain('*Punto evidenziato giallo*');
    expect(formatted).toContain('*Attenzione urgente*');
    // Colore testo
    expect(formatted).toContain('Testo viola marchio');
    // Barrato WhatsApp ~testo~
    expect(formatted).toContain('~Elemento scartato~');
  });

  it('10. parseInlineText genera nodi VDOM sicuri con attributo alt obbligatorio per immagini', () => {
    const sample = 'Testo con **grassetto**, ==green:evidenziato verde==, [color:blue:blu], e ![Cartina](https://example.com/map.jpg)';
    const parsed = parseInlineText(sample);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(1);

    // Cerca nodo immagine nel risultato
    const imgNode = parsed.find(
      (node: any) => node && typeof node === 'object' && node.type === 'img'
    ) as any;

    expect(imgNode).toBeDefined();
    expect(imgNode.props.alt).toBe('Cartina');
    expect(imgNode.props.src).toBe('https://example.com/map.jpg');
  });

  it('11. formatContentForWhatsApp converte tutti i separatori standard (---, ***, ___) e rimozione ++sottolineato++', () => {
    const raw = 'Riga 1\n---\nRiga 2\n***\nRiga 3\n___\n++testo sottolineato++';
    const formatted = formatContentForWhatsApp(raw);

    const occurrences = (formatted.match(/━━━━━━━━━━━━━━━━━━━━/g) || []).length;
    expect(occurrences).toBe(3);
    expect(formatted).toContain('testo sottolineato');
    expect(formatted).not.toContain('++');
  });

  it('12. sanitizzazione nome immagine rimuove parentesi e parentesi quadre per integrità Markdown', () => {
    const rawName = 'foto [bivacco] (1).jpg';
    const cleanName = rawName
      .replace(/\.[^/.]+$/, '')
      .replace(/[[\]()]/g, '')
      .trim() || 'Immagine';

    expect(cleanName).toBe('foto bivacco 1');
    expect(cleanName).not.toContain('[');
    expect(cleanName).not.toContain(']');
    expect(cleanName).not.toContain('(');
    expect(cleanName).not.toContain(')');
  });

  it('13. renderMarkdownToContainer popola il DOM del foglio con tag HTML reali conformi a Google Docs', () => {
    const container = document.createElement('div');
    const md = [
      '# Titolo Principale',
      '## Sottotitolo',
      '### Terzo Livello',
      '#### Quarto Livello',
      'Paragrafo con **grassetto**, *corsivo*, <u>sottolineato</u>, ~~barrato~~, ==green:verde==, [color:blue:blu], [font:serif:classico], e [size:20:grande].',
      '---',
      '> Citazione importante di B.-P.',
      '- Punto elenco uno',
      '- Punto elenco due',
      '1. Primo numerato',
      '2. Secondo numerato',
      '![Foto Clan](https://example.com/clan.webp)',
    ].join('\n\n');

    renderMarkdownToContainer(md, container);

    expect(container.querySelector('h1')?.textContent).toBe('Titolo Principale');
    expect(container.querySelector('h2')?.textContent).toBe('Sottotitolo');
    expect(container.querySelector('h3')?.textContent).toBe('Terzo Livello');
    expect(container.querySelector('h4')?.textContent).toBe('Quarto Livello');
    expect(container.querySelector('strong')?.textContent).toBe('grassetto');
    expect(container.querySelector('em')?.textContent).toBe('corsivo');
    expect(container.querySelector('u')?.textContent).toBe('sottolineato');
    expect(container.querySelector('s')?.textContent).toBe('barrato');
    expect(container.querySelector('mark')?.textContent).toBe('verde');
    expect(container.querySelector('mark')?.getAttribute('data-highlight')).toBe('green');
    expect(container.querySelector('.doc-color-blue')?.textContent).toBe('blu');
    expect(container.querySelector('.doc-font-serif')?.textContent).toBe('classico');
    expect(container.querySelector('.doc-size-span')?.textContent).toBe('grande');
    expect(container.querySelector('hr')).not.toBeNull();
    expect(container.querySelector('blockquote p')?.textContent).toBe('Citazione importante di B.-P.');
    expect(container.querySelectorAll('ul li').length).toBe(2);
    expect(container.querySelectorAll('ol li').length).toBe(2);
    const img = container.querySelector('img');
    expect(img?.src).toBe('https://example.com/clan.webp');
    expect(img?.alt).toBe('Foto Clan');
  });

  it('14. domToMarkdown serializza i nodi del foglio contenteditable in Markdown pulito', () => {
    const container = document.createElement('div');
    const h1 = document.createElement('h1');
    h1.textContent = 'Verbale Route';
    container.appendChild(h1);

    const p = document.createElement('p');
    p.appendChild(document.createTextNode('Testo '));
    const strong = document.createElement('strong');
    strong.textContent = 'fondamentale';
    p.appendChild(strong);
    p.appendChild(document.createTextNode(' e '));
    const mark = document.createElement('mark');
    mark.className = 'doc-highlight doc-highlight-coral';
    mark.dataset.highlight = 'coral';
    mark.textContent = 'evidenziato';
    p.appendChild(mark);
    container.appendChild(p);

    const ul = document.createElement('ul');
    const li1 = document.createElement('li');
    li1.textContent = 'Zaino pronto';
    const li2 = document.createElement('li');
    li2.textContent = 'Borraccia piena';
    ul.appendChild(li1);
    ul.appendChild(li2);
    container.appendChild(ul);

    const markdown = domToMarkdown(container);

    expect(markdown).toContain('# Verbale Route');
    expect(markdown).toContain('Testo **fondamentale** e ==coral:evidenziato==');
    expect(markdown).toContain('- Zaino pronto');
    expect(markdown).toContain('- Borraccia piena');
  });

  it('15. Markdown -> DOM -> Markdown round-trip preserva fedelmente la struttura', () => {
    const initialMd = [
      '# Apertura',
      'Testo con **grassetto**, *corsivo*, ==blue:evidenziato== e [color:purple:viola].',
      '---',
      '- Voce A\n- Voce B',
      '1. Step uno\n2. Step due',
    ].join('\n\n');

    const container = document.createElement('div');
    renderMarkdownToContainer(initialMd, container);
    const resultMd = domToMarkdown(container);

    expect(resultMd).toBe(initialMd);
  });

  it('16. parseInlineText supporta pattern font e size inline in QuadernoDocRenderer', () => {
    const input = 'Frase con [font:serif:font classico] e [size:22:testo grande]';
    const nodes = parseInlineText(input);

    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes.length).toBeGreaterThan(1);

    // Cerca nodi span con fontFamily o fontSize
    const serifNode = nodes.find(
      (n: any) => n?.props?.style?.fontFamily?.includes('Georgia')
    ) as any;
    expect(serifNode).toBeDefined();

    const sizeNode = nodes.find(
      (n: any) => n?.props?.style?.fontSize === '22px'
    ) as any;
    expect(sizeNode).toBeDefined();
  });

  it('17. formatContentForWhatsApp rimuove i tag [font:...] e [size:...] mantenendo solo il testo pulito', () => {
    const raw = 'Ecco [font:serif:un testo con stile] e [size:24:dimensione grande] per WhatsApp.';
    const formatted = formatContentForWhatsApp(raw);

    expect(formatted).toContain('un testo con stile');
    expect(formatted).toContain('dimensione grande');
    expect(formatted).not.toContain('[font:');
    expect(formatted).not.toContain('[size:');
  });

  it('18. Gestione corretta di stili annidati e round-trip con parentesi bilanciate', () => {
    const complexMd = '# Titolo\n\nTesto con [size:20:[font:serif:[color:blue:Multistile]]] e **[color:purple:grassetto colorato]**.';
    const container = document.createElement('div');
    renderMarkdownToContainer(complexMd, container);

    const sizeSpan = container.querySelector('.doc-size-span');
    expect(sizeSpan).not.toBeNull();
    const fontSpan = sizeSpan?.querySelector('.doc-font-serif');
    expect(fontSpan).not.toBeNull();
    const colorSpan = fontSpan?.querySelector('.doc-color-blue');
    expect(colorSpan).not.toBeNull();
    expect(colorSpan?.textContent).toBe('Multistile');

    const resultMd = domToMarkdown(container);
    expect(resultMd).toBe(complexMd);
  });

  it('19. formatContentForWhatsApp rimuove tag annidati senza lasciare caratteri o parentesi orfane', () => {
    const raw = 'Messaggio con [size:24:[font:serif:[color:blue:testo composito]]] e un altro [color:green:verde].';
    const formatted = formatContentForWhatsApp(raw);

    expect(formatted).toBe('Messaggio con testo composito e un altro verde.');
    expect(formatted).not.toContain('[');
    expect(formatted).not.toContain(']');
  });

  it('20. domToMarkdown serializza progressivamente elementi con più attributi di stile', () => {
    const container = document.createElement('div');
    const p = document.createElement('p');
    const span = document.createElement('span');
    span.dataset.size = '22';
    span.dataset.font = 'serif';
    span.dataset.color = 'purple';
    span.textContent = 'Parola Unica';
    p.appendChild(span);
    container.appendChild(p);

    const serialized = domToMarkdown(container);
    expect(serialized).toBe('[color:purple:[font:serif:[size:22:Parola Unica]]]');
  });

  it('21. stripQuadernoSnippet pulisce i tag grezzi annidati come da screenshot (*[size:17:[size:16:ssss]]*)', () => {
    const rawScreenshot = '*[size:17:[size:16:ssss]]*';
    const cleaned = stripQuadernoSnippet(rawScreenshot);
    expect(cleaned).toBe('ssss');
  });

  it('22. stripQuadernoSnippet pulisce formattazione varia, intestazioni, evidenziatori, immagini e liste', () => {
    const rawDoc = `# Titolo Documento
Oggi abbiamo parlato di **route** e ==green:bilancio==.
- Punto 1
- Punto 2
![Mappa del percorso](data:image/webp;base64,AAAA)
> Conclusione condivisa`;

    const cleaned = stripQuadernoSnippet(rawDoc);
    expect(cleaned).toContain('Titolo Documento Oggi abbiamo parlato di route e bilancio.');
    expect(cleaned).toContain('Punto 1 Punto 2');
    expect(cleaned).toContain('[Foto: Mappa del percorso]');
    expect(cleaned).toContain('Conclusione condivisa');
    expect(cleaned).not.toContain('#');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('==');
    expect(cleaned).not.toContain('data:image');
  });

  it('23. stripQuadernoSnippet gestisce stringhe vuote e testi normali', () => {
    expect(stripQuadernoSnippet('')).toBe('');
    expect(stripQuadernoSnippet('   ')).toBe('');
    expect(stripQuadernoSnippet('Testo normale senza formattazione.')).toBe('Testo normale senza formattazione.');
  });

  it('24. Sottotitolo: parsing in renderMarkdownToContainer, serializzazione in domToMarkdown e round-trip', () => {
    const subMd = '# Titolo Principale\n\n[sub:Sottotitolo descrittivo dell\'incontro]\n\nTesto normale del paragrafo.';
    const container = document.createElement('div');
    renderMarkdownToContainer(subMd, container);

    const subEl = container.querySelector('.doc-subtitle') as HTMLElement;
    expect(subEl).not.toBeNull();
    expect(subEl.tagName.toUpperCase()).toBe('P');
    expect(subEl.dataset.role).toBe('subtitle');
    expect(subEl.textContent).toBe('Sottotitolo descrittivo dell\'incontro');

    const serialized = domToMarkdown(container);
    expect(serialized).toBe(subMd);
  });

  it('25. Sottotitolo: stripQuadernoSnippet pulisce il tag e formatContentForWhatsApp lo converte in corsivo', () => {
    const rawWithSub = '[sub:Sottotitolo di Prova]';
    const cleaned = stripQuadernoSnippet(rawWithSub);
    expect(cleaned).toBe('Sottotitolo di Prova');

    const forWhatsApp = formatContentForWhatsApp(rawWithSub);
    expect(forWhatsApp).toBe('_Sottotitolo di Prova_');
  });

  it('26. renderMarkdownToContainer non genera paragrafi vuoti <p><br></p> spuri sotto i titoli o tra blocchi separati da \\n\\n', () => {
    const md = '# Titolo Principale\n\nQuesto è il primo paragrafo.\n\n## Secondo Titolo\n\nSecondo paragrafo.';
    const container = document.createElement('div');
    renderMarkdownToContainer(md, container);

    // I nodi diretti devono essere esattamente 4 (h1, p, h2, p) SENZA paragrafi vuoti <p><br></p> intermedi
    const children = Array.from(container.children);
    expect(children.length).toBe(4);
    expect(children[0].tagName.toUpperCase()).toBe('H1');
    expect(children[0].textContent).toBe('Titolo Principale');
    expect(children[1].tagName.toUpperCase()).toBe('P');
    expect(children[1].textContent).toBe('Questo è il primo paragrafo.');
    expect(children[2].tagName.toUpperCase()).toBe('H2');
    expect(children[2].textContent).toBe('Secondo Titolo');
    expect(children[3].tagName.toUpperCase()).toBe('P');
    expect(children[3].textContent).toBe('Secondo paragrafo.');

    // Nessun paragrafo sotto i titoli deve essere vuoto
    const emptyParagraphs = Array.from(container.querySelectorAll('p')).filter((p) => !p.textContent?.trim());
    expect(emptyParagraphs.length).toBe(0);

    // Round-trip pulito
    const roundtrip = domToMarkdown(container);
    expect(roundtrip).toBe(md);
  });

  it('27. renderMarkdownToContainer preserva righe vuote intenzionali senza alterare la struttura dei titoli', () => {
    // 2 righe vuote tra titolo e testo: la prima è il separatore normale, la seconda è vuota intenzionale
    const mdWithExtraBlank = '# Titolo Isolato\n\n\nParagrafo dopo riga vuota.';
    const container = document.createElement('div');
    renderMarkdownToContainer(mdWithExtraBlank, container);

    const children = Array.from(container.children);
    expect(children.length).toBe(3);
    expect(children[0].tagName.toUpperCase()).toBe('H1');
    expect(children[1].tagName.toUpperCase()).toBe('P');
    expect(children[1].querySelector('br')).not.toBeNull();
    expect(children[2].tagName.toUpperCase()).toBe('P');
    expect(children[2].textContent).toBe('Paragrafo dopo riga vuota.');

    // Verifica round-trip di serializzazione: la riga vuota intenzionale viene preservata
    const serialized = domToMarkdown(container);
    expect(serialized).toBe(mdWithExtraBlank);
  });

  it('28. Parsing, rendering e serializzazione colori testo: isolamento e assenza di annidamenti spuri', () => {
    const md = 'Testo normale [color:purple:parola viola] e poi [color:blue:parola blu] finale.';
    const container = document.createElement('div');
    renderMarkdownToContainer(md, container);

    const p = container.querySelector('p');
    expect(p).not.toBeNull();

    const spans = Array.from(p!.querySelectorAll('span'));
    expect(spans.length).toBe(2);
    expect(spans[0].className).toContain('doc-color-purple');
    expect(spans[0].dataset.color).toBe('purple');
    expect(spans[0].textContent).toBe('parola viola');

    expect(spans[1].className).toContain('doc-color-blue');
    expect(spans[1].dataset.color).toBe('blue');
    expect(spans[1].textContent).toBe('parola blu');

    // Verifica che nessuno span sia annidato dentro l'altro
    expect(spans[0].contains(spans[1])).toBe(false);
    expect(spans[1].contains(spans[0])).toBe(false);

    // Serializzazione round-trip fedele
    const serialized = domToMarkdown(container);
    expect(serialized).toBe(md);
  });

  it('29. Parsing, rendering ed evidenziatore pastello: supporto classi e dataset coerenti', () => {
    const md = 'Evidenziare ==green:questo concetto verde== e ==coral:questo corallo==.';
    const container = document.createElement('div');
    renderMarkdownToContainer(md, container);

    const marks = Array.from(container.querySelectorAll('mark'));
    expect(marks.length).toBe(2);
    expect(marks[0].className).toContain('doc-highlight-green');
    expect(marks[0].dataset.highlight).toBe('green');
    expect(marks[0].textContent).toBe('questo concetto verde');

    expect(marks[1].className).toContain('doc-highlight-coral');
    expect(marks[1].dataset.highlight).toBe('coral');
    expect(marks[1].textContent).toBe('questo corallo');

    const serialized = domToMarkdown(container);
    expect(serialized).toBe(md);
  });

  it('30. Stepper dimensione testo: parsing ed emissione corretta del tag size', () => {
    const md = 'Testo normale [size:22:testo grande 22px] fine.';
    const container = document.createElement('div');
    renderMarkdownToContainer(md, container);

    const sizeSpan = container.querySelector('.doc-size-span') as HTMLElement;
    expect(sizeSpan).not.toBeNull();
    expect(sizeSpan.dataset.size).toBe('22');
    expect(sizeSpan.style.fontSize).toBe('22px');
    expect(sizeSpan.textContent).toBe('testo grande 22px');

    const serialized = domToMarkdown(container);
    expect(serialized).toBe(md);
  });

  it('31. Serializzazione da DOM pulita con liste ed intestazioni senza nodi invalidi', () => {
    // Verifica che una lista con intestazione adiacente venga serializzata correttamente senza <h1><li>
    const container = document.createElement('div');

    const ul = document.createElement('ul');
    const li1 = document.createElement('li');
    li1.textContent = 'Punto uno';
    ul.appendChild(li1);
    container.appendChild(ul);

    const h2 = document.createElement('h2');
    h2.className = 'doc-h2';
    h2.textContent = 'Titolo Intermedio';
    container.appendChild(h2);

    const ul2 = document.createElement('ul');
    const li2 = document.createElement('li');
    li2.textContent = 'Punto due';
    ul2.appendChild(li2);
    container.appendChild(ul2);

    const serialized = domToMarkdown(container);
    expect(serialized).toBe('- Punto uno\n\n## Titolo Intermedio\n\n- Punto due');

    // Round-trip
    const reContainer = document.createElement('div');
    renderMarkdownToContainer(serialized, reContainer);
    expect(reContainer.children.length).toBe(3);
    expect(reContainer.children[0].tagName.toUpperCase()).toBe('UL');
    expect(reContainer.children[1].tagName.toUpperCase()).toBe('H2');
    expect(reContainer.children[2].tagName.toUpperCase()).toBe('UL');
  });

  it('32. Supporto completo per tutti i 12 colori testo e 8 evidenziatori pastello (Editor DOM + Reading Mode)', () => {
    // 12 colori testo: purple, blue, cyan, green, lime, amber, red, pink, brown, navy, gray + default
    const textColors = ['purple', 'blue', 'cyan', 'green', 'lime', 'amber', 'red', 'pink', 'brown', 'navy', 'gray'];
    for (const c of textColors) {
      const md = `Testo con [color:${c}:parola ${c}] fine.`;
      const container = document.createElement('div');
      renderMarkdownToContainer(md, container);
      const span = container.querySelector(`.doc-color-${c}`) as HTMLElement;
      expect(span).not.toBeNull();
      expect(span.dataset.color).toBe(c);
      expect(span.textContent).toBe(`parola ${c}`);
      expect(domToMarkdown(container)).toBe(md);

      // Reading mode parseInlineText
      const readingNodes = parseInlineText(md);
      expect(readingNodes.some((n: any) => n.props?.className?.includes(`doc-color-${c}`))).toBe(true);
    }

    // 8 evidenziatori: yellow, green, blue, coral, purple, amber, cyan, gray
    const highlights = ['yellow', 'green', 'blue', 'coral', 'purple', 'amber', 'cyan', 'gray'];
    for (const h of highlights) {
      const md = `Evidenziazione ==${h}:concetto ${h}== completata.`;
      const container = document.createElement('div');
      renderMarkdownToContainer(md, container);
      const mark = container.querySelector(`.doc-highlight-${h}`) as HTMLElement;
      expect(mark).not.toBeNull();
      expect(mark.dataset.highlight).toBe(h);
      expect(mark.textContent).toBe(`concetto ${h}`);
      expect(domToMarkdown(container)).toBe(md);

      // Reading mode parseInlineText
      const readingNodes = parseInlineText(md);
      expect(readingNodes.some((n: any) => n.props?.className?.includes(`doc-highlight-${h}`))).toBe(true);
    }
  });

  it('33. domToMarkdown preserva elenchi puntati e numerati anche se annidati in <p> o <div>', () => {
    // Caso 1: Browser che annida <ul> dentro <p class="doc-p">
    const pContainer = document.createElement('div');
    const p = document.createElement('p');
    p.className = 'doc-p';
    const ul = document.createElement('ul');
    ul.className = 'doc-ul';
    const li1 = document.createElement('li');
    li1.textContent = 'Primo punto';
    const li2 = document.createElement('li');
    li2.textContent = 'Secondo punto';
    ul.appendChild(li1);
    ul.appendChild(li2);
    p.appendChild(ul);
    pContainer.appendChild(p);

    const mdUl = domToMarkdown(pContainer);
    expect(mdUl).toBe('- Primo punto\n- Secondo punto');

    // Caso 2: Browser che annida <ol> dentro <p class="doc-p">
    const pContainerOl = document.createElement('div');
    const pOl = document.createElement('p');
    pOl.className = 'doc-p';
    const ol = document.createElement('ol');
    ol.className = 'doc-ol';
    const liOl1 = document.createElement('li');
    liOl1.textContent = 'Fase uno';
    const liOl2 = document.createElement('li');
    liOl2.textContent = 'Fase due';
    ol.appendChild(liOl1);
    ol.appendChild(liOl2);
    pOl.appendChild(ol);
    pContainerOl.appendChild(pOl);

    const mdOl = domToMarkdown(pContainerOl);
    expect(mdOl).toBe('1. Fase uno\n2. Fase due');
  });

  it('34. domToMarkdown gestisce ritorni a capo <br> dentro <li>, elenchi annidati e <li> orfani', () => {
    // <li> con <br> (più righe in un singolo item create da incolla o shift-enter)
    const container = document.createElement('div');
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.appendChild(document.createTextNode('Riga A'));
    li.appendChild(document.createElement('br'));
    li.appendChild(document.createTextNode('Riga B'));
    ul.appendChild(li);
    container.appendChild(ul);

    expect(domToMarkdown(container)).toBe('- Riga A\n- Riga B');

    // <ol> con <br>
    const containerOl = document.createElement('div');
    const ol = document.createElement('ol');
    const liOl = document.createElement('li');
    liOl.appendChild(document.createTextNode('Passo A'));
    liOl.appendChild(document.createElement('br'));
    liOl.appendChild(document.createTextNode('Passo B'));
    ol.appendChild(liOl);
    containerOl.appendChild(ol);

    expect(domToMarkdown(containerOl)).toBe('1. Passo A\n2. Passo B');

    // Elenco annidato
    const nestedContainer = document.createElement('div');
    const parentUl = document.createElement('ul');
    const parentLi = document.createElement('li');
    parentLi.appendChild(document.createTextNode('Genitore'));
    const subUl = document.createElement('ul');
    const subLi = document.createElement('li');
    subLi.appendChild(document.createTextNode('Figlio'));
    subUl.appendChild(subLi);
    parentLi.appendChild(subUl);
    parentUl.appendChild(parentLi);
    nestedContainer.appendChild(parentUl);

    expect(domToMarkdown(nestedContainer)).toBe('- Genitore\n  - Figlio');

    // <li> orfano al livello radice
    const orphanContainer = document.createElement('div');
    const orphanLi = document.createElement('li');
    orphanLi.textContent = 'Elemento orfano';
    orphanContainer.appendChild(orphanLi);

    expect(domToMarkdown(orphanContainer)).toBe('- Elemento orfano');
  });
});



