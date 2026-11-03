// src/features/stampa/StampaView.tsx
// Shell orchestratrice per il Centro Stampa del Vault Scout.
// Tre flussi completamente separati (giochibans | canzoni | odg), senza modalità 'tutti'.
// Ogni flusso gestisce in piena autonomia selezione, configurazione, anteprima e job di stampa.

import { useState, useEffect } from 'preact/hooks';
import '../../styles/print.css';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { StampaGiochiBans } from './StampaGiochiBans';
import { StampaCanzoni } from './StampaCanzoni';
import { StampaOdg } from './StampaOdg';

export type SectionTab = 'giochibans' | 'canzoni' | 'odg';

const STORAGE_ACTIVE_TAB_KEY = 'stampa_active_section_tab';

export function StampaView() {
  useEffect(() => {
    document.body.classList.add('in-stampa-view');
    return () => {
      document.body.classList.remove('in-stampa-view');
    };
  }, []);

  const [activeTab, setActiveTab] = useState<SectionTab>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = window.sessionStorage.getItem(STORAGE_ACTIVE_TAB_KEY);
      if (saved === 'canzoni' || saved === 'giochibans' || saved === 'odg') {
        return saved;
      }
    }
    return 'canzoni';
  });

  const handleTabChange = (tab: SectionTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(STORAGE_ACTIVE_TAB_KEY, tab);
      } catch (_) {}
    }
  };

  return (
    <div className="container stampa-page" style={{ padding: 'var(--space-4) 0' }}>
      {/* Intestazione Principale e Navigazione tra le 3 Stampe */}
      <div className="stampa-main-header no-print" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>
              Centro Stampa
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Scegli il documento da stampare in formato A4 ad alto contrasto per le attività di reparto e clan.
            </p>
          </div>
        </div>

        {/* Selettore a 3 sezioni indipendenti: Canzoniere | Giochi e Bans | OdG */}
        <div style={{ marginTop: 'var(--space-3)', maxWidth: '520px' }}>
          <SegmentedControl
            options={[
              { value: 'canzoni', label: 'Canzoniere' },
              { value: 'giochibans', label: 'Giochi e Bans' },
              { value: 'odg', label: 'ODG, Quaderno ed Eventi' },
            ]}
            value={activeTab}
            onChange={(val) => handleTabChange(val as SectionTab)}
            aria-label="Scegli tipologia di documento da stampare"
          />
        </div>
      </div>

      {/* Render del flusso di stampa selezionato */}
      <div className="stampa-active-workflow-container">
        {activeTab === 'canzoni' && <StampaCanzoni />}
        {activeTab === 'giochibans' && <StampaGiochiBans />}
        {activeTab === 'odg' && <StampaOdg />}
      </div>
    </div>
  );
}
export default StampaView;
