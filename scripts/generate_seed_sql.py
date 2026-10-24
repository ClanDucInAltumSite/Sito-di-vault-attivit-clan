import re
import json

with open('src/data/parsed_songs.ts', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.compile(r'export const ([A-Z0-9_]+_PARSED): Canto = (\{[\s\S]*?\n\};)')
matches = pattern.findall(text)

sql_statements = [
    "-- ==============================================================================",
    "-- SEED CANZONIERE SCOUT: 21 CANTI COMPLETI CON METADATI MUSICALI E CHORDPRO",
    "-- Esegui questa query nell'SQL Editor di Supabase Dashboard (project lpeiyzwccedtqjbficjo)",
    "-- https://supabase.com/dashboard/project/lpeiyzwccedtqjbficjo/sql",
    "-- ==============================================================================\n"
]

def sql_escape(val):
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"

count = 0
for name, body in matches:
    clean_body = body.rstrip(';')
    try:
        canto = json.loads(clean_body)
        count += 1
        cid = canto['id']
        titolo = canto['titolo']
        autore = canto.get('autore')
        categoria = canto.get('categoria')
        tonalita = canto.get('tonalita')
        ritmo = canto.get('ritmo')
        tempo_bpm = canto.get('tempo_bpm')
        bpm_testo = canto.get('bpm_testo')
        misura = canto.get('misura')
        capotasto = canto.get('capotasto')
        origine = canto.get('origine', 'import_pdf')
        nota_fonte = canto.get('nota_fonte')
        testo_chordpro = canto['testo_chordpro']
        created_at = canto.get('created_at', '2026-10-24T11:00:00.000Z')
        updated_at = "NOW()"

        stmt = f"""-- {count}. {titolo}
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
  {sql_escape(cid)},
  {sql_escape(titolo)},
  {sql_escape(autore)},
  {sql_escape(categoria)},
  {sql_escape(tonalita)},
  {sql_escape(ritmo)},
  {sql_escape(tempo_bpm)},
  {sql_escape(bpm_testo)},
  {sql_escape(misura)},
  {sql_escape(capotasto)},
  {sql_escape(origine)},
  {sql_escape(nota_fonte)},
  {sql_escape(testo_chordpro)},
  COALESCE((SELECT created_at FROM public.canti WHERE id = {sql_escape(cid)}), NOW()),
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
"""
        sql_statements.append(stmt)
    except Exception as e:
        print(f"Errore su {name}: {e}")

# Incrementa l'epoca di sincronizzazione per notificare istantaneamente tutti i client
sql_statements.append("""
-- Notifica di cambio epoca per forzare resync pulito su tutti i dispositivi
SELECT public.bump_sync_epoch();
""")

with open('supabase/seed_21_canti.sql', 'w', encoding='utf-8') as out:
    out.write('\n'.join(sql_statements))

print(f"Generato con successo supabase/seed_21_canti.sql con {count} canti.")
