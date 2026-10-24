-- ==============================================================================
-- SEED CANZONIERE SCOUT: 21 CANTI COMPLETI CON METADATI MUSICALI E CHORDPRO
-- Esegui questa query nell'SQL Editor di Supabase Dashboard (project lpeiyzwccedtqjbficjo)
-- https://supabase.com/dashboard/project/lpeiyzwccedtqjbficjo/sql
-- ==============================================================================

-- 1. DANZA LA VITA
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '03415e65-0977-4671-a781-f4d0c89eee8f',
  'DANZA LA VITA',
  'Canto scout',
  'scout',
  'Do',
  'Giù, Giù-Su, Su-Giù-Su (↓ ↓↑ ↑↓↑)',
  110,
  'circa 110–115',
  '4/4',
  NULL,
  'import_pdf',
  'Canzoniere Scout',
  '{comment: intro: Do Fa Do Fa}
[Do]Canta con la [Fa]voce e con il [Do]cuore, [Fa]
[Do]con la bocca e [Fa]con la vit[Do]a… [Fa]
[Do]Canta senza [Fa]stonature, [Do] [Fa]
[Do]la ver[Fa]ità… del [Do]cuore![Fa]
[Do]Canta come [Fa]cantano i viand[Do]anti, [Fa](canta come cantano i viandanti)
[Do]non solo per [Fa]riempire il tem[Do]po, [Fa](non solo per riempire il tempo)
[Do]ma per sosten[Fa]ere lo sforzo. [Fa][Do](ma per sostenere lo sforzo)
[Do]Cant[Fa]a… e cam[Do]mina![Fa]
[Do]Cant[Fa]a… e cam[Do]mina!
Se [Sol]poi, credi non possa bas[Lam]tare,
segui il [Re]tempo
stai [Fa]pro---[Sol]-nto e…

{soc}
RIT:
[Do]Danza la [Fa]vita al [Sol]ritmo dello [Do]spirito
Spirito che riempi i nostri
[Lam]Danza, [Fa]danza al [Sol]ritmo che c''è [(Do)]in te.
cuor. Danza assieme a no----------------oi!
[Fa][Do]Spirito [Sol]che [Do]riempi i nostri
Danza la vita al ritmo dello spirito
[Lam]cuor. [Fa]Danza assieme [Sol]a no--------------[(Do)]--oi!
Danza, danza al ritmo che c''è in te.
{eoc}

{comment: strum: Do Fa Do Fa}
[Do]Cammina sulle [Fa]orme del Signo[Do]re, [Fa]
[Do]non solo [Fa]con i piedi [Do]ma [Fa]
[Do]usa sopra[Fa]ttutto il cuo[Do]re: [Fa]
[Do]am[Fa]a… chi è con[Do] te! [Fa]
[Do]Cammina con lo [Fa]zaino sulle [Do]spalle: [Fa](cammina con lo zaino sulle spalle)
[Do]La fatica [Fa]aiuta a cresc[Do]ere [Fa](la fatica aiuta a crescere)
[Do]Nella cond[Fa]ivision[Do]e [Fa](nella condivisione)
[Do]Cant[Fa]a… e cam[Do]mina![Fa]
[Do]Cant[Fa]a… e cam[Do]mina!
Se [Sol]poi, credi non possa bas[Lam]tare,
segui il [Re]tempo
stai [Fa]pro---[Sol]-nto e…

{soc}
RIT:
[Do]Danza la [Fa]vita al [Sol]ritmo dello [Do]spirito
Spirito che riempi i nostri
[Lam]Danza, [Fa]danza al [Sol]ritmo che c''è [(Do)]in te.
cuor. Danza assieme a no----------------oi!
[Fa][Do]Spirito [Sol]che [Do]riempi i nostri
Danza la vita al ritmo dello spirito
[Lam]cuor. [Fa]Danza assieme [Sol]a no--------------[(Do)]--oi!
Danza, danza al ritmo che c''è in te.
{eoc}

{comment: outro: Do Fa Do_|}[Do]',
  COALESCE((SELECT created_at FROM public.canti WHERE id = '03415e65-0977-4671-a781-f4d0c89eee8f'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 2. Aglio e Olio
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'c6353038-6d25-4d5e-9adb-eeecb9b802a4',
  'Aglio e Olio',
  'Fulminacci feat. Willie Peyote',
  'esterni',
  'Si',
  'Pop groove moderno (↓ ↓↑ ↑↓↑)',
  118,
  'circa 115–120',
  '4/4',
  NULL,
  'import_pdf',
  'Spartito PDF Riferimenti',
  '[Si]Spegni la radio, [Fa#]non lo vedi [Sol#m]che la sera è già [Mi]qui?
Coi [Si]denti d''avorio [Fa#]
Ancora un''[Sol#m]altra notte intera,
un''[Mi]altra notte vola via [Si]
Coi so[Fa#]gni [Sol#m]miei, [Mi]è [Si]quello che [Fa#]vor[Sol#m]rei [Mi]
Sì, ma [Si]quanto ti odio [Fa#]quando [Sol#m]ti rivesti e vai [Mi]via
E mi lasci come [Si]l''aglio nell''olio,
[Fa#]come il ter[Sol#m]zo sul podio
[Mi]Che tristezza mamma mia [Si], che c''è [Fa#], che [Sol#m]vuoi? [Mi]
Che giri il mondo inte[Si]ro, pe[Re#]rò non par[Mi]ti mai [Mim]

{soc}
RIT:
Ad essere sincero, sai [Si], è pi[Fa#]eno [Sol#m]di luna
E [Mi]tutta la ci[Si]ttà [Re#m]regala [Mi]sogni
a chi [Fa#]di sogni non ne ha [Si]
E se[Fa#]nza [Sol#m]paura, ti [Mi]giuro che mi [Si]va [Re#m]di usci[Mi]re fuori
E non [Fa#]pensare a tutto il [Sol#m]male [Fa#]che mi [Mi]fa
C''ho un am[Sol#m]ico [Fa#]che lo [Mi]sa [Mim]
{eoc}

Yah [Si], lo so che sembro troppo for[Fa#]male
[Sol#m]Uso le virgole su Whats[Mi]App
Perché non [Si]è che sia preso male, [Fa#]nah
[Sol#m]Però che palle ''sta veloci[Mi]tà
Cosa ti [Si]costa quel piccolo gesto?
[Fa#]Può cambiare il [Sol#m]senso, almeno un suo [Mi]lo fa
Vogliamo [Si]tutti risparmiare tempo
[Re#]E poi con questo [Mi]tempo in più cosa [Mim]si fa? Bah
Noi lo spre[Si]chiamo e ci sentiamo falliti
[Fa#]Neppure [Sol#m]questa volta qua ci siamo [Mi]capiti
Io verserò altro [Si]alcol sulle mie cicatrici
[Fa#]Ma tutti i [Sol#m]"vaffanculo" un po'' mi sono [Mi]serviti
Ho fatto passi [Si]avanti, non dico giganti
[Fa#]Non so neanche [Sol#m]quanti, non li con[Mi]to mai
Poi mi ha detto un [Si]saggio
"Spesso conta il viaggio [Re#]più di dove [Mi]vai" [Mim]

{soc}
RIT:
Ad essere sincero, sai [Si], è pi[Fa#]eno [Sol#m]di luna
E [Mi]tutta la cit[Si]tà [Re#m]regala [Mi]sogni
a chi [Fa#]di sogni non ne ha [Si]
E se[Fa#]nza [Sol#m]paura, [Mi]ti giuro che mi [Si]va [Re#m]di uscire [Mi]fuori
E non [Fa#]pensare a tutto il [Sol#m]male [Fa#]che mi [Mi]fa
C''ho un am[Sol#m]ico [Fa#]che lo [Mi]sa [Mim]
{eoc}

{comment: strum: Si Fa# Sol#m Mi Si Re# Mi Mim}
{comment: strum: Si Fa# Sol#m Mi Si Re# Mi Mim}

{soc}
RIT:
[Si]È pie[Fa#]no di [Sol#m]luna
E [Mi]tutta la ci[Si]ttà [Re#m]regala [Mi]sogni
a chi [Fa#]di sogni non ne ha [Si]
E se[Fa#]nza [Sol#m]paura, ti [Mi]giuro che mi [Si]va [Re#m]di uscir[Mi]e fuori
E non [Fa#]pensare a tutto il [Sol#m]male [Fa#]che mi [Mi]fa
C''ho un am[Sol#m]ico [Fa#]che lo [Mi]sa [Mim]
C''ho un amico che lo [Si]sa... [Fa#] [Sol#m] [Mi]
{eoc}

{comment: outro: Si Re# Mi Mim Si Fa# Sol#m Mi Si Re# Mi}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'c6353038-6d25-4d5e-9adb-eeecb9b802a4'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 3. Albachiara
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'a5fb44bd-5353-4d2b-8d6a-88380cb6c67c',
  'Albachiara',
  'Vasco Rossi',
  'esterni',
  'Do',
  'Arpeggio iniziale poi pop-rock (↓ ↓↑ ↑↓↑)',
  132,
  'moderato (circa 130–135)',
  '4/4',
  NULL,
  'import_pdf',
  'Spartito PDF Riferimenti',
  '{comment: intro: Fa Do Sol}
[Do]Respiri piano per non [Sol]far rumore
ti addor[Lam]menti di sera e ti ris[Do]vegli col sole
[Fa]sei chiara come un''[Do]alba
[Re]...sei fresca come l''[Sol]aria
[Do]Diventi rossa se qual[Sol]cuno ti guarda
sei fan[Lam]tastica quando sei [Do]assorta
[Fa]nei tuoi pro[Do]blemi, [Re]nei tuoi pen[Sol]sieri

{soc}
RIT:
[Do]Ti vesti svogliata[Sol]mente, non metti mai [Lam]niente
che possa atti[Do]rare attenzione
[Fa]un partico[Do]lare, [Re]solo per farti guar[Sol]dare
{eoc}

{comment: strum: Do Sol Lam Do Fa Do Re Sol Re Sol}

[Do]Respiri piano per non [Sol]far rumore
ti addor[Lam]menti di sera e ti ris[Do]vegli col sole
[Fa]sei chiara come un''[Do]alba
[Re]...sei fresca come l''[Sol]aria
[Do]Diventi rossa se qual[Sol]cuno ti guarda
sei fan[Lam]tastica quando sei [Do]assorta
[Fa]nei tuoi pro[Do]blemi, [Re]nei tuoi pen[Sol]sieri

{soc}
RIT:
[Do]Ti vesti svogliata[Sol]mente, non metti mai [Lam]niente
che possa atti[Do]rare attenzione
[Fa]un partico[Do]lare, [Re]solo per farti guar[Sol]dare
{eoc}

[Do]E con la faccia pu[Sol]lita cammini per [Lam]strada,
mangiando una [Do]mela, coi libri di [Fa]scuola,
ti piace stu[Do]diare,
[Re]non te ne devi vergognare! [Sol]
[Do]E quando guardi con quegli [Sol]occhi grandi
[Lam]forse un po'' troppo sin[Do]ceri, sinceri
[Fa]si vede quello che [Do]pensi,
[Re]quello che [Sol]sogni
[Do]E qualche volta fai pen[Sol]sieri strani
[Lam]con una mano, una [Do]mano ti sfiori
[Fa]Tu sola [Do]dentro la stanza
[Re]e tutto il mondo [Sol]fuori!

{comment: outro: Do Sol Lam Do Fa Do Re Sol Re Sol}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'a5fb44bd-5353-4d2b-8d6a-88380cb6c67c'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 4. Destri
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '55b2ff77-0fc7-4cb0-bf3a-40a6d0eaee73',
  'Destri',
  'Gazzelle',
  'esterni',
  'Lab',
  'Indie Pop in 4/4 (↓  ↓↑  ↑↓↑)',
  124,
  'allegro pop (circa 124)',
  '4/4',
  NULL,
  'import_pdf',
  'Accordi originali Lab/Fam (suonabile con Capo 1° in Mim)',
  '{comment: intro: Fam Reb Lab Dom Reb Lab}
[Fam]All''impro[Reb]vviso sei volata [Lab]via
[Dom]lasciando [Reb]indietro una nuvol[Lab]etta [Mib] [Fam]
almeno [Reb]meritavo una bug[Lab]ia, chessò
[Dom]almeno [Reb]l''ultima siga[Lab]retta
[Fam]Siamo due [Reb]fiori cresciuti [Lab]male
sul ciglio della tangen[Dom]ziale
all''[Reb]ombra di un osped[Lab]ale
te l''ho già detto una [Fam]volta, mi ricordavi il [Reb]mare
le luci di [Lab]Natale, gli schiaffi sul sedere
e lo spazzolino [Dom]uguale, la Panda [Reb]manuale
bruciare in una [Lab]notte come una cattedrale [Fam]

{soc}
RIT:
[Reb]E non è colpa [Lab]mia
se tutta questa [Dom]luce, luce, [Reb]luce
non ti [Lab]illumina più dentro casa [Fam]mia
[Reb]e non è colpa [Lab]tua
se tutti questi [Dom]destri, destri, [Reb]destri
al muro [Lab]non ci fanno ritornare [Fam]lì [Reb]
a quei momenti [Fam]lì
{eoc}

A quando an[Reb]dava tutta a gonfie [Lab]vele
e mi faceva stare [Dom]bene
che [Reb]mischiavi romano e l''ing[Lab]lese
te l''ho già detto una [Fam]volta, mi ricordavi il [Reb]mare
gli occhiali di mia [Lab]madre, le 4 del mattino
le Winston Blue sme[Dom]zzate, le facce come [Reb]zombie
svegliarti mentre [Lab]dormi
come le cazzo di zanzare [Fam]

{soc}
RIT:
[Reb]E non è colpa [Lab]mia
se tutta questa [Dom]luce, luce, [Reb]luce
non ti [Lab]illumina più dentro casa [Fam]mia
[Reb]e non è colpa [Lab]tua
se tutti questi [Dom]destri, destri, [Reb]destri
al muro [Lab]non ci fanno ritornare [Fam]lì [Reb]
a quei momenti [Lab]lì [Dom] [Reb] [Lab] [Fam]
{eoc}

{soc}
RIT:
[Reb]E non è colpa [Lab]mia
se tutta questa [Dom]luce, luce, [Reb]luce
non ti [Lab]illumina più dentro casa [Fam]mia
[Reb]e non è colpa [Lab]tua
se tutti questi [Dom]destri, destri, [Reb]destri
al muro [Lab]non ci fanno ritornare [Fam]lì [Reb]
a quei momenti [Lab]lì
a quei momenti [Dom]lì [Reb]
a quei momenti [Lab]lì
a quei momenti [Fam]lì
{eoc}

{comment: outro: Reb Lab Dom Reb Lab}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = '55b2ff77-0fc7-4cb0-bf3a-40a6d0eaee73'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 5. E la strada si apre
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '2999c13a-b8ab-45cc-a6ae-ec32df753525',
  'E la strada si apre',
  'Canto scout',
  'scout',
  'La',
  'Marcia scout ritmata (↓ ↓↑ ↑↓)',
  105,
  'marcia moderata (circa 105)',
  '4/4',
  NULL,
  'import_pdf',
  'Canzoniere Scout',
  '{comment: intro: Fa#m Mi La Mi Fa#m Mi La Mi}
[Fa#m]Raggio che [Mi]buca le [La]nubi
ed è [Mi]già cielo [Fa#m]aperto, [Mi] [La] [Mi]
[Fa#m]acqua che [Mi]scende de[La]cisa
sca[Mi]vando da [Sol]sé l''argine [Fa#]per la vita.
[Sim]La traie[La]ttoria di un [Mi]volo che
[Fa#m]sull''ori[Mi]zzonte di [Re]sera:
[Sim]tutto di [Do#m]questa na[Re]tura
ha una stra[Mi]da per [Fa#m]sé. [Mi] [La] [Mi]

[Fa#m]Attimo [Mi]che segue [La]attimo,
un [Mi]salto nel [Fa#m]tempo, [Mi] [La] [Mi]
[Fa#m]passi di un [Mi]mondo
che [La]tende ora[Mi]mai all''uni[Sol]tà
che non è [Fa#]più domani.
[Sim]Usiamo [La]allora queste [Mi]mani,
[Fa#m]scaviamo a [Mi]fondo nel [Re]cuore:
[Sim]solo sce[Do#m]gliendo l''a[Re]more il mondo ve[Mi]drà...

{soc}
RIT:
Che la strada si [La]apre, [Mi]passo dopo [Re]passo,
[La]ora, [Mi]su questa strada noi [Sim] [Do#]
E si spalanca un [Fa#m]cielo, un [Mi]mondo che [Re]rinasce,
si può [Fa#m]vivere [Sim]per l''uni[Mi]tà.
{eoc}

{comment: strum: Fa#m Mi La Mi Fa#m Mi La Mi}
[Fa#m]Nave che [Mi]segue una [La]rotta
in [Mi]mezzo alle [Fa#m]onde, [Mi] [La] [Mi]
[Fa#m]uomo che [Mi]s''apre la [La]strada
in una [Mi]giungla di [Sol]idee
seguendo [Fa#]sempre il sole.
[Sim]Quando si [La]sente asse[Mi]tato
[Fa#m]deve [Mi]raggiungere [Re]l''acqua,
[Sim]sabbia che [Do#m]nella [Re]risacca
[Mi]ritorna al [Fa#m]mare. [Mi] [La] [Fa#]
[Sim]Usiamo [La]allora queste [Mi]mani,
[Fa#m]scaviamo a [Mi]fondo nel [Re]cuore:
[Sim] [Do#m] [Re] [Mi]
solo scegliendo l''amore il mondo vedrà...

{soc}
RIT:
Che la strada si [La]apre, [Mi]passo dopo [Re]passo,
[La]ora, [Mi]su questa strada noi [Sim] [Do#]
E si spalanca un [Fa#m]cielo, un [Mi]mondo che [Re]rinasce,
si può [Fa#m]vivere [Sim]per l''uni[Mi]tà.
{eoc}

{soc}
RIT:
(modulazione in Si)
E la strada si [Si]apre, [Fa#]passo dopo [Mi]passo,
[Si]ora, [Fa#]su questa strada noi [Do#m] [Re#]
E si spalanca un [Sol#m]cielo, un [Fa#]mondo che [Mi]rinasce,
si può [Sol#m]vivere [Do#m]per l''uni[Fa#]tà!
Che la strada si [Si]apre, [Fa#]passo dopo [Mi]passo,
[Si]ora, [Fa#]su questa strada noi [Do#m] [Re#]
E si spalanca un [Sol#m]cielo, un [Fa#]mondo che [Mi]rinasce,
si può [Sol#m]vivere [Do#m]per l''uni[Fa#]tà...
{eoc}

{comment: outro: Sol#m Fa# Si Fa#}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = '2999c13a-b8ab-45cc-a6ae-ec32df753525'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 6. Il gatto e la volpe
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'fde4e6b2-b8d8-4d37-8340-ecdba00848c5',
  'Il gatto e la volpe',
  'Edoardo Bennato',
  'esterni',
  'La',
  'Swing / Shuffle brillante (↓.↑ ↓.↑)',
  132,
  'vivace swing (circa 130–135)',
  '4/4',
  NULL,
  'import_pdf',
  'Spartito PDF Riferimenti',
  '[La]Quanta fretta, ma [Fa#m]dove corri, [Sim]dove [Mi]vai?
[La]Se ci ascolti per [Fa#m]un momento [Sim]capi[Mi]rai
[La]Lui è il gatto ed [Do#]io la volpe [Fa#]stiamo in società
di [Sim]noi ti [Mi]puoi fi[La]dar [Fa#m] [La] [Fa#m]
[La]Puoi parlarci dei [Fa#m]tuoi problemi, [Sim]dei tuoi [Mi]guai
[La]i migliori in [Fa#m]questo campo [Sim]siamo [Mi]noi
[La]è una ditta [Do#]specializzata, [Fa#]fa un contratto e vedrai
che [Sim]non ti [Mi]penti[La]rai [Fa#m] [La] [Fa#m]
[La]Noi scopriamo [Fa#m]talenti e non sbag[Sim]liamo [Mi]mai
[La]noi sapremo sfrut[Fa#m]tare le tue [Sim]quali[Mi]tà
[La]dacci solo [Do#]quattro monete e [Fa#]ti iscriviamo al concorso
per [Sim]la [Mi]celebri[La]tà! [La]

{soc}
RIT:
[Re]Non vedi che è un [Mi]vero affare, [La]non perdere [Fa#m]l''occasione
[Sim]se no poi [Mi]te ne penti[La]rai, [La]
[Re]Non capita [Mi]tutti i giorni
[Do#m]di avere due consulenti, [Si]due impresari,
[Mi]che si fanno in quattro per te!
{eoc}

[La]Avanti, non [Fa#m]perder tempo, [Sim]firma [Mi]qua
[La]è un normale con[Fa#m]tratto, è una for[Sim]mali[Mi]tà
[La]tu ci cedi [Do#]tutti i diritti e [Fa#]noi faremo di te
un [Sim]divo da [Mi]hit [La]parade!

{comment: strum: La Fa#m Sim Mi La Fa#m Sim Mi La Do# Fa# Sim Mi La}

{soc}
RIT:
[Re]Non vedi che è un [Mi]vero affare, [La]non perdere [Fa#m]l''occasione
[Sim]se no poi [Mi]te ne penti[La]rai, [La]
[Re]Non capita [Mi]tutti i giorni
[Do#m]di avere due consulenti, [Si]due impresari,
[Mi]che si fanno in quattro per te!
{eoc}

[La] [Fa#m] [Sim] [Mi]
Quanta fretta, ma dove corri, dove vai?
[La]Che fortuna che [Fa#m]hai avuto ad incon[Sim]trare [Mi]noi!
[La]Lui è il gatto [Do#]io la volpe [Fa#]stiamo in società
di [Sim]noi ti [Mi]puoi [La]fidar... [Fa#m]
di [Sim]noi ti [Mi]puoi [La]fidar... [Fa#m]
di [Sim]noi ti [Mi]puoi fi[La]dar!',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'fde4e6b2-b8d8-4d37-8340-ecdba00848c5'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 7. I cento passi
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'ac8aed23-2148-48af-9292-14b5f77e136e',
  'I cento passi',
  'Modena City Ramblers',
  'esterni',
  'Mim',
  'Combat folk in levare (↓ ↓↑ ↓↑)',
  132,
  'folk incalzante (circa 130–135)',
  '4/4',
  NULL,
  'import_pdf',
  'Spartito Modena City Ramblers',
  '{comment: intro: Mim Do Sol Si}
[Mim]Nato nella terra dei vespri [Sol]e degli aranci
[Do]Tra Cinisi e Palermo parlava [Si]alla sua radio
[Mim]Negli occhi si leggeva la voglia [Sol]di cambiare
[Do]La voglia di Giustizia che lo [Si]portò a lottare
[Mim]Aveva un cognome ingombran[Sol]te e rispettato
[Do]Di certo in quell''ambiente da lui poco [Si]onorato
Si [Mim]sa dove si nasce ma [Sol]non come si muore
e non se un [Do]ideale ti porterà dolore [Si]

Ma la tua [Lam]vita adesso puoi cambi[Mim]are
solo [Lam]se sei disposto a camminar[Mim]e
Gridan[Lam]do forte senza aver paura
[Sol]contando ce[Si]nto passi lungo la tua strada

{soc}
RIT:
Allora [Mim]uno due tre quattro cinque dieci [Do]cento passi
[Sol]Uno due tre quattro cinque [Si]dieci cento passi!
[Mim]Uno due tre quattro cinque [Do]dieci cento passi
[Sol]Uno due tre quattro cinque [Si]dieci cento passi!
{eoc}

Pote[Mim]va come tanti scegliere [Sol]e partire
Inv[Do]ece lui decise di restare [Si]
Gli [Mim]amici la politica la lo[Sol]tta del partito
Alle [Do]elezioni si era candidato [Si]
Dice[Mim]va da vicino li avrebbe [Sol]controllati
Ma poi [Do]non ebbe tempo perché venne [Si]ammazzato...
Il [Mim]nome di suo padre nella notte non [Sol]è servito
gli amici dispera[Do]ti non l''hanno più [Si]trovato

Allo[Lam]ra dimmi se tu sai contare
[Mim]dimmi se [Lam]sai anche camminar[Mim]e
Conta[Lam]re camminare insieme a cantare
[Mim]la storia [Si]di Peppino e degli amici siciliani

{soc}
RIT:
[Mim]Uno due tre quattro cinque [Do]dieci cento passi
[Sol]Uno due tre quattro cinque [Si]dieci cento passi (x4)
{eoc}

[Mim]Era la notte buia dello Stato Italiano
Quella del nove maggio ''78
La notte di via Caetani del corpo di Aldo Moro
L''alba dei funerali di uno stato

Allo[Lam]ra dimmi se tu sai contare
[Mim]dimmi se [Lam]sai anche cammina[Mim]re
Conta[Lam]re camminare insieme a cantare
[Mim]la storia di [Si]Peppino e degli amici siciliani

{soc}
RIT:
Allora
[Mim]Uno due tre quattro cinque [Do]dieci cento passi
[Sol]Uno due tre quattro cinque [Si]dieci cento passi!
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'ac8aed23-2148-48af-9292-14b5f77e136e'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 8. Re dei Re
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '790edb86-c21a-49f0-b457-2ff5f5a610db',
  'Re dei Re',
  'RnS',
  'chiesa',
  'Sol',
  'Praise & Worship (↓ ↓↑ ↑↓↑)',
  110,
  'moderato solenne (circa 110)',
  '4/4',
  NULL,
  'import_pdf',
  'Canti Liturgici RnS',
  '{comment: intro: Mim Do Sol Re Mim Do Sol Re}
[Mim]Hai solle[Do]vato i nostri [Sol]volti dalla [Re]polvere
[Mim]Le nostre [Do]colpe hai por[Sol]tato su di [Re]te
[Mim]Signore [Do]ti sei fatto [Sol]uomo tra gli [Re]uomini, [Mim]per [Do]a---[Sol]mo--[Re]re

{soc}
RIT:
[Mim]Figlio dell''altissimo, [Do]Povero tra i poveri,
[Sol]Vieni a dimorare tra [Re]noi
[Mim]Dio dell''impossibile, [Do]Re di tutti i secoli,
[Sol]Vieni nella tua mae[Re]stà
[Mim] [Do]
Re dei Re
I [Sol]popoli ti acclamano, i [Re]cieli ti proclamano,
[Mim] [Do]
Re dei Re
[Sol]Luce degli uomini, [Re]regna col tuo amore tra [Mim]noi...
{eoc}

{comment: strum: Mim Do Sol Re Re Mim Mim Do Sol Re Re Mim}
{comment: modulazione: Fam Reb Lab Mib Fam Reb Lab Mib}

[Fam]Ci hai risca[Reb]ttati dalla [Lab]stretta delle [Mib]tenebre
[Fam]Perché [Reb]potessimo [Lab]glorificare [Mib]te
[Fam]Hai river[Reb]sato in noi la [Lab]vita del tuo [Mib]spirito, [Fam]per [Reb]a---[Lab]mo--[Mib]re

{soc}
RIT:
[Fam]Figlio dell''altissimo, [Reb]Povero tra i poveri,
[Lab]Vieni a dimorare tra [Mib]noi
[Fam]Dio dell''impossibile, [Reb]Re di tutti i secoli,
[Lab]Vieni nella tua mae[Mib]stà
[Fam] [Reb]
Re dei Re
I [Lab]popoli ti acclamano, i [Mib]cieli ti proclamano,
[Lab]Luce degli uomini, [Mib]regna col tuo amore tra [Fam]noi...
{eoc}

[Fam]Tua [Reb]è la [Lab]glo-[Mib]ria per [Fam]sem-[Reb]pre [Lab] [Mib]
[Fam]Tua [Reb]è la [Lab]glo-[Mib]ria per [Fam]sem-[Reb]pre [Lab] [Mib]
[Fam]Glo-[Reb]ria, [Lab]glo-[Mib]ria, [Fam]glo-[Reb]ria, [Lab]glo-[Mib]ria!

{soc}
RIT:
[Fam]Figlio dell''altissimo, [Reb]Povero tra i poveri,
[Lab]Vieni a dimorare tra [Mib]noi
[Fam]Dio dell''impossibile, [Reb]Re di tutti i secoli,
[Lab]Vieni nella tua mae[Mib]stà
[Fam] [Reb]
Re dei Re
I [Lab]popoli ti acclamano, i [Mib]cieli ti proclamano,
[Fam] [Reb]
Re dei Re
[Lab]Luce degli uomini, [Mib]regna col tuo amore tra [Fam]noi!
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = '790edb86-c21a-49f0-b457-2ff5f5a610db'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 9. Riptide
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '6d7b5c35-af27-4c4d-977a-903d774271df',
  'Riptide',
  'Vance Joy',
  'esterni',
  'Sibm',
  'Folk ukulele: Giù, Giù, Giù-Su-Giù-Su (↓ ↓ ↓↑↓↑)',
  102,
  'allegro folk-pop (circa 100–105)',
  '4/4',
  1,
  'import_pdf',
  'Accordi in Sibm Lab Reb (oppure Capo al 1° tasto: Lam Sol Do)',
  '{comment: intro: Sibm Lab Reb Sibm Lab Reb}
[Sibm]I was scared of [Lab]dentists and the [Reb]dark
[Sibm]I was scared of [Lab]pretty girls and [Reb]starting conversations
Oh, [Sibm]all my fri[Lab]ends are turning [Reb]green
You''re the [Sibm]magician''s [Lab]assistant in their [Reb]dream
[Sibm]Ah-ooh--[Lab]ooh-[Reb]ooh, [Sibm]ah-ahh-ah-[Lab]ah
And they [Reb]come unstuck

{soc}
RIT:
[Sibm]Lady, [Lab]running down to the [Reb]riptide
Taken away to the [Sibm]dark side
[Lab]I wanna be your [Reb]left-hand man
I [Sibm]love you [Lab]when you''re singing that [Reb]song
And I got a lump in my [Sibm]throat
''Cause [Lab]you''re gonna sing the [Reb]words wrong
{eoc}

[Sibm]There''s this movie [Lab]that I think you''ll [Reb]like
This [Sibm]guy decides to [Lab]quit his job and [Reb]heads to New York City
This [Sibm]cowboy''s [Lab]running from hims[Reb]elf
And [Sibm]she''s been living [Lab]on the highest [Reb]shelf
[Sibm]Ah-ooh--[Lab]ooh-[Reb]ooh, [Sibm]ah-ahh-ah-[Lab]ah
And they [Reb]come unstuck

{soc}
RIT:
[Sibm]Lady, [Lab]running down to the [Reb]riptide
Taken away to the [Sibm]dark side
[Lab]I wanna be your [Reb]left-hand man
I [Sibm]love you [Lab]when you''re singing that [Reb]song
And I got a lump in my [Sibm]throat
''Cause [Lab]you''re gonna sing the [Reb]words wrong
{eoc}

[Sibm]I just wanna, I just wanna [Lab]know
[Reb]If you''re gonna, if you''re gonna [Solb]stay
[Sibm] [Lab]
I just gotta, I just gotta know
[Reb]I can''t have it, I can''t have it [Solb]any other way
I [Sibm]swear she''s [Lab]destined for the [Reb]screen
[Sibm]Closest thing to [Lab]Michelle Pfeiffer [Reb]that you''ve ever seen, oh

{soc}
RIT:
[Sibm]Lady, [Lab]running down to the [Reb]riptide
Taken away to the [Sibm]dark side
[Lab]I wanna be your [Reb]left-hand man
I [Sibm]love you [Lab]when you''re singing that [Reb]song
And I got a lump in my [Sibm]throat
''Cause [Lab]you''re gonna sing the [Reb]words wrong
{eoc}

Oh [Sibm]lady, [Lab]running down to the [Reb]riptide
Taken away to the [Sibm]dark side
[Lab]I wanna be your [Reb]left-hand man
I [Sibm]love you [Lab]when you''re singing that [Reb]song
And I got a lump in my [Sibm]throat
''Cause [Lab]you''re gonna sing the [Reb]words wrong
Yeah, I got a lump in my [Sibm]throat
''Cause [Lab]you''re gonna sing the wor[Reb]ds wrong',
  COALESCE((SELECT created_at FROM public.canti WHERE id = '6d7b5c35-af27-4c4d-977a-903d774271df'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 10. Se piovesse il tuo nome
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '38f823cf-009d-4816-9679-bf0966661fd2',
  'Se piovesse il tuo nome',
  'Elisa',
  'esterni',
  'Mi',
  'Ballad pop sincopata (↓  ↓↑  ↑↓↑)',
  104,
  'ballad pop (circa 100–105)',
  '4/4',
  NULL,
  'import_pdf',
  'Spartito PDF Riferimenti',
  '{comment: intro: Fa#m La Do#m Mi}
[Fa#m]Non ci siamo mai dedicati
[La]dedicati le, le canzoni giu[Do#m]ste
forse perché di noi non ne [Mi]parla mai nessuno
[Fa#m]Non ci siamo mai detti le parole
[Si]non ci siamo mai detti le parole [Do#m]giuste
neanche per sbaglio, [Mi]neanche per sbaglio in silenzio
[La]La città è piena di fontane
[Fa#m]ma non sparisce mai la [Si]sete
sa[Mi]rà la distrazione, [Si]sarà, sarà, sarà
che ho sempre il Sahara in boc[La]ca
La città è piena di negozi
[Fa#m]ma poi chiudono [Si]sempre
e [Mi]rimango solo io a dare il [Si]resto al mondo

{soc}
RIT:
Se in mezzo alle [Do#m]strade o nella confu[Fa#m]sione
piovesse il tuo [La]nome
io una [Si]lettera per volta vorrei [Do#m]bere
in mezzo a mille per[Fa#m]sone, stazione dopo sta[La]zione
e se non [Si]scendo a quella giusta è colpa [Fa#m]tua
{eoc}

[Fa#m]Non ci siamo mai visti per davvero e
[La]non ci siamo mai presi per davvero in [Do#m]giro
neanche per sbaglio, [Mi]neanche per sbaglio in silenzio
[La]La città incontra il tuo deserto
[Fa#m] [Si]che io innaffio da sempre
sa[Mi]rà la mia missione, sarà, sa[Si]rà, sarà
che ora ho un fiore nella boc[La]ca

{soc}
RIT:
Se in mezzo alle [Do#m]strade o nella confu[Fa#m]sione
piovesse il tuo [La]nome
io una [Si]lettera per volta vorrei [Do#m]bere
in mezzo a mille per[Fa#m]sone, stazione dopo sta[La]zione
e se non [Si]scendo a quella giusta è colpa [Fa#m]mia
{eoc}

Ma senza te chi sono [Si]io?
Un mucchio di spese impilate [Do#m]
un libro in francese che poi non lo [La]so neanche
neanche bene [Fa#m]io
se devi andare, pago [Si]io
scusa se penso a voce [La]alta, scusa se penso a voce alta...

{soc}
RIT:
[Do#m]Se in mezzo alle strade o nella confu[Fa#m]sione
piovesse il tuo [La]nome
io una [Si]lettera per volta vorrei [Do#m]bere
in mezzo a mille per[Fa#m]sone, stazione dopo sta[La]zione
e se non [Si]scendo a quella giusta è colpa...
{eoc}

{comment: outro: Fa#m La Do#m Mi}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = '38f823cf-009d-4816-9679-bf0966661fd2'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 11. Servo per amore
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'ca4fc347-4a5c-43b6-ba27-1b6c5525d48c',
  'Servo per amore',
  'Gen Rosso',
  'chiesa',
  'Mim',
  'Arpeggio lento o pennata dolce (↓ ↓ ↓↑)',
  76,
  'lento meditativo (circa 75–80)',
  '4/4',
  NULL,
  'import_pdf',
  'Gen Rosso - Canti Liturgici',
  'Una [Mim]notte di sudore sulla barca in mezzo al [Sol]mare
e mentre il [Re]cielo si imbianca [Sim]già,
tu guardi [Do]le tue reti [Mim]vuote.
Ma la voce che ti chiama [Sol]un altro mare ti mostre[Re]rà
e sulle [Sim]rive di ogni [Do]cuore, le tue [Mim]reti gette[Re]rai.

{soc}
RIT:
[Mim]Offri la vita tua [Sol]come Ma[Re]ria
ai [Sim]piedi della [Do]croce
[Mim]e sarai [Sol]servo di ogni [Re]uomo,
[Sol]servo per [Do]amore,
[Sol]sacerdote [Lam]dell''u[Do]mani[Sol]tà.
{eoc}

Avan[Mim]zavi nel silenzio, tra le lacrime e spe[Sol]ravi
che il seme [Re]sparso davanti a [Sim]te
cadesse [Do]sulla buona [Mim]terra.
Ora il cuore tuo è in festa [Sol]perché il grano biondeggia [Re]già,
è matu[Sim]rato sotto il [Do]sole, puoi ri[Mim]porlo nei gra[Re]nai.

{soc}
RIT:
[Mim]Offri la vita tua [Sol]come Ma[Re]ria
ai [Sim]piedi della [Do]croce
[Mim]e sarai [Sol]servo di ogni [Re]uomo,
[Sol]servo per [Do]amore,
[Sol]sacerdote [Lam]dell''u[Do]mani[Sol]tà.
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'ca4fc347-4a5c-43b6-ba27-1b6c5525d48c'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 12. Un falco nel cielo
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'f7dc0688-cf9d-48a8-95d8-889a87d8ec4f',
  'Un falco nel cielo',
  'Canto scout',
  'scout',
  'Re',
  'Ritmo scout base (↓ ↓↑ ↑↓↑)',
  112,
  'allegro scout (circa 110–115)',
  '4/4',
  NULL,
  'import_pdf',
  'Canzoniere Scout',
  '{comment: intro: Re Sol Re Sol Sol Sol La La La Re}
Un [Re]falco volava nel [Sol]cielo un mattino,
[La]ricordo quel tempo quando [Re]ero bambino
Io lo seguivo e nel [Sol]rosso tramonto
dall''[La]alto di un monte scoprivo il mio [Re]mondo.

{soc}
RIT:
E allora [Sol]eha, eha, eha!
E allora [Re]eha, eha, eha!
Eha, eha, eha, eha, eha, eha, eh!
{eoc}

[Re]Fiumi, boschi e mari [Sol]senza confine,
i [La]chiari orizzonti, le [Sol]verd[Re]i colline
E un giorno partivo per un [Sol]lungo sentiero
par[La]tivo ragazzo e tor[Re]navo guerriero.

{soc}
RIT:
E allora [Sol]eha, eha, eha!
E allora [Re]eha, eha, eha!
Eha, eha, eha, eha, eha, eha, eh!
{eoc}

[Re]Le tende rosse vi[Sol]cino al torrente,
la [La]vita felice [Re]tra la mia gente
E quando il mio arco col[Sol]piva lontano
sen[La]tivo l''orgoglio di [Re]essere indiano.

{soc}
RIT:
E allora [Sol]eha, eha, eha!
E allora [Re]eha, eha, eha!
Eha, eha, eha, eha, eha, eha, eh!
{eoc}

[Re]Fiumi, boschi e mari [Sol]mossi dal vento,
[La]lune su lune, i miei [Re]capelli d''argento
E quando era l''ora dell''[Sol]ultimo sonno
[La]lasciavo il mio campo per non [Re]farvi ritorno.

{soc}
RIT:
E allora [Sol]eha, eha, eha!
E allora [Re]eha, eha, eha!
Eha, eha, eha, eha, eha, eha, eh!
{eoc}

Un [Re]falco volava nel [Sol]cielo un mattino
[La]e verso il sole mi indi[Re]cava il cammino
Un falco che un giorno è [Sol]stato colpito,
[La]ma non è morto, è [Re]solo ferito.

{soc}
RIT:
E allora [Sol]eha, eha, eha!
E allora [Re]eha, eha, eha!
Eha, eha, eha, eha, eha, eha, eh!
E allora [Sol]eha, eha, eha!
E allora [Re]eha, eha, eha!
Eha, eha, eha, eha, eha, eha, eh!
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'f7dc0688-cf9d-48a8-95d8-889a87d8ec4f'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 13. Wonderwall
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '9e1a0c58-dd28-4513-98a4-20477354396c',
  'Wonderwall',
  'Oasis',
  'esterni',
  'Sol',
  'Strumming acustico 16esimi (↓  ↓ ↓↑ ↑↓↑ ↓↑↓↑)',
  88,
  'acustico sincopato (circa 85–90)',
  '4/4',
  2,
  'import_pdf',
  'Capotasto al 2° tasto (Em7 G Dsus4 A7sus4)',
  '{comment: intro: Mim Sol Re La Mim Sol Re La}
[Mim]Today is [Sol]gonna be the day
That they''re [Re]gonna throw it back to [La]you,
[Mim]By now you [Sol]should of somehow
Rea[Re]lised what you gotta [La]do.
[Mim]I don''t believe that [Sol]anybody [Re]feels the way I [La]do
About you [Do]now. [Re] [La]

[Mim]Backbeat, the [Sol]word is on the street
That the [Re]fire in your heart is [La]out,
[Mim]I''m sure you''ve [Sol]heard it all before,
But you [Re]never really had a [La]doubt.
[Mim]I don''t believe that [Sol]anybody [Re]feels the way I [La]do
About you [Mim]now. [Sol] [Re] [La]

And [Do]all the roads we [Re]have to walk are [Mim]winding,
And [Do]all the lights that [Re]lead us there are [Mim]blinding
[Do]There are many [Re]things that I
would [Sol]like to [Re]say to [Mim]you
but I [Sol]don''t know [La]how.

{soc}
RIT:
Because [Do]maybe... [Mim] [Sol]
You''re [Mim]gonna be the one that [Do]saves me... [Mim] [Sol]
And [Mim]after [Do]all... [Mim] [Sol]
You''re my [Mim]wonder[Do]wall. [Mim] [Sol] [Mim] [La]
{eoc}

[Mim]Today is [Sol]gonna be the day
That they''re [Re]gonna throw it back to [La]you,
[Mim]By now you [Sol]should of somehow
Rea[Re]lised what you gotta [La]do.
[Mim]I don''t believe that [Sol]anybody [Re]feels the way I [La]do
About you [Do]now. [Re] [La]

And [Do]all the roads that [Re]lead you there were [Mim]winding
And [Do]all the lights that [Re]light the way are [Mim]blinding
[Do]There are many [Re]things that I
would [Sol]like to [Re]say to [Mim]you
but I [Sol]don''t know [La]how.

{soc}
RIT:
Because [Do]maybe... [Mim] [Sol]
You''re [Mim]gonna be the one that [Do]saves me... [Mim] [Sol]
And [Mim]after [Do]all... [Mim] [Sol]
You''re my [Mim]wonder[Do]wall. [Mim] [Sol] [Mim]
{eoc}

{soc}
RIT:
I said [Do]maybe... [Mim] [Sol]
You''re [Mim]gonna be the one that [Do]saves me... [Mim] [Sol]
And [Mim]after [Do]all... [Mim] [Sol]
You''re my [Mim]wonder[Do]wall. [Mim] [Sol] [Mim]
{eoc}

I said [Do]maybe, [Mim] [Sol]
You''re [Mim]gonna be the one that [Do]saves me, [Mim] [Sol]
You''re [Mim]gonna be the one that [Do]saves me, [Mim] [Sol]
You''re [Mim]gonna be the one that [Do]saves me. [Mim] [Sol]

{comment: outro: Mim Do Mim Sol Mim Do Mim Sol}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = '9e1a0c58-dd28-4513-98a4-20477354396c'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 14. Scouting For Boys
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '3676dfa4-ffda-4348-99d3-6c2d2c78656a',
  'Scouting For Boys',
  'Canto scout',
  'scout',
  'Do',
  'Marcia scout incalzante (↓ ↓↑ ↑↓↑)',
  114,
  'incalzante e brillante (circa 112–116)',
  '4/4',
  NULL,
  'import_pdf',
  'Canzoniere Clan - Rover e Scolte (modulazioni Do -> Re -> Mi)',
  '[Do]Eravamo [Sol]ragazzi ancora,
[Lam]con il tem[Fa]po aper[Sol]to davanti,
[Do]i giorni più [Sol]lunghi coi calzoni corti,
[Lam]a caccia di [Fa]vento i sem[Sol]plici canti.
[Do]La carta e la [Sol]colla insieme,
[Lam]incrociare due [Fa]canne più [Sol]forti,
[Do]legate allo [Sol]spago le nostre speranze,
[Lam]nei nostri aqui[Fa]loni i sogni [Sol]mai morti.

[Do]Si alzano [Sol]ora in alto,
[Lam]più in alto di [Fa]allora le [Sol]danze,
[Do]restare con[Sol]fusi il tempo ti afferra,
[Lam]scommetter sul [Fa]mondo ma sen[Sol]za arroganza.
[Do]La testa nel [Sol]cielo è vero,
[Lam]ma il cammi[Fa]nare ti en[Sol]tra da terra
[Do]e pronti a par[Sol]tire rischiare la strada,
[Lam]i fiori più [Fa]veri non son [Sol]quelli di serra.

{soc}
RIT:
[Do]Va'' più [Sol]in su, più [Lam]in là,
[Fa]contro [Sol]vento [Do]è lotta [Sol]dura [Lam]ma
[Fa]tendi [Sol]lo spago [Do]se sta a [Sol]cuore [Lam]a noi,
[Fa]non [Sol]è vana [Do]speranza,
[Sol]cambie[Lam]rà: ol[Fa]tre la si[Sol]epe va''. [Do]
{eoc}

[Do]È il potere all''[Sol]indifferenza,
[Lam]indifferenza [Fa]che il potere [Sol]fa ladri,
[Do]la terra or[Sol]mai scossa dagli atomi pazzi,
[Lam]denaro trion[Fa]fante schiaccia [Sol]grida di madri.
[Do]È ancora la [Sol]grande corsa
[Lam]per gli stu[Fa]pidi ar[Sol]mati razzi,
[Do]in rialzo i pro[Sol]fitti, più disoccupati,
[Lam]e c''è sempre chi [Fa]dice: "State [Sol]buoni ragazzi...".

[Do]È nascosta ras[Sol]segnazione
[Lam]dietro "gran[Fa]di" pro[Sol]getti mancati,
[Do]non è certo più il [Sol]tempo di facili sogni,
[Lam]i nostri aqui[Fa]loni hanno i [Sol]fili bloccati.
[Do]Ma vediamo più a[Sol]cuti e nuovi
[Lam]affiorare con[Fa]tinui bi[Sol]sogni:
[Do]solidali ci [Sol]chiama la città dell''uomo,
[Lam]sporcarsi le [Fa]mani in questo [Sol]mare è un segno.

{soc}
RIT:
[Do]Va'' più [Sol]in su, più [Lam]in là,
[Fa]contro [Sol]vento [Do]è lotta [Sol]dura [Lam]ma
[Fa]tendi [Sol]lo spago [Do]se sta a [Sol]cuore [Lam]a noi,
[Fa]non [Sol]è vana [Do]speranza,
[Sol]cambie[Lam]rà: ol[Fa]tre la si[Sol]epe va''. [Do]
{eoc}

{comment: modulazione in Re}
[Re]Ed ancora più [La]in alto vola,
[Sim]prende qu[Sol]ota, sor[La]vola vallate,
[Re]portato dai [La]venti ma le idee le ha chiare,
[Sim]di certe nubi si [Sol]muore, di [La]acque inquinate.
[Re]Non cantare per [La]evasione,
[Sim]canta solo se [Sol]vuoi pen[La]sare,
[Re]il fine nel [La]mezzo come il grano nel seme,
[Sim]un progresso per l''[Sol]uomo dob[La]biamo imparare.

[Re]Meccanismi per[La]versi fuori,
[Sim]meccanismi che [Sol]dentro [La]teme,
[Re]avere-sem[La]brare ti prendono a fondo,
[Sim]cercare se [Sol]stessi è più [La]dura ma insieme...
[Re]È lottare per [La]realizzare
[Sim]un amore [Sol]che sia fe[La]condo,
[Re]via le porte blin[La]date chiuse sugli egoismi,
[Sim]un uomo e una [Sol]donna spa[La]lancati sul mondo.

{soc}
RIT:
[Re]Va'' più [La]in su, più [Sim]in là,
[Sol]contro [La]vento [Re]è lotta [La]dura [Sim]ma
[Sol]tendi [La]lo spago [Re]se sta a [La]cuore [Sim]a noi,
[Sol]non [La]è vana [Re]speranza,
[La]cambie[Sim]rà: ol[Sol]tre la si[La]epe va''. [Re]
{eoc}

{comment: modulazione in Mi}
[Mi]E spingendo di [Si]nuovo i passi
[Do#m]sulle strade [La]senza far ru[Si]more,
[Mi]non teme il [Si]vento con la pioggia e col sole,
[Do#m]"Già e non an[La]cora" se[Si]guire l''amore.
[Mi]È un tesoro nas[Si]costo, cerca,
[Do#m]è sepolto [La]giù nelle [Si]gole,
[Mi]è paura che [Si]stringe quando siamo vicini
[Do#m]a chi in vita sua [La]mai ha a[Si]vuto parole.

[Mi]E lo scopri negli [Si]occhi, è vero,
[Do#m]in quegli occhi tor[La]nati bam[Si]bini,
[Mi]han saputo ris[Si]chiare: "Lascia tutto se vuoi,
[Do#m]sulla sua strada an[La]dare, scor[Si]dare i tuoi fini".
[Mi]Un aquilone nel [Si]vento chiama:
[Do#m]tendi il filo, è [La]ora! [Si]Puoi!
[Mi]Le scelte di [Si]oggi in un mondo che cambia,
[Do#m]pronti a servire è an[La]cora: "[Si]Scouting for boys".

{soc}
RIT:
[Mi]Va'' più [Si]in su, più [Do#m]in là,
[La]contro [Si]vento [Mi]è lotta [Si]dura [Do#m]ma
[La]tendi [Si]lo spago [Mi]se sta a [Si]cuore [Do#m]a noi,
[La]non [Si]è vana [Mi]speranza,
[Si]cambie[Do#m]rà: ol[La]tre la si[Si]epe va''. [Mi]
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = '3676dfa4-ffda-4348-99d3-6c2d2c78656a'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 15. Strade di coraggio
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'bd6e7fbf-c50f-4f65-9607-037c7b788f99',
  'Strade di coraggio',
  'Marco Costantini, Marco Lodi',
  'scout',
  'Do',
  'Inno pop-folk energico (↓ ↓↑ ↑↓↑)',
  116,
  'ritmato ed energico (circa 115–120)',
  '4/4',
  NULL,
  'import_pdf',
  'Route Nazionale RS 2014 - AGESCI',
  '{comment: intro: Do Fa Do Sol Do Fa Do Sol}
[Do]Sento nel pro[Fa]fondo un [Do]desiderio [Sol]nascere
è la [Do]voglia di par[Fa]tire che [Do]continua a [Sol]crescere
[Lam]verso l''oriz[Fa]zonte pos[Do]siam cammi[Sol]nare
[Lam]ricorda che [Fa]solo chi [Do]sogna può vo[Sol]lare.
Cam[Do]mino con la sag[Fa]gezza [Do]del viaggia[Sol]tore,
[Do]vivo con gli [Fa]occhi di [Do]un sogna[Sol]tore,
la [Lam]felici[Fa]tà non è un [Do]semplice tra[Sol]guardo
[Lam]ma la dire[Fa]zione [Do]del nostro [Sol]sguardo.

{soc}
RIT:
[Do]È giunta l''[Sol]ora, è [Lam]giunto il [Fa]momento
di [Do]essere [Sol]protagonisti [Lam]del nostro [Fa]tempo,
[Do] [Sol] [Lam] [Fa]
la strada è la stessa anche se siamo lontani,
ser[Do]vire è la [Sol]sfida, il fu[Lam]turo è do[Fa]mani!
Affron[Do]tiamo con [Sol]coraggio [Lam]ogni sa[Fa]lita,
[Do]diritti al fu[Sol]turo sulle [Fa]strade
della nostra [Do]vita. [Fa] [Do] [Sol] [Do] [Fa] [Sol]
{eoc}

Un [Do]cielo stel[Fa]lato, un fuoco [Do]e il suo ca[Sol]lore,
[Do]ogni [Fa]momento ha un suo [Do]dolce sapo[Sol]re,
[Lam]vediamo in lonta[Fa]nanza una [Do]stella bril[Sol]lare,
cer[Lam]tezza di qual[Fa]cuno a cui [Do]potersi affi[Sol]dare.
[Do]Insieme la bel[Fa]lezza della [Do]condivi[Sol]sione,
le [Do]semplici emo[Fa]zioni di [Do]una can[Sol]zone,
[Lam]insieme costrui[Fa]amo un [Do]mondo [Sol]migliore,
libe[Lam]riamo il fu[Fa]turo col [Do]coraggio nel [Sol]cuore.

{soc}
RIT:
[Do]È giunta l''[Sol]ora, è [Lam]giunto il [Fa]momento
di [Do]essere [Sol]protagonisti [Lam]del nostro [Fa]tempo,
la [Do]strada è la [Sol]stessa anche se [Lam]siamo lon[Fa]tani,
ser[Do]vire è la [Sol]sfida, il fu[Lam]turo è do[Fa]mani!
Affron[Do]tiamo con [Sol]coraggio [Lam]ogni sa[Fa]lita,
[Do]diritti al fu[Sol]turo sulle [Fa]strade
della nostra [Do]vita. [Fa] [Do] [Sol] [Do] [Fa] [Sol]
{eoc}

[Do]Viviamo per l''[Fa]oggi, il fu[Do]turo è sullo [Sol]sfondo,
spor[Do]chiamo le [Fa]nostre mani [Do]in questo mon[Sol]do,
[Lam]non si può più [Fa]stare [Do]fermi ad aspet[Sol]tare,
il [Lam]nostro sor[Fa]riso ha ancora [Do]molto da da[Sol]re.
Sen[Do]tiamo che l''a[Fa]more non è [Do]mai abbas[Sol]tanza,
a [Do]tutti vogliam gri[Fa]dare che c''è an[Do]cora spe[Sol]ranza,
a chi[Lam]unque incon[Fa]triamo [Do]vogliam far capi[Sol]re
[Lam]che il nostro [Fa]stile è sempre [Do]pronti a ser[Sol]vire.

La pro[Do]messa che orgo[Sol]gliosi por[Lam]tiamo nel [Fa]cuore
ci [Do]ricorda che a ogni [Sol]istante dob[Lam]biam dar co[Fa]lore,
l''i[Do]dea di un cambia[Sol]mento pos[Lam]siam realiz[Fa]zare:
[Do]se siamo [Sol]uniti nulla [Lam]ci può fer[Fa]mare,
[Do]e io non [Sol]sono ancora [Lam]stanco di pen[Fa]sare
che [Do]noi questo [Sol]mondo lo [Fa]possiam cambiare!

{soc}
RIT:
[Do]È giunta l''[Sol]ora, è [Lam]giunto il [Fa]momento
di [Do]essere [Sol]protagonisti [Lam]del nostro [Fa]tempo,
la [Do]strada è la [Sol]stessa anche se [Lam]siamo lon[Fa]tani,
ser[Do]vire è la [Sol]sfida, il fu[Lam]turo è do[Fa]mani!
Affron[Do]tiamo con [Sol]coraggio [Lam]ogni sa[Fa]lita,
[Do]diritti al fu[Sol]turo sulle [Fa]strade
della nostra [Do]vita. [Fa] [Do] [Sol] [Do] [Fa] [Sol]
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'bd6e7fbf-c50f-4f65-9607-037c7b788f99'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 16. Come sole come goccia
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'd3159781-a602-47ef-8d61-3a216440c902',
  'Come sole come goccia',
  'Canto scout',
  'scout',
  'Sol',
  'Ballata allegra (↓ ↓↑ ↑↓↑)',
  104,
  'allegro e scorrevole (circa 100–108)',
  '4/4',
  NULL,
  'import_pdf',
  'Canzoniere Scout',
  '[Sol]Ma che strana cosa, questo raggio di [Mim]sole che vorrà?
Risve[Do]gliarmi dal sonno e attirare il mio sguardo verso [Re]quel bel prato là.
Senti un po'' che [Sol]roba, cos''è ''sto pro[Mim]fumo di lillà?
Non [Do]riesco a stare fermo, devo uscire a guardare, è già [Re]troppo che aspetto qua.

[Do]Come sole che cammina tutto [Sol]il giorno per tramontar,
[Do]come goccia che da nube arriva al [Re]mar.

{soc}
RIT:
[Do]Non [Re]pen[Sol]sare sia un imbroglio,
[Do]na[Re]sce un [Sol]seme tu lo sai.
[Do]Poi [Re]di[Sol]venta un quadrifoglio [Do]se lo [Re]cure[Sol]rai.
[Do]Non [Re]è un [Sol]sogno su di un foglio, [Do]le [Re]ra[Sol]dici ci son già.
[Do]Può [Re]fio[Sol]rire se lo voglio, [Do]comin[Re]ciamo [Sol]qua.
{eoc}

[Sol]Su prepara lo zaino, metti dentro tutto [Mim]se ci sta,
lascia a [Do]casa soltanto la tristezza che hai dentro e ve[Re]drai che passerà.
Prendi la bor[Sol]raccia, caldo è il sole e sete [Mim]ti verrà
ma se [Do]sai far uscire la sorgente che hai dentro niente [Re]più ti fermerà.

[Do]Come sole che cammina tutto [Sol]il giorno per tramontar,
[Do]come goccia che da nube arriva al [Re]mar.

{soc}
RIT:
[Do]Non [Re]pen[Sol]sare sia un imbroglio,
[Do]na[Re]sce un [Sol]seme tu lo sai.
[Do]Poi [Re]di[Sol]venta un quadrifoglio [Do]se lo [Re]cure[Sol]rai.
[Do]Non [Re]è un [Sol]sogno su di un foglio, [Do]le [Re]ra[Sol]dici ci son già.
[Do]Può [Re]fio[Sol]rire se lo voglio, [Do]comin[Re]ciamo [Sol]qua.
{eoc}

[Sol]Provo ad alzare gli occhi, quanta gente vedo in[Mim]torno a me.
"Meno [Do]male" mi dico "meno duro è il cammino se sa[Re]remo almeno in tre".
Ma se sto se[Sol]duto, gli altri partiranno [Mim]senza me
e sta [Do]pure sicuro che ho qualcosa da dire e lo [Re]dico proprio a te.

[Do]Come sole che cammina tutto [Sol]il giorno per tramontar,
[Do]come goccia che da nube arriva al [Re]mar.

{soc}
RIT:
[Do]Non [Re]pen[Sol]sare sia un imbroglio,
[Do]na[Re]sce un [Sol]seme tu lo sai.
[Do]Poi [Re]di[Sol]venta un quadrifoglio [Do]se lo [Re]cure[Sol]rai.
[Do]Non [Re]è un [Sol]sogno su di un foglio, [Do]le [Re]ra[Sol]dici ci son già.
[Do]Può [Re]fio[Sol]rire se lo voglio, [Do]comin[Re]ciamo [Sol]qua.
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'd3159781-a602-47ef-8d61-3a216440c902'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 17. L'unico Maestro
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'e4912a52-c824-4f8e-b567-27b05591d903',
  'L''unico Maestro',
  'Canto liturgico scout',
  'chiesa',
  'Lam',
  'Arpeggio meditativo o pennata lenta (↓ ↓↑ ↑↓)',
  78,
  'lento meditativo (circa 75–82)',
  '4/4',
  NULL,
  'import_pdf',
  'Canzoniere Scout e Liturgico',
  '[Lam]Le mie mani, [Mi]con le tue [Lam]possono fare mera[Mi]viglie,
[Lam]possono stringere, [Mi]perdonare [Lam]e costruire catt[Mi]edrali.
[Do]Possono dare [Sol]da [Fa]mang[Mi]iare [Lam]e far fiorire una [Mi]preghiera.

{soc}
RIT:
Perché [Do]tu, solo tu, solo Tu sei il mio Maestro
[Fa]e insegnami [Fam]ad amare come hai fatto [Re]Tu con [Do]me
se lo vuoi io lo grido a tutto il mondo che [Fa]Tu sei,
[Fam]l''unico Maestro sei [Do]per me.
{eoc}

[Lam]I miei piedi, [Mi]con i tuoi [Lam]possono fare strade [Mi]nuove,
[Lam]possono correre, [Mi]riposare, [Lam]sentirsi a casa in questo [Mi]modo.
[Do]Possono mettere [Sol]ra[Fa]di[Mi]ci [Lam]e passo passo cammi[Mi]nare.

{soc}
RIT:
Perché [Do]tu, solo tu, solo Tu sei il mio Maestro
[Fa]e insegnami [Fam]ad amare come hai fatto [Re]Tu con [Do]me
se lo vuoi io lo grido a tutto il mondo che [Fa]Tu sei,
[Fam]l''unico Maestro sei [Do]per me.
{eoc}

[Lam]Questi occhi, [Mi]con i tuoi [Lam]potran vedere mera[Mi]viglie,
[Lam]potranno piangere, [Mi]luccicare, [Lam]guardare oltre ogni fron[Mi]tiera.
[Do]Potranno amare [Sol]più [Fa]di [Mi]ieri, [Lam]se sanno insieme a te so[Mi]gnare.

{soc}
RIT:
Perché [Do]tu, solo tu, solo Tu sei il mio Maestro
[Fa]e insegnami [Fam]ad amare come hai fatto [Re]Tu con [Do]me
se lo vuoi io lo grido a tutto il mondo che [Fa]Tu sei,
[Fam]l''unico Maestro sei [Do]per me.
{eoc}

[Lam]Tu sei il corpo, [Mi]noi le membra, [Lam]noi siamo un''unica pre[Mi]ghiera,
[Lam]Tu sei il Maestro, [Mi]noi i testimoni [Lam]della parola del Van[Mi]gelo.
[Do]Possiamo vivere [Sol]fe[Fa]li[Mi]ci, [Lam]in questa chiesa che ri[Mi]nasce.

{soc}
RIT:
Perché [Do]tu, solo tu, solo Tu sei il mio Maestro
[Fa]e insegnami [Fam]ad amare come hai fatto [Re]Tu con [Do]me
se lo vuoi io lo grido a tutto il mondo che [Fa]Tu sei,
[Fam]l''unico Maestro sei [Do]per me.
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'e4912a52-c824-4f8e-b567-27b05591d903'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 18. L'acqua, la terra, il cielo
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'a7140f23-8bc6-4652-9d33-4ef17180e904',
  'L''acqua, la terra, il cielo',
  'Enzo Caruso',
  'scout',
  'Re',
  'Andante vivace (↓ ↓↑ ↑↓↑)',
  108,
  'andante vivace (circa 105–112)',
  '4/4',
  NULL,
  'import_pdf',
  'In Principio - Canti Scout',
  '{comment: intro: Re La Sol Re Sol Mim La}
[Re]In prin[La]ci[Fa#m]pio la [Sim]terra Dio cre[Sol]ò, [La]
[Re]con i [La]mon[Fa#m]ti, i [Sim]prati e i suoi co[Sol]lor, [La]
e il pro[Fa#m]fumo dei suoi [Sim]fior
che ogni [Sol]giorno io ri[La]vedo intorno a [Re]me.
[La]Che [Fa#m]osser[Sim]vo la [Sol]terra respi[La]rar
[Re]attra[Fa#m]ver[Sim]so le [Sol]piante e gli ani[La]mal
che co[Fa#m]noscer io do[Sim]vrò
per sen[Sol]tirmi di essa [La]parte almeno un [Re]po''.

{soc}
RIT:
[Sim]Questa avven[Fa#m]tura, [Sol]queste sco[Re]perte
[Sol]le voglio [Re]viver con [La]te!
[Sim]Guarda che in[Fa#m]canto è [Sol]questa na[Re]tura
e [Sol]noi siamo [Re]parte di [La]lei.
{eoc}

[Re]Le mie [La]ma[Fa#m]ni in [Sim]te immerge[Sol]rò, [La]
[Re]fresca [La]ac[Fa#m]qua che [Sim]mentre scorri [Sol]via [La]
fra i [Fa#m]sassi del rus[Sim]cello
[Sol]una canzone [La]lieve fai sen[Re]tire. [La]
Oh [Fa#m]piog[Sim]gia, che [Sol]scrosci fra le [La]fronde,
[Re]e tu [La]ma[Fa#m]re che [Sim]infrangi le tue [Sol]onde [La]
sugli [Fa#m]scogli e sulla [Sim]spiaggia,
e ori[Sol]zzonti e lunghi [La]viaggi fai sen[Re]tire.

{soc}
RIT:
[Sim]Questa avven[Fa#m]tura, [Sol]queste sco[Re]perte
[Sol]le voglio [Re]viver con [La]te!
[Sim]Guarda che in[Fa#m]canto è [Sol]questa na[Re]tura
e [Sol]noi siamo [Re]parte di [La]lei.
{eoc}

[Re]Guarda il [La]cie[Fa#m]lo [Sim]che colori [Sol]ha, [La]
[Re]è un gab[La]bia[Fa#m]no che in [Sim]alto vola [Sol]già [La]
quasi [Fa#m]per mostrare [Sim]che
ha impa[Sol]rato a viver [La]la sua liber[Re]tà.
[La]Che an[Fa#m]ch''io a [Sim]tutti cante[Sol]rò, [La]
[Re]se nei [La]so[Fa#m]gni far[Sim]falla dive[Sol]rrò [La]
e anche [Fa#m]te invite[Sim]rò
a pun[Sol]tare il tuo [La]dito verso il [Re]Sol.

{soc}
RIT:
[Sim]Questa avven[Fa#m]tura, [Sol]queste sco[Re]perte
[Sol]le voglio [Re]viver con [La]te!
[Sim]Guarda che in[Fa#m]canto è [Sol]questa na[Re]tura
e [Sol]noi siamo [Re]parte di [La]lei.
{eoc}

{comment: outro: Re La Sol Re Sol La Re}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'a7140f23-8bc6-4652-9d33-4ef17180e904'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 19. È più bello insieme
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'f5813b34-1188-449e-876a-5c218290f905',
  'È più bello insieme',
  'Gen Verde',
  'chiesa',
  'Re',
  'Pop ritmico solare (↓ ↓↑ ↑↓↑)',
  112,
  'brillante e festoso (circa 110–115)',
  '4/4',
  NULL,
  'import_pdf',
  'Gen Verde - Canti di comunione',
  '{comment: intro: Sol Re La4 La}
[Re]Dietro ai volti scono[La]sciuti
[Sol]della gente che mi [Re]sfiora,
[Sol]quanta vita, [Re]quante attese di feli[Mim]ci[La]tà,
[Re]quanti attimi vis[La]suti,
[Sol]mondi da scoprire an[Re]cora,
[Sol]splendidi u[Re]niversi accanto a [La4]me. [La]

{soc}
RIT:
[Sol]È più [La]bello insieme,
[Sim]è un dono grande l''altra gente,
[Sol]è più [La]bello in[Sim]sieme.
[Sol]È più [La]bello insieme,
[Sim]è un dono grande l''altra gente,
[Sol]è più [La]bello in[Sol]sieme.
{eoc}

[Re]E raccolgo nel mio [La]cuore
[Sol]la speranza ed il do[Re]lore,
[Sol]il silenzio, [Re]il canto della gente at[Mim]torno a [La]me.
[Re]In quel pianto, in quel sor[La]riso
[Sol]è il mio pianto, il mio sor[Re]riso:
[Sol]chi mi vive ac[Re]canto è un altro [La4]me. [La]

{soc}
RIT:
[Sol]È più [La]bello insieme,
[Sim]è un dono grande l''altra gente,
[Sol]è più [La]bello in[Sim]sieme.
[Sol]È più [La]bello insieme,
[Sim]è un dono grande l''altra gente,
[Sol]è più [La]bello in[Sol]sieme.
{eoc}

[Re]Fra le case e i gratta[La]celi,
[Sol]fra le antenne, lassù in [Re]alto,
[Sol]così trasparente il [Re]cielo non l''ho visto [Mim]mai. [La]
[Re]E la luce getta [La]veli
[Sol]di colore sull''as[Re]falto
[Sol]ora che can[Re]tate assieme a [La4]me. [La]

{soc}
RIT:
[Sol]È più [La]bello insieme,
[Sim]è un dono grande l''altra gente,
[Sol]è più [La]bello in[Sim]sieme.
[Sol]È più [La]bello insieme,
[Sim]è un dono grande l''altra gente,
[Sol]è più [La]bello in[Sol]sieme.
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'f5813b34-1188-449e-876a-5c218290f905'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 20. Tra boschi e prati
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'b9821d45-2234-45aa-bb67-6d129301a906',
  'Tra boschi e prati',
  'Canto scout',
  'scout',
  'Lam',
  'Marcia da cammino (↓ ↓↑ ↑↓↑)',
  110,
  'andatura da marcia (circa 108–114)',
  '4/4',
  NULL,
  'import_pdf',
  'Canzoniere Scout - TuttoScout',
  '[Lam]Tra boschi e prati [Do]verdi e fiumi
[Sol]con l''acqua e con il [Lam]sole,
col vento pure [Do]con l''aria lieve
[Sol]nella calda estate o [Lam]con la neve.
[Fa]Quanti passi [Do]fatti insieme,
[Sol]allegria di [Lam]una fatica
[Fa]ancor più mera[Do]vigliosa per[Sol]ché...
[Lam]fatta [Sol]con [Lam]te.

[Lam]Un sorso d''acqua [Do]fresca e poi
[Sol]l''orizzonte di nuovo da[Lam]vanti a noi
senza più li[Do]miti ed ore,
[Sol]ci fermeremo col mo[Lam]rir del sole
[Fa]per poi star da[Do]vanti al fuoco
[Sol]in una notte [Lam]con la luna
[Fa]a pregar le stelle [Do]e il vento di... [Sol]
[Lam]portar[Sol]ci la for[Lam]tuna.

[Lam]Lo zaino è fatto, [Do]tutto è pronto,
[Sol]un nuovo giorno è [Lam]sorto già
e con il ritmo [Do]dei nostri passi
[Sol]il nostro tempo mi[Lam]sureremo.
[Fa]Poi di nuovo [Do]sul sentiero,
[Sol]solitario e [Lam]silenzioso,
[Fa]testimone delle [Do]fatiche di [Sol]chi...
[Lam]in [Sol]alto vuole an[Lam]dare.',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'b9821d45-2234-45aa-bb67-6d129301a906'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;

-- 21. Come ti ama Dio
INSERT INTO public.canti (
  id,
  titolo,
  autore,
  categoria,
  tonalita,
  ritmo,
  tempo_bpm,
  bpm_testo,
  misura,
  capotasto,
  origine,
  nota_fonte,
  testo_chordpro,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  'c1945e56-3345-46bb-cc78-7e230412b907',
  'Come ti ama Dio',
  'Canto di preghiera',
  'chiesa',
  'Do',
  'Giro armonico dolce / ballata (↓ ↓↑ ↑↓↑)',
  85,
  'moderato e dolce (circa 80–90)',
  '4/4',
  NULL,
  'import_pdf',
  'Canti Liturgici e di Comunità',
  '[Do]Io vorrei sa[Lam]perti amare [Fa]come [Sol]Dio
[Do]che ti prende per [Lam]mano ma ti [Fa]lascia anche an[Sol]dare.
[Do]Vorrei sa[Lam]perti amare [Fa]senza farti mai do[Sol]mande,
[Do]felice per[Lam]ché esisti e co[Fa]sì io posso [Sol]darti il meglio di [Do]me.

{soc}
RIT:
[Do]Con la [Sol]forza del [Lam]mare, l''eter[Fa]nità dei giorni,
[Do]la [Sol]gioia dei [Lam]voli, la [Fa]pace della sera,
[Do]l''immen[Sol]sità del [Lam]cielo: [Fa]come ti ama [Do]Dio.
{eoc}

[Do]Io vorrei sa[Lam]perti amare [Fa]come ti ama [Sol]Dio
[Do]che ti co[Lam]nosce e ti ac[Fa]cetta come [Sol]sei.
[Do]Tenerti [Lam]fra le mani come [Fa]voli nell''az[Sol]zurro,
[Do]felice per[Lam]ché esisti e co[Fa]sì io posso [Sol]darti il meglio di [Do]me.

{soc}
RIT:
[Do]Con la [Sol]forza del [Lam]mare, l''eter[Fa]nità dei giorni,
[Do]la [Sol]gioia dei [Lam]voli, la [Fa]pace della sera,
[Do]l''immen[Sol]sità del [Lam]cielo: [Fa]come ti ama [Do]Dio.
{eoc}

[Do]Io vorrei sa[Lam]perti amare [Fa]come [Sol]Dio
[Do]che ti fa mi[Lam]gliore con l''[Fa]amore che ti [Sol]dona.
[Do]Seguirti [Lam]fra la gente con la [Fa]gioia che hai [Sol]dentro,
[Do]felice per[Lam]ché esisti e co[Fa]sì io posso [Sol]darti il meglio di [Do]me.

{soc}
RIT:
[Do]Con la [Sol]forza del [Lam]mare, l''eter[Fa]nità dei giorni,
[Do]la [Sol]gioia dei [Lam]voli, la [Fa]pace della sera,
[Do]l''immen[Sol]sità del [Lam]cielo: [Fa]come ti ama [Do]Dio.
{eoc}',
  COALESCE((SELECT created_at FROM public.canti WHERE id = 'c1945e56-3345-46bb-cc78-7e230412b907'), NOW()),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  titolo = EXCLUDED.titolo,
  autore = EXCLUDED.autore,
  categoria = EXCLUDED.categoria,
  tonalita = EXCLUDED.tonalita,
  ritmo = EXCLUDED.ritmo,
  tempo_bpm = EXCLUDED.tempo_bpm,
  bpm_testo = EXCLUDED.bpm_testo,
  misura = EXCLUDED.misura,
  capotasto = EXCLUDED.capotasto,
  origine = EXCLUDED.origine,
  nota_fonte = EXCLUDED.nota_fonte,
  testo_chordpro = EXCLUDED.testo_chordpro,
  updated_at = NOW(),
  deleted_at = NULL;


-- Notifica di cambio epoca per forzare resync pulito su tutti i dispositivi
SELECT public.bump_sync_epoch();
