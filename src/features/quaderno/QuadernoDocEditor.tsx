// src/features/quaderno/QuadernoDocEditor.tsx
// Editor WYSIWYG interattivo stile Documenti Google per il Quaderno di Clan
// Foglio rich-text nativo con rendering visivo immediato, immagini incorporate, colori, font e titoli
// Conforme alle regole di sicurezza e CSP: rendering sicuro via DOM nativo

import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { QuadernoPagina, QuadernoCategoria } from '../../lib/db';
import { saveQuadernoPagina } from '../../lib/admin_actions';
import { I18N } from '../../lib/i18n';
import { Icon } from '../../ui/Icon';
import { compressImageForDocument } from './quaderno_image';
import { renderMarkdownToContainer, domToMarkdown } from './quaderno_dom';

export interface QuadernoDocEditorProps {
  pagina: QuadernoPagina;
  isOpen: boolean;
  onClose: (updatedPagina: QuadernoPagina) => void;
}

type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';
type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 'sub';

export function QuadernoDocEditor({ pagina, isOpen, onClose }: QuadernoDocEditorProps) {
  const [titolo, setTitolo] = useState(pagina.titolo || '');
  const [categoria, setCategoria] = useState<QuadernoCategoria>(pagina.categoria || 'riunione');
  const [data, setData] = useState(pagina.data || '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Popover toolbar
  const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState(false);
  const [isHighlightMenuOpen, setIsHighlightMenuOpen] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const isMenuOpenRef = useRef(false);
  isMenuOpenRef.current = isHeadingMenuOpen || isHighlightMenuOpen || isColorMenuOpen;
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const headingBtnRef = useRef<HTMLButtonElement>(null);
  const highlightBtnRef = useRef<HTMLButtonElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);

  // Stato formattazione attiva sul cursore / selezione
  const [activeHeading, setActiveHeading] = useState<HeadingLevel>(0);
  const [activeFontSize, setActiveFontSize] = useState<number>(16);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);
  const [isListUnordered, setIsListUnordered] = useState(false);
  const [isListOrdered, setIsListOrdered] = useState(false);
  const [isBlockquote, setIsBlockquote] = useState(false);
  const [activeColor, setActiveColor] = useState<string>('default');
  const [activeHighlight, setActiveHighlight] = useState<string>('yellow');

  // Gestione cronologia Undo / Redo (Ctrl+Z / Ctrl+Y)
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isHistoryNavigatingRef = useRef<boolean>(false);
  const typingTimerRef = useRef<any>(null);
  const isClosingRef = useRef<boolean>(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<any>(null);
  const lastSavedPaginaRef = useRef<QuadernoPagina>(pagina);
  const savedRangeRef = useRef<Range | null>(null);

  // Salva la selezione corrente (Range) per ripristinarla dai menu a tendina
  const captureSelection = useCallback(() => {
    if (isMenuOpenRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (!savedRangeRef.current) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  }, []);

  // Ispezione del testo selezionato per sincronizzare i controlli della barra Google Docs
  const updateActiveToolbarState = useCallback(() => {
    captureSelection();
    const editor = editorRef.current;
    if (!editor) return;

    try {
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsUnderline(document.queryCommandState('underline'));
      setIsStrike(document.queryCommandState('strikeThrough'));
      setIsListUnordered(document.queryCommandState('insertUnorderedList'));
      setIsListOrdered(document.queryCommandState('insertOrderedList'));
    } catch {
      // Ignora errori su contesti non editabili
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    let curr: Node | null = range.commonAncestorContainer;
    let foundHeading: HeadingLevel = 0;
    let foundBlockquote = false;
    let foundSize = 16;
    let foundColor = 'default';
    let foundHighlight = 'yellow';

    while (curr && curr !== editor) {
      if (curr.nodeType === Node.ELEMENT_NODE) {
        const el = curr as HTMLElement;
        const tag = el.tagName.toUpperCase();

        if (tag === 'H1') foundHeading = 1;
        else if (tag === 'H2') foundHeading = 2;
        else if (tag === 'H3') foundHeading = 3;
        else if (tag === 'H4') foundHeading = 4;
        else if (el.classList.contains('doc-subtitle') || el.dataset.role === 'subtitle') foundHeading = 'sub';
        else if (tag === 'BLOCKQUOTE') foundBlockquote = true;

        if (el.dataset.size) {
          const s = Number(el.dataset.size);
          if (s) foundSize = s;
        } else if (el.style.fontSize) {
          const m = el.style.fontSize.match(/(\d+)px/);
          if (m && m[1]) foundSize = Number(m[1]);
        }

        if (el.dataset.color) {
          foundColor = el.dataset.color;
        }

        if (el.dataset.highlight) {
          foundHighlight = el.dataset.highlight;
        } else if (el.classList.contains('doc-highlight-green')) {
          foundHighlight = 'green';
        } else if (el.classList.contains('doc-highlight-blue')) {
          foundHighlight = 'blue';
        } else if (el.classList.contains('doc-highlight-coral')) {
          foundHighlight = 'coral';
        } else if (el.classList.contains('doc-highlight-yellow') || tag === 'MARK') {
          foundHighlight = 'yellow';
        }
      }
      curr = curr.parentNode;
    }

    setActiveHeading(foundHeading);
    setIsBlockquote(foundBlockquote);
    setActiveFontSize(foundSize);
    setActiveColor(foundColor);
    setActiveHighlight(foundHighlight);
  }, [captureSelection]);

  // Caricamento iniziale del documento nel foglio contenteditable
  useEffect(() => {
    if (isOpen && editorRef.current) {
      setTitolo(pagina.titolo || '');
      setCategoria(pagina.categoria || 'riunione');
      setData(pagina.data || '');
      setSaveStatus('saved');
      setErrorMessage(null);
      lastSavedPaginaRef.current = pagina;

      // Inizializza stack cronologia Undo/Redo
      undoStackRef.current = [pagina.contenuto || ''];
      redoStackRef.current = [];
      setCanUndo(false);
      setCanRedo(false);

      // Popola il DOM del foglio con il contenuto Markdown renderizzato
      renderMarkdownToContainer(pagina.contenuto || '', editorRef.current);
      if (!editorRef.current.textContent?.trim()) {
        editorRef.current.setAttribute('data-empty', 'true');
      } else {
        editorRef.current.removeAttribute('data-empty');
      }
      try {
        document.execCommand('defaultParagraphSeparator', false, 'p');
      } catch {}
      updateActiveToolbarState();
    }
  }, [isOpen, pagina.id]);

  // Listener per selezione e click
  useEffect(() => {
    if (!isOpen) return;

    const handleSelectionChange = () => {
      if (isMenuOpenRef.current) return;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          updateActiveToolbarState();
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isOpen, updateActiveToolbarState]);

  // Salvataggio effettivo
  const doSave = useCallback(
    async (titleToSave: string, catToSave: QuadernoCategoria, dateToSave: string, markdownContent: string) => {
      const cleanTitle = titleToSave.trim();
      if (!cleanTitle || !dateToSave) return;

      setSaveStatus('saving');
      try {
        const saved = await saveQuadernoPagina({
          id: pagina.id,
          titolo: cleanTitle,
          categoria: catToSave,
          data: dateToSave,
          contenuto: markdownContent,
          evento_id: pagina.evento_id,
        });
        lastSavedPaginaRef.current = saved;
        setSaveStatus('saved');
        setErrorMessage(null);
      } catch (err: any) {
        console.warn('Errore autosave quaderno:', err);
        setSaveStatus('error');
        setErrorMessage(err.message || 'Impossibile salvare la bozza.');
      }
    },
    [pagina.id, pagina.evento_id]
  );

  // Pianificazione salvataggio automatico (debounce 1000ms)
  const scheduleAutoSave = useCallback(
    (newTitle: string, newCat: QuadernoCategoria, newDate: string, newContent: string) => {
      setSaveStatus('dirty');
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        doSave(newTitle, newCat, newDate, newContent);
      }, 1000);
    },
    [doSave]
  );

  // Registra uno snapshot nella cronologia Undo/Redo
  const pushHistorySnapshot = useCallback((forceImmediate = false) => {
    if (isHistoryNavigatingRef.current || !editorRef.current) return;

    const doPush = () => {
      if (!editorRef.current) return;
      const currentMd = domToMarkdown(editorRef.current);
      const stack = undoStackRef.current;
      const last = stack[stack.length - 1];
      if (currentMd !== last) {
        stack.push(currentMd);
        if (stack.length > 60) {
          stack.shift();
        }
        redoStackRef.current = [];
        setCanUndo(stack.length > 1);
        setCanRedo(false);
      }
    };

    if (forceImmediate) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      doPush();
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(doPush, 400);
    }
  }, []);

  // Notifica modifica contenuto dal foglio
  const handleContentChanged = useCallback(() => {
    if (!editorRef.current) return;
    const isDocEmpty = !editorRef.current.textContent?.trim();
    if (isDocEmpty) {
      editorRef.current.setAttribute('data-empty', 'true');
    } else {
      editorRef.current.removeAttribute('data-empty');
    }
    const currentMarkdown = domToMarkdown(editorRef.current);
    scheduleAutoSave(titolo, categoria, data, currentMarkdown);
    pushHistorySnapshot(false);
    updateActiveToolbarState();
  }, [titolo, categoria, data, scheduleAutoSave, pushHistorySnapshot, updateActiveToolbarState]);

  // Ripristina l'ultimo stato (Undo - Ctrl+Z)
  const handleUndo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    const currentMd = domToMarkdown(editor);
    const stack = undoStackRef.current;
    if (currentMd !== stack[stack.length - 1]) {
      stack.push(currentMd);
    }

    if (stack.length <= 1) return;

    isHistoryNavigatingRef.current = true;
    try {
      const popped = stack.pop()!;
      redoStackRef.current.push(popped);
      const targetMd = stack[stack.length - 1] ?? '';
      renderMarkdownToContainer(targetMd, editor);
      if (!editor.textContent?.trim()) {
        editor.setAttribute('data-empty', 'true');
      } else {
        editor.removeAttribute('data-empty');
      }
      setCanUndo(stack.length > 1);
      setCanRedo(true);
      scheduleAutoSave(titolo, categoria, data, targetMd);
      updateActiveToolbarState();
    } finally {
      isHistoryNavigatingRef.current = false;
    }
  }, [titolo, categoria, data, scheduleAutoSave, updateActiveToolbarState]);

  // Ripete lo stato annullato (Redo - Ctrl+Y / Ctrl+Shift+Z)
  const handleRedo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || redoStackRef.current.length === 0) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    isHistoryNavigatingRef.current = true;
    try {
      const nextMd = redoStackRef.current.pop()!;
      undoStackRef.current.push(nextMd);
      renderMarkdownToContainer(nextMd, editor);
      if (!editor.textContent?.trim()) {
        editor.setAttribute('data-empty', 'true');
      } else {
        editor.removeAttribute('data-empty');
      }
      setCanUndo(true);
      setCanRedo(redoStackRef.current.length > 0);
      scheduleAutoSave(titolo, categoria, data, nextMd);
      updateActiveToolbarState();
    } finally {
      isHistoryNavigatingRef.current = false;
    }
  }, [titolo, categoria, data, scheduleAutoSave, updateActiveToolbarState]);

  // Gestione tasto indietro fisico Android / gesture del browser (popstate)
  useEffect(() => {
    if (!isOpen) return;
    isClosingRef.current = false;

    window.history.pushState({ quadernoEditorOpen: true, paginaId: pagina.id }, '');

    const handlePopState = () => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      handleDone();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.quadernoEditorOpen) {
        window.history.replaceState(null, '');
      }
    };
  }, [isOpen, pagina.id]);



  // Helper sicuro per rimuovere involucri di formattazione dal range specificato
  const unwrapRangeElements = useCallback(
    (range: Range, isTarget: (el: HTMLElement) => boolean) => {
      const editor = editorRef.current;
      if (!editor) return;

      // 1. Controlla se gli antenati fino ad editor soddisfano isTarget
      let curr: Node | null = range.commonAncestorContainer;
      while (curr && curr !== editor) {
        if (curr.nodeType === Node.ELEMENT_NODE && isTarget(curr as HTMLElement)) {
          const el = curr as HTMLElement;
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
          break;
        }
        curr = curr.parentNode;
      }

      // 2. Controlla se dentro il range ci sono nodi che soddisfano isTarget
      const frag = range.cloneContents();
      const allEls = Array.from(frag.querySelectorAll('*'));
      const hasMatch = allEls.some((el) => isTarget(el as HTMLElement));

      if (hasMatch) {
        const extracted = range.extractContents();
        extracted.querySelectorAll('*').forEach((el) => {
          if (isTarget(el as HTMLElement)) {
            el.replaceWith(...Array.from(el.childNodes));
          }
        });
        range.insertNode(extracted);
      }
    },
    []
  );

  // Comando nativo execCommand per comandi standard (grassetto, corsivo, elenchi)
  const execCmd = useCallback(
    (command: string, value: string | undefined = undefined) => {
      const editor = editorRef.current;
      if (!editor) return;
      restoreSelection();
      editor.focus();
      try {
        document.execCommand(command, false, value);
      } catch (err) {
        console.warn('Errore esecuzione comando formattazione:', err);
      }
      captureSelection();
      handleContentChanged();
    },
    [restoreSelection, captureSelection, handleContentChanged]
  );

  const closeAllMenus = useCallback(() => {
    setIsHeadingMenuOpen(false);
    setIsHighlightMenuOpen(false);
    setIsColorMenuOpen(false);
    isMenuOpenRef.current = false;
  }, []);

  const toggleHeadingMenu = useCallback(() => {
    if (isHeadingMenuOpen) {
      closeAllMenus();
    } else {
      captureSelection();
      if (headingBtnRef.current) {
        const rect = headingBtnRef.current.getBoundingClientRect();
        setMenuPos({
          top: rect.bottom + 4,
          left: Math.max(8, Math.min(rect.left, window.innerWidth - 180)),
        });
      }
      isMenuOpenRef.current = true;
      setIsHeadingMenuOpen(true);
      setIsHighlightMenuOpen(false);
      setIsColorMenuOpen(false);
    }
  }, [isHeadingMenuOpen, captureSelection, closeAllMenus]);

  const toggleHighlightMenu = useCallback(() => {
    if (isHighlightMenuOpen) {
      closeAllMenus();
    } else {
      captureSelection();
      if (highlightBtnRef.current) {
        const rect = highlightBtnRef.current.getBoundingClientRect();
        setMenuPos({
          top: rect.bottom + 4,
          left: Math.max(8, Math.min(rect.left - 20, window.innerWidth - 200)),
        });
      }
      isMenuOpenRef.current = true;
      setIsHighlightMenuOpen(true);
      setIsHeadingMenuOpen(false);
      setIsColorMenuOpen(false);
    }
  }, [isHighlightMenuOpen, captureSelection, closeAllMenus]);

  const toggleColorMenu = useCallback(() => {
    if (isColorMenuOpen) {
      closeAllMenus();
    } else {
      captureSelection();
      if (colorBtnRef.current) {
        const rect = colorBtnRef.current.getBoundingClientRect();
        setMenuPos({
          top: rect.bottom + 4,
          left: Math.max(8, Math.min(rect.left - 20, window.innerWidth - 200)),
        });
      }
      isMenuOpenRef.current = true;
      setIsColorMenuOpen(true);
      setIsHeadingMenuOpen(false);
      setIsHighlightMenuOpen(false);
    }
  }, [isColorMenuOpen, captureSelection, closeAllMenus]);

  // 1. Stile Paragrafo / Intestazione (H1, H2, H3, H4, Sottotitolo, Normale)
  const applyHeading = (level: HeadingLevel) => {
    closeAllMenus();
    const editor = editorRef.current;
    if (!editor) return;

    let range = savedRangeRef.current;
    const sel = window.getSelection();
    if ((!range || !editor.contains(range.commonAncestorContainer)) && sel && sel.rangeCount > 0) {
      if (editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        range = sel.getRangeAt(0);
      }
    }
    if (!range) {
      editor.focus();
      return;
    }

    // Trova tutti i blocchi da convertire
    const affectedBlocks: HTMLElement[] = [];
    if (editor.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== editor) {
      let curr: Node | null = range.commonAncestorContainer;
      while (curr && curr !== editor) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
          const el = curr as HTMLElement;
          const tag = el.tagName.toUpperCase();
          if (['P', 'H1', 'H2', 'H3', 'H4', 'DIV', 'BLOCKQUOTE'].includes(tag)) {
            affectedBlocks.push(el);
            break;
          }
        }
        curr = curr.parentNode;
      }
    } else {
      Array.from(editor.children).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && sel && sel.containsNode(child, true)) {
          affectedBlocks.push(child as HTMLElement);
        }
      });
    }

    if (affectedBlocks.length === 0) {
      let node: Node | null = range.startContainer;
      while (node && node.parentNode !== editor) {
        node = node.parentNode;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        affectedBlocks.push(node as HTMLElement);
      }
    }

    const isSub = level === 'sub';
    const targetTag = isSub ? 'p' : level === 0 ? 'p' : `h${level}`;
    const targetClass = isSub ? 'doc-subtitle' : level === 0 ? 'doc-p' : `doc-h${level}`;

    if (affectedBlocks.length > 0) {
      let lastReplaced: HTMLElement | null = null;
      for (const block of affectedBlocks) {
        const newEl = document.createElement(targetTag);
        newEl.className = targetClass;
        if (isSub) {
          newEl.dataset.role = 'subtitle';
        }
        while (block.firstChild) {
          newEl.appendChild(block.firstChild);
        }
        if (!newEl.childNodes.length || (newEl.childNodes.length === 1 && newEl.firstChild?.nodeName === 'BR')) {
          newEl.replaceChildren(document.createElement('br'));
        }
        block.replaceWith(newEl);
        lastReplaced = newEl;
      }

      if (lastReplaced) {
        const newRange = document.createRange();
        newRange.selectNodeContents(lastReplaced);
        newRange.collapse(false);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
        savedRangeRef.current = newRange.cloneRange();
      }
    } else {
      const newEl = document.createElement(targetTag);
      newEl.className = targetClass;
      if (isSub) newEl.dataset.role = 'subtitle';
      newEl.appendChild(document.createElement('br'));
      editor.appendChild(newEl);

      const newRange = document.createRange();
      newRange.selectNodeContents(newEl);
      newRange.collapse(false);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      savedRangeRef.current = newRange.cloneRange();
    }

    setActiveHeading(level);
    handleContentChanged();
    editor.focus();
  };

  // 3. Stepper Dimensione Testo
  const changeFontSize = (delta: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    let range = savedRangeRef.current;
    const sel = window.getSelection();
    if ((!range || !editor.contains(range.commonAncestorContainer)) && sel && sel.rangeCount > 0) {
      if (editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        range = sel.getRangeAt(0);
      }
    }
    if (!range) {
      editor.focus();
      return;
    }

    const newSize = Math.max(12, Math.min(36, activeFontSize + delta));
    setActiveFontSize(newSize);

    if (range.collapsed) {
      const span = document.createElement('span');
      span.className = 'doc-size-span';
      span.dataset.size = String(newSize);
      span.style.fontSize = `${newSize}px`;
      const textNode = document.createTextNode('\u200B');
      span.appendChild(textNode);
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(textNode, 1);
      newRange.collapse(true);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      savedRangeRef.current = newRange.cloneRange();
      handleContentChanged();
      editor.focus();
      return;
    }

    // Pulisce size preesistenti nel frammento estratto
    const frag = range.extractContents();
    frag.querySelectorAll('.doc-size-span, [data-size]').forEach((el) => {
      const h = el as HTMLElement;
      delete h.dataset.size;
      h.style.fontSize = '';
      h.classList.remove('doc-size-span');
      if (!h.getAttribute('style') && !h.getAttribute('class') && Object.keys(h.dataset).length === 0) {
        h.replaceWith(...Array.from(h.childNodes));
      }
    });

    const span = document.createElement('span');
    span.className = 'doc-size-span';
    span.dataset.size = String(newSize);
    span.style.fontSize = `${newSize}px`;
    span.appendChild(frag);
    range.insertNode(span);

    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    savedRangeRef.current = newRange.cloneRange();

    handleContentChanged();
    editor.focus();
  };

  // 4. Evidenziatore Pastello
  const applyHighlight = (color: 'yellow' | 'green' | 'blue' | 'coral' | 'clear') => {
    closeAllMenus();
    const editor = editorRef.current;
    if (!editor) return;

    let range = savedRangeRef.current;
    const sel = window.getSelection();
    if ((!range || !editor.contains(range.commonAncestorContainer)) && sel && sel.rangeCount > 0) {
      if (editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        range = sel.getRangeAt(0);
      }
    }
    if (!range) {
      editor.focus();
      return;
    }

    if (color === 'clear') {
      unwrapRangeElements(
        range,
        (el) => el.tagName === 'MARK' || el.classList.contains('doc-highlight') || !!el.dataset.highlight
      );
      setActiveHighlight('yellow');
      handleContentChanged();
      editor.focus();
      return;
    }

    setActiveHighlight(color);

    if (range.collapsed) {
      const mark = document.createElement('mark');
      mark.className = `doc-highlight doc-highlight-${color}`;
      mark.dataset.highlight = color;
      const textNode = document.createTextNode('\u200B');
      mark.appendChild(textNode);
      range.insertNode(mark);
      const newRange = document.createRange();
      newRange.setStart(textNode, 1);
      newRange.collapse(true);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      savedRangeRef.current = newRange.cloneRange();
      handleContentChanged();
      editor.focus();
      return;
    }

    // Pulisce mark preesistenti nel frammento estratto
    const frag = range.extractContents();
    frag.querySelectorAll('mark, [data-highlight], [class*="doc-highlight"]').forEach((el) => {
      const h = el as HTMLElement;
      h.replaceWith(...Array.from(h.childNodes));
    });

    const mark = document.createElement('mark');
    mark.className = `doc-highlight doc-highlight-${color}`;
    mark.dataset.highlight = color;
    mark.appendChild(frag);
    range.insertNode(mark);

    const newRange = document.createRange();
    newRange.selectNodeContents(mark);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    savedRangeRef.current = newRange.cloneRange();

    handleContentChanged();
    editor.focus();
  };

  // 5. Colore Testo Scout
  const applyTextColor = (color: 'default' | 'purple' | 'blue' | 'green' | 'red' | 'amber') => {
    closeAllMenus();
    const editor = editorRef.current;
    if (!editor) return;

    let range = savedRangeRef.current;
    const sel = window.getSelection();
    if ((!range || !editor.contains(range.commonAncestorContainer)) && sel && sel.rangeCount > 0) {
      if (editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        range = sel.getRangeAt(0);
      }
    }
    if (!range) {
      editor.focus();
      return;
    }

    setActiveColor(color);

    if (color === 'default') {
      unwrapRangeElements(
        range,
        (el) => el.dataset.color !== undefined || el.className.includes('doc-color-')
      );
      handleContentChanged();
      editor.focus();
      return;
    }

    let colorVar = 'inherit';
    if (color === 'purple') colorVar = 'var(--color-quaderno)';
    else if (color === 'blue') colorVar = 'var(--color-canti)';
    else if (color === 'green') colorVar = 'var(--color-calendario)';
    else if (color === 'red') colorVar = 'var(--color-bans)';
    else if (color === 'amber') colorVar = 'var(--color-giochi)';

    if (range.collapsed) {
      const span = document.createElement('span');
      span.className = `doc-color-${color}`;
      span.dataset.color = color;
      span.style.color = colorVar;
      span.style.fontWeight = '600';
      const textNode = document.createTextNode('\u200B');
      span.appendChild(textNode);
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(textNode, 1);
      newRange.collapse(true);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      savedRangeRef.current = newRange.cloneRange();
      handleContentChanged();
      editor.focus();
      return;
    }

    // Pulisce color span preesistenti nel frammento estratto
    const frag = range.extractContents();
    frag.querySelectorAll('[data-color], [class*="doc-color-"]').forEach((el) => {
      const h = el as HTMLElement;
      delete h.dataset.color;
      h.style.color = '';
      h.className = h.className.split(' ').filter((c) => !c.startsWith('doc-color-')).join(' ');
      if (!h.getAttribute('style') && !h.getAttribute('class') && Object.keys(h.dataset).length === 0) {
        h.replaceWith(...Array.from(h.childNodes));
      }
    });

    const span = document.createElement('span');
    span.className = `doc-color-${color}`;
    span.dataset.color = color;
    span.style.color = colorVar;
    span.style.fontWeight = '600';
    span.appendChild(frag);
    range.insertNode(span);

    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    savedRangeRef.current = newRange.cloneRange();

    handleContentChanged();
    editor.focus();
  };

  // 6. Separatore Orizzontale a livello di blocco pulito
  const insertDivider = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();

    const hr = document.createElement('hr');
    hr.className = 'doc-divider';

    const p = document.createElement('p');
    p.className = 'doc-p';
    p.appendChild(document.createElement('br'));

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      let block: HTMLElement | null = null;
      let curr: Node | null = range.commonAncestorContainer;
      while (curr && curr !== editor) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
          const el = curr as HTMLElement;
          if (['P', 'H1', 'H2', 'H3', 'H4', 'DIV', 'BLOCKQUOTE'].includes(el.tagName.toUpperCase())) {
            block = el;
            break;
          }
        }
        curr = curr.parentNode;
      }
      if (block) {
        if (block.textContent?.trim() === '') {
          block.replaceWith(hr);
        } else {
          block.after(hr);
        }
        hr.after(p);
      } else {
        editor.appendChild(hr);
        editor.appendChild(p);
      }
    } else {
      editor.appendChild(hr);
      editor.appendChild(p);
    }

    const newRange = document.createRange();
    newRange.setStart(p, 0);
    newRange.collapse(true);
    const s = window.getSelection();
    if (s) {
      s.removeAllRanges();
      s.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
    }
    handleContentChanged();
  };

  // Helper comune per inserimento immagini (da file o da incolla) a livello blocco
  const insertImageFigure = (figure: HTMLElement) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();

    const p = document.createElement('p');
    p.className = 'doc-p';
    p.appendChild(document.createElement('br'));

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      let block: HTMLElement | null = null;
      let curr: Node | null = range.commonAncestorContainer;
      while (curr && curr !== editor) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
          const el = curr as HTMLElement;
          if (['P', 'H1', 'H2', 'H3', 'H4', 'DIV', 'BLOCKQUOTE'].includes(el.tagName.toUpperCase())) {
            block = el;
            break;
          }
        }
        curr = curr.parentNode;
      }
      if (block) {
        if (block.textContent?.trim() === '') {
          block.replaceWith(figure);
        } else {
          block.after(figure);
        }
        figure.after(p);
      } else {
        editor.appendChild(figure);
        editor.appendChild(p);
      }
    } else {
      editor.appendChild(figure);
      editor.appendChild(p);
    }

    const newRange = document.createRange();
    newRange.setStart(p, 0);
    newRange.collapse(true);
    const s = window.getSelection();
    if (s) {
      s.removeAllRanges();
      s.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
    }
    handleContentChanged();
  };

  // 7. Inserisci Immagine da file
  const handleImageSelect = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const { dataUrl, name } = await compressImageForDocument(file, 1280, 0.8);
      const figure = document.createElement('figure');
      figure.className = 'doc-figure';
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = name || 'Immagine allegata';
      img.className = 'doc-image';
      figure.appendChild(img);

      if (name) {
        const cap = document.createElement('figcaption');
        cap.className = 'doc-figcaption';
        cap.textContent = name;
        figure.appendChild(cap);
      }

      insertImageFigure(figure);
    } catch (err: any) {
      alert(err.message || 'Errore durante il caricamento dell\'immagine.');
    } finally {
      setIsUploadingImage(false);
      input.value = '';
    }
  };

  // 8. Incolla immagine direttamente dagli appunti (es. screenshot o file copiato)
  const handlePaste = async (e: ClipboardEvent) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file && file.type.startsWith('image/')) {
        e.preventDefault();
        setIsUploadingImage(true);
        try {
          const { dataUrl, name } = await compressImageForDocument(file, 1280, 0.8);
          const figure = document.createElement('figure');
          figure.className = 'doc-figure';
          const img = document.createElement('img');
          img.src = dataUrl;
          img.alt = name || 'Immagine incollata';
          img.className = 'doc-image';
          figure.appendChild(img);

          insertImageFigure(figure);
        } catch (err: any) {
          alert(err.message || 'Errore durante l\'inserimento dell\'immagine incollata.');
        } finally {
          setIsUploadingImage(false);
        }
      }
    }
  };

  // 9. Scorciatoie da tastiera e formattazione istantanea (Ctrl+Z, Ctrl+Y, Ctrl+B, Ctrl+I, Ctrl+U)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        execCmd('bold');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        execCmd('italic');
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        execCmd('underline');
      }
    }
  };

  // 10. Chiusura e salvataggio immediato
  const handleDone = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    const cleanTitle = titolo.trim() || pagina.titolo;
    const currentMarkdown = editorRef.current ? domToMarkdown(editorRef.current) : (pagina.contenuto || '');

    setSaveStatus('saving');
    try {
      const saved = await saveQuadernoPagina({
        id: pagina.id,
        titolo: cleanTitle,
        categoria,
        data,
        contenuto: currentMarkdown,
        evento_id: pagina.evento_id,
      });
      lastSavedPaginaRef.current = saved;
      setSaveStatus('saved');
      setErrorMessage(null);
      isClosingRef.current = true;
      if (window.history.state?.quadernoEditorOpen) {
        window.history.back();
      }
      onClose(saved);
    } catch (err: any) {
      console.warn('Errore salvataggio finale:', err);
      setSaveStatus('error');
      setErrorMessage(err.message || 'Impossibile salvare la bozza. Verifica la connessione prima di chiudere.');
    }
  };

  if (!isOpen) return null;

  const categories: { key: QuadernoCategoria; label: string }[] = [
    { key: 'riunione', label: I18N.quaderno.categorie.riunione },
    { key: 'punto_strada', label: I18N.quaderno.categorie.punto_strada },
    { key: 'verifica', label: I18N.quaderno.categorie.verifica },
    { key: 'libero', label: I18N.quaderno.categorie.libero },
  ];

  const headingLabels: Record<HeadingLevel, string> = {
    0: I18N.quaderno.editor.normale,
    sub: I18N.quaderno.editor.sottotitolo,
    1: I18N.quaderno.editor.titolo1,
    2: I18N.quaderno.editor.titolo2,
    3: I18N.quaderno.editor.titolo3,
    4: I18N.quaderno.editor.titolo4,
  };

  return (
    <div
      className="doc-editor-container"
      role="dialog"
      aria-modal="true"
      aria-label="Editor documento"
      onClick={closeAllMenus}
    >
      {(isHeadingMenuOpen || isHighlightMenuOpen || isColorMenuOpen) && (
        <div
          className="doc-menu-backdrop"
          onMouseDown={(e) => {
            e.preventDefault();
            closeAllMenus();
          }}
        />
      )}

      {/* DROPDOWN FISSI RENDERIZZATI AL LIVELLO DEL CONTAINER PER EVITARE STACKING CONTEXT TRAPS */}
      {isHeadingMenuOpen && (
        <div
          className="doc-dropdown-menu doc-dropdown-fixed"
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="doc-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => applyHeading(0)}>
            {I18N.quaderno.editor.normale}
          </button>
          <button type="button" className="doc-menu-item doc-menu-h1" onMouseDown={(e) => e.preventDefault()} onClick={() => applyHeading(1)}>
            {I18N.quaderno.editor.titolo1}
          </button>
          <button type="button" className="doc-menu-item doc-menu-sub" onMouseDown={(e) => e.preventDefault()} onClick={() => applyHeading('sub')}>
            {I18N.quaderno.editor.sottotitolo}
          </button>
          <button type="button" className="doc-menu-item doc-menu-h2" onMouseDown={(e) => e.preventDefault()} onClick={() => applyHeading(2)}>
            {I18N.quaderno.editor.titolo2}
          </button>
          <button type="button" className="doc-menu-item doc-menu-h3" onMouseDown={(e) => e.preventDefault()} onClick={() => applyHeading(3)}>
            {I18N.quaderno.editor.titolo3}
          </button>
          <button type="button" className="doc-menu-item doc-menu-h4" onMouseDown={(e) => e.preventDefault()} onClick={() => applyHeading(4)}>
            {I18N.quaderno.editor.titolo4}
          </button>
        </div>
      )}

      {isHighlightMenuOpen && (
        <div
          className="doc-dropdown-menu doc-palette-menu doc-dropdown-fixed"
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="doc-palette-title">Evidenziatore</div>
          <div className="doc-palette-grid">
            <button
              type="button"
              className="doc-chip doc-chip-yellow"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('yellow')}
              title="Giallo pastello"
            />
            <button
              type="button"
              className="doc-chip doc-chip-green"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('green')}
              title="Verde menta"
            />
            <button
              type="button"
              className="doc-chip doc-chip-blue"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('blue')}
              title="Azzurro cielo"
            />
            <button
              type="button"
              className="doc-chip doc-chip-coral"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('coral')}
              title="Rosa corallo"
            />
          </div>
          <button
            type="button"
            className="doc-menu-item"
            style={{ marginTop: '6px', fontSize: 'var(--font-size-xs)' }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyHighlight('clear')}
          >
            Rimuovi evidenziatore
          </button>
        </div>
      )}

      {isColorMenuOpen && (
        <div
          className="doc-dropdown-menu doc-palette-menu doc-dropdown-fixed"
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="doc-palette-title">Colore Testo</div>
          <div className="doc-palette-grid">
            <button
              type="button"
              className="doc-chip doc-chip-ink"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('default')}
              title="Predefinito"
            />
            <button
              type="button"
              className="doc-chip doc-chip-purple"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('purple')}
              title="Viola Clan"
            />
            <button
              type="button"
              className="doc-chip doc-chip-canti"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('blue')}
              title="Azzurro Canti"
            />
            <button
              type="button"
              className="doc-chip doc-chip-calendario"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('green')}
              title="Verde Bosco"
            />
            <button
              type="button"
              className="doc-chip doc-chip-bans"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('red')}
              title="Rosso Bans"
            />
            <button
              type="button"
              className="doc-chip doc-chip-giochi"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('amber')}
              title="Ambra Giochi"
            />
          </div>
        </div>
      )}

      {/* 1. TOP BAR APPLE ELEGANTE DELL'EDITOR */}
      <header className="doc-editor-topbar" onClick={(e) => e.stopPropagation()}>
        <div className="doc-topbar-left">
          <button
            type="button"
            className="doc-icon-btn"
            onClick={handleDone}
            title={I18N.quaderno.editor.chiudi}
            aria-label={I18N.quaderno.editor.chiudi}
          >
            <Icon name="chevron-left" size={22} />
          </button>

          <div className="doc-topbar-info">
            <span className="doc-topbar-title">{titolo.trim() || 'Senza titolo'}</span>
            <div className="doc-topbar-meta">
              <span className={`doc-status-badge doc-status-${saveStatus}`}>
                {saveStatus === 'saved' && (
                  <>
                    <Icon name="check" size={13} />
                    <span>{I18N.quaderno.editor.salvato}</span>
                  </>
                )}
                {saveStatus === 'saving' && (
                  <>
                    <Icon name="refresh" size={13} className="spin-slow" />
                    <span>{I18N.quaderno.editor.salvataggioInCorso}</span>
                  </>
                )}
                {saveStatus === 'dirty' && <span>{I18N.quaderno.editor.modificheNonSalvate}</span>}
                {saveStatus === 'error' && <span>Errore salvataggio</span>}
              </span>
            </div>
          </div>
        </div>

        <div className="doc-topbar-right">
          <button
            type="button"
            className="ios-btn ios-btn-primary ios-btn-sm doc-btn-done"
            onClick={handleDone}
          >
            <Icon name="check" size={16} />
            <span>{I18N.quaderno.editor.fine}</span>
          </button>
        </div>
      </header>

      {/* 2. TOOLBAR VISUALE STILE DOCUMENTI GOOGLE */}
      <div className="doc-editor-toolbar" role="toolbar" aria-label="Strumenti di formattazione" onClick={(e) => e.stopPropagation()}>
        <div className="doc-toolbar-scroll">
          {/* Pulsanti Annulla e Ripristina stile Documenti Google (Ctrl+Z / Ctrl+Y) */}
          <button
            type="button"
            className="doc-toolbar-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleUndo}
            disabled={!canUndo}
            title="Annulla (Ctrl+Z)"
            aria-label="Annulla (Ctrl+Z)"
          >
            <Icon name="undo" size={16} />
          </button>
          <button
            type="button"
            className="doc-toolbar-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleRedo}
            disabled={!canRedo}
            title="Ripristina (Ctrl+Y)"
            aria-label="Ripristina (Ctrl+Y)"
          >
            <Icon name="redo" size={16} />
          </button>

          <div className="doc-toolbar-sep" />

          {/* Selettore Stile Intestazione */}
          <div className="doc-dropdown-wrapper">
            <button
              ref={headingBtnRef}
              type="button"
              className="doc-toolbar-btn doc-dropdown-trigger"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleHeadingMenu}
              title="Stile paragrafo o intestazione"
            >
              <Icon name="type" size={16} />
              <span className="doc-toolbar-label">{headingLabels[activeHeading]}</span>
              <Icon name="chevron-down" size={12} />
            </button>
          </div>

          {/* Stepper Dimensione Testo */}
          <div className="doc-font-size-ctrl">
            <button
              type="button"
              className="doc-toolbar-btn doc-size-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changeFontSize(-1)}
              title="Riduci dimensione testo"
              aria-label="Riduci dimensione testo"
            >
              <Icon name="minus" size={13} />
            </button>
            <span className="doc-size-display tabular-nums">{activeFontSize}</span>
            <button
              type="button"
              className="doc-toolbar-btn doc-size-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changeFontSize(1)}
              title="Aumenta dimensione testo"
              aria-label="Aumenta dimensione testo"
            >
              <Icon name="plus" size={13} />
            </button>
          </div>

          <div className="doc-toolbar-sep" />

          {/* Stili di Carattere: Grassetto, Corsivo, Sottolineato, Barrato */}
          <button
            type="button"
            className={`doc-toolbar-btn ${isBold ? 'doc-toolbar-btn-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd('bold')}
            title={I18N.quaderno.editor.grassetto}
            aria-label={I18N.quaderno.editor.grassetto}
          >
            <Icon name="bold" size={16} />
          </button>
          <button
            type="button"
            className={`doc-toolbar-btn ${isItalic ? 'doc-toolbar-btn-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd('italic')}
            title={I18N.quaderno.editor.corsivo}
            aria-label={I18N.quaderno.editor.corsivo}
          >
            <Icon name="italic" size={16} />
          </button>
          <button
            type="button"
            className={`doc-toolbar-btn ${isUnderline ? 'doc-toolbar-btn-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd('underline')}
            title={I18N.quaderno.editor.sottolineato}
            aria-label={I18N.quaderno.editor.sottolineato}
          >
            <Icon name="underline" size={16} />
          </button>
          <button
            type="button"
            className={`doc-toolbar-btn ${isStrike ? 'doc-toolbar-btn-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd('strikeThrough')}
            title={I18N.quaderno.editor.barrato}
            aria-label={I18N.quaderno.editor.barrato}
          >
            <Icon name="strikethrough" size={16} />
          </button>

          <div className="doc-toolbar-sep" />

          {/* Menu Evidenziatore Pastello */}
          <div className="doc-dropdown-wrapper">
            <button
              ref={highlightBtnRef}
              type="button"
              className="doc-toolbar-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleHighlightMenu}
              title={I18N.quaderno.editor.evidenziatore}
              aria-label={I18N.quaderno.editor.evidenziatore}
            >
              <Icon name="highlighter" size={16} />
              <span
                className="doc-color-bar"
                style={{
                  backgroundColor:
                    activeHighlight === 'green'
                      ? 'var(--color-highlight-green)'
                      : activeHighlight === 'blue'
                      ? 'var(--color-highlight-blue)'
                      : activeHighlight === 'coral'
                      ? 'var(--color-highlight-coral)'
                      : 'var(--color-highlight-yellow)',
                }}
              />
            </button>
          </div>

          {/* Menu Colore Testo Scout */}
          <div className="doc-dropdown-wrapper">
            <button
              ref={colorBtnRef}
              type="button"
              className="doc-toolbar-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleColorMenu}
              title={I18N.quaderno.editor.coloreTesto}
              aria-label={I18N.quaderno.editor.coloreTesto}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '15px',
                  color:
                    activeColor === 'purple'
                      ? 'var(--color-quaderno)'
                      : activeColor === 'blue'
                      ? 'var(--color-canti)'
                      : activeColor === 'green'
                      ? 'var(--color-calendario)'
                      : activeColor === 'red'
                      ? 'var(--color-bans)'
                      : activeColor === 'amber'
                      ? 'var(--color-giochi)'
                      : 'var(--color-text)',
                }}
              >
                A
              </span>
              <span
                className="doc-color-bar"
                style={{
                  backgroundColor:
                    activeColor === 'purple'
                      ? 'var(--color-quaderno)'
                      : activeColor === 'blue'
                      ? 'var(--color-canti)'
                      : activeColor === 'green'
                      ? 'var(--color-calendario)'
                      : activeColor === 'red'
                      ? 'var(--color-bans)'
                      : activeColor === 'amber'
                      ? 'var(--color-giochi)'
                      : 'var(--color-text)',
                }}
              />
            </button>
          </div>

          <div className="doc-toolbar-sep" />

          {/* Inserisci Immagine */}
          <button
            type="button"
            className="doc-toolbar-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
            title={I18N.quaderno.editor.inserisciImmagine}
            aria-label={I18N.quaderno.editor.inserisciImmagine}
          >
            <Icon name="image" size={17} />
            <span className="doc-toolbar-label">
              {isUploadingImage ? I18N.quaderno.editor.caricamentoImmagine : 'Immagine'}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />

          {/* Separatore Orizzontale */}
          <button
            type="button"
            className="doc-toolbar-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertDivider}
            title={I18N.quaderno.editor.separatore}
            aria-label={I18N.quaderno.editor.separatore}
          >
            <Icon name="minus" size={16} />
          </button>

          <div className="doc-toolbar-sep" />

          {/* Elenchi e Citazioni */}
          <button
            type="button"
            className={`doc-toolbar-btn ${isListUnordered ? 'doc-toolbar-btn-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd('insertUnorderedList')}
            title={I18N.quaderno.editor.elencoPuntato}
            aria-label={I18N.quaderno.editor.elencoPuntato}
          >
            <Icon name="list" size={16} />
          </button>
          <button
            type="button"
            className={`doc-toolbar-btn ${isListOrdered ? 'doc-toolbar-btn-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd('insertOrderedList')}
            title={I18N.quaderno.editor.elencoNumerato}
            aria-label={I18N.quaderno.editor.elencoNumerato}
          >
            <Icon name="list-ordered" size={16} />
          </button>
          <button
            type="button"
            className={`doc-toolbar-btn ${isBlockquote ? 'doc-toolbar-btn-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const tag = isBlockquote ? 'p' : 'blockquote';
              try {
                document.execCommand('formatBlock', false, `<${tag}>`);
              } catch {
                document.execCommand('formatBlock', false, tag);
              }
              handleContentChanged();
            }}
            title={I18N.quaderno.editor.citazione}
            aria-label={I18N.quaderno.editor.citazione}
          >
            <Icon name="quote" size={16} />
          </button>
        </div>
      </div>

      {/* 3. WORKSPACE DOCUMENTI GOOGLE CON FOGLIO CENTRATO */}
      <main className="doc-sheet-viewport">
        {errorMessage && (
          <div className="doc-alert-bar" role="alert">
            <span>{errorMessage}</span>
          </div>
        )}

        <div
          className="doc-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header del foglio: Titolo Documento, Categoria e Data */}
          <div className="doc-sheet-header">
            <input
              type="text"
              className="doc-sheet-title-input"
              value={titolo}
              placeholder="Titolo del documento..."
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setTitolo(val);
                const currentMarkdown = editorRef.current ? domToMarkdown(editorRef.current) : (pagina.contenuto || '');
                scheduleAutoSave(val, categoria, data, currentMarkdown);
              }}
            />

            <div className="doc-sheet-meta-row">
              <div className="doc-sheet-cat-picker">
                <label className="doc-sheet-meta-label">Categoria:</label>
                <select
                  className="doc-sheet-select"
                  value={categoria}
                  onChange={(e) => {
                    const val = (e.target as HTMLSelectElement).value as QuadernoCategoria;
                    setCategoria(val);
                    const currentMarkdown = editorRef.current ? domToMarkdown(editorRef.current) : (pagina.contenuto || '');
                    scheduleAutoSave(titolo, val, data, currentMarkdown);
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="doc-sheet-date-picker">
                <label className="doc-sheet-meta-label">Data:</label>
                <input
                  type="date"
                  className="doc-sheet-date-input"
                  value={data}
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    setData(val);
                    const currentMarkdown = editorRef.current ? domToMarkdown(editorRef.current) : (pagina.contenuto || '');
                    scheduleAutoSave(titolo, categoria, val, currentMarkdown);
                  }}
                />
              </div>
            </div>
          </div>

          <hr className="doc-sheet-divider" />

          {/* FOGLIO WYSIWYG VIVO E FORMATTATO IN TEMPO REALE */}
          <div
            ref={editorRef}
            contentEditable={true}
            className="doc-contenteditable doc-rendered"
            data-placeholder="Inizia a scrivere qui il verbale, la verifica o gli appunti... Puoi usare la barra strumenti per formattare testo, intestazioni, colori ed immagini."
            onInput={handleContentChanged}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onMouseUp={updateActiveToolbarState}
            onKeyUp={updateActiveToolbarState}
            onTouchEnd={updateActiveToolbarState}
          />
        </div>
      </main>
    </div>
  );
}
