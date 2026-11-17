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
import { getCategoryPillColors } from './quaderno_colors';

export interface QuadernoDocEditorProps {
  pagina: QuadernoPagina;
  isOpen: boolean;
  onClose: (updatedPagina: QuadernoPagina, wasPoppedByBrowser?: boolean) => void;
}

type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';
type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 'sub';
// Helper per recuperare la variabile CSS del colore
function getColorVar(color: string): string {
  switch (color) {
    case 'purple': return 'var(--color-quaderno)';
    case 'blue': return 'var(--color-canti)';
    case 'cyan': return 'var(--color-doc-cyan)';
    case 'green': return 'var(--color-calendario)';
    case 'lime': return 'var(--color-doc-lime)';
    case 'amber': return 'var(--color-giochi)';
    case 'red': return 'var(--color-bans)';
    case 'pink': return 'var(--color-doc-pink)';
    case 'brown': return 'var(--color-doc-brown)';
    case 'navy': return 'var(--color-doc-navy)';
    case 'gray': return 'var(--color-doc-gray)';
    default: return 'inherit';
  }
}

// Helper per recuperare la variabile CSS dell'evidenziatore
function getHighlightVar(color: string): string {
  switch (color) {
    case 'green': return 'var(--color-highlight-green)';
    case 'blue': return 'var(--color-highlight-blue)';
    case 'coral': return 'var(--color-highlight-coral)';
    case 'purple': return 'var(--color-highlight-purple)';
    case 'amber': return 'var(--color-highlight-amber)';
    case 'cyan': return 'var(--color-highlight-cyan)';
    case 'gray': return 'var(--color-highlight-gray)';
    default: return 'var(--color-highlight-yellow)';
  }
}

// Ripristina la posizione del cursore in base all'offset dei caratteri
function setCaretAtCharOffset(container: Node, targetOffset: number): Range {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(true);

  let currentOffset = 0;
  const nodeIterator = document.createNodeIterator(container, NodeFilter.SHOW_TEXT);
  let textNode: Text | null = null;
  let lastTextNode: Text | null = null;

  while ((textNode = nodeIterator.nextNode() as Text | null)) {
    lastTextNode = textNode;
    const len = textNode.nodeValue ? textNode.nodeValue.length : 0;
    if (currentOffset + len >= targetOffset) {
      range.setStart(textNode, Math.max(0, targetOffset - currentOffset));
      range.collapse(true);
      return range;
    }
    currentOffset += len;
  }

  if (lastTextNode) {
    range.setStart(lastTextNode, lastTextNode.nodeValue ? lastTextNode.nodeValue.length : 0);
    range.collapse(true);
  }
  return range;
}

// Trova l'antenato più vicino corrispondente a un predicato
function findAncestor(
  node: Node | null,
  stopAt: HTMLElement,
  matcher: (el: HTMLElement) => boolean
): HTMLElement | null {
  let curr: Node | null = node;
  while (curr && curr !== stopAt) {
    if (curr.nodeType === Node.ELEMENT_NODE && matcher(curr as HTMLElement)) {
      return curr as HTMLElement;
    }
    curr = curr.parentNode;
  }
  return null;
}

// Divide un elemento antenato in due parti a un determinato punto limite (boundaryNode, boundaryOffset)
function splitElementAt(
  ancestor: HTMLElement,
  boundaryNode: Node,
  boundaryOffset: number
): { left: HTMLElement | null; right: HTMLElement | null } {
  try {
    if (!ancestor.contains(boundaryNode)) {
      return { left: ancestor, right: null };
    }

    const preRange = document.createRange();
    preRange.setStart(ancestor, 0);
    preRange.setEnd(boundaryNode, boundaryOffset);
    if (preRange.toString().length === 0) {
      return { left: null, right: ancestor };
    }

    const postRange = document.createRange();
    postRange.setStart(boundaryNode, boundaryOffset);
    postRange.setEnd(ancestor, ancestor.childNodes.length);
    if (postRange.toString().length === 0) {
      return { left: ancestor, right: null };
    }

    const splitRange = document.createRange();
    splitRange.setStart(boundaryNode, boundaryOffset);
    splitRange.setEnd(ancestor, ancestor.childNodes.length);
    const rightFrag = splitRange.extractContents();

    const rightEl = ancestor.cloneNode(false) as HTMLElement;
    rightEl.appendChild(rightFrag);
    ancestor.after(rightEl);

    return { left: ancestor, right: rightEl };
  } catch (err) {
    console.warn('Errore splitElementAt:', err);
    return { left: ancestor, right: null };
  }
}

// Espande un cursore collassato ai confini della parola se il cursore è adiacente o interno ad essa
function tryExpandToWord(range: Range): Range | null {
  if (!range.collapsed) return null;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent || '';
  const offset = range.startOffset;

  const isCharBeforeWord = offset > 0 && /\S/.test(text[offset - 1] ?? '');
  const isCharAfterWord = offset < text.length && /\S/.test(text[offset] ?? '');

  if (!isCharBeforeWord && !isCharAfterWord) {
    return null;
  }

  let start = offset;
  while (start > 0 && /\S/.test(text[start - 1] ?? '')) {
    start--;
  }

  let end = offset;
  while (end < text.length && /\S/.test(text[end] ?? '')) {
    end++;
  }

  if (start < end) {
    const wordRange = document.createRange();
    wordRange.setStart(node, start);
    wordRange.setEnd(node, end);
    return wordRange;
  }

  return null;
}

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
  const isPoppedByBrowserRef = useRef<boolean>(false);
  const inFlightPromiseRef = useRef<Promise<QuadernoPagina> | null>(null);
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
      const nativeUndo = document.queryCommandEnabled('undo');
      const nativeRedo = document.queryCommandEnabled('redo');
      setCanUndo(nativeUndo || undoStackRef.current.length > 1);
      setCanRedo(nativeRedo || redoStackRef.current.length > 0);
    } catch {
      setCanUndo(undoStackRef.current.length > 1);
      setCanRedo(redoStackRef.current.length > 0);
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
        } else if (el.className) {
          const m = el.className.match(/doc-color-([a-z]+)/);
          if (m && m[1]) foundColor = m[1];
        }

        if (el.dataset.highlight) {
          foundHighlight = el.dataset.highlight;
        } else if (el.className) {
          const m = el.className.match(/doc-highlight-([a-z]+)/);
          if (m && m[1]) foundHighlight = m[1];
          else if (tag === 'MARK') foundHighlight = 'yellow';
        } else if (tag === 'MARK') {
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

  // Salvataggio effettivo con lock anti-concorrenza
  const doSave = useCallback(
    async (titleToSave: string, catToSave: QuadernoCategoria, dateToSave: string, markdownContent: string): Promise<QuadernoPagina | null> => {
      const cleanTitle = titleToSave.trim();
      if (!cleanTitle || !dateToSave) return null;

      if (inFlightPromiseRef.current) {
        try {
          await inFlightPromiseRef.current;
        } catch {}
      }

      setSaveStatus('saving');
      const savePromise = saveQuadernoPagina({
        id: pagina.id,
        titolo: cleanTitle,
        categoria: catToSave,
        data: dateToSave,
        contenuto: markdownContent,
        evento_id: pagina.evento_id,
      });
      inFlightPromiseRef.current = savePromise;

      try {
        const saved = await savePromise;
        lastSavedPaginaRef.current = saved;
        setSaveStatus('saved');
        setErrorMessage(null);
        return saved;
      } catch (err: any) {
        console.warn('Errore autosave quaderno:', err);
        setSaveStatus('error');
        setErrorMessage(err.message || 'Impossibile salvare la bozza.');
        return null;
      } finally {
        if (inFlightPromiseRef.current === savePromise) {
          inFlightPromiseRef.current = null;
        }
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
        let nativeUndo = false;
        try {
          nativeUndo = document.queryCommandEnabled('undo');
        } catch {}
        setCanUndo(nativeUndo || stack.length > 1);
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
    if (!editorRef.current.childNodes.length || (editorRef.current.childNodes.length === 1 && editorRef.current.firstChild?.nodeName === 'BR')) {
      const p = document.createElement('p');
      p.className = 'doc-p';
      p.appendChild(document.createElement('br'));
      editorRef.current.replaceChildren(p);
    }
    const hasMediaOrDivider = !!editorRef.current.querySelector('img, hr, figure, table');
    const hasText = !!editorRef.current.textContent?.trim();
    const isDocEmpty = !hasText && !hasMediaOrDivider;
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

  // Ripristina l'ultimo stato (Undo - pulsante toolbar o fallback)
  const handleUndo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const currentMd = domToMarkdown(editor);
    const stack = undoStackRef.current;
    if (stack.length === 0 || (stack.length > 0 && currentMd !== stack[stack.length - 1])) {
      stack.push(currentMd);
    }

    if (stack.length <= 1) return;

    let activeBlockIndex = 0;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      let b: Node | null = sel.getRangeAt(0).startContainer;
      while (b && b.parentNode !== editor) {
        b = b.parentNode;
      }
      if (b && b.parentNode === editor) {
        activeBlockIndex = Array.from(editor.children).indexOf(b as HTMLElement);
      }
    }

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
      try {
        const validIndex = Math.max(0, Math.min(activeBlockIndex, editor.children.length - 1));
        const targetBlock = (editor.children[validIndex] as HTMLElement) || editor;
        editor.focus();
        const newRange = document.createRange();
        newRange.selectNodeContents(targetBlock);
        newRange.collapse(false);
        const s = window.getSelection();
        if (s) {
          s.removeAllRanges();
          s.addRange(newRange);
          savedRangeRef.current = newRange.cloneRange();
        }
      } catch {}

      setCanUndo(stack.length > 1);
      setCanRedo(redoStackRef.current.length > 0);
      scheduleAutoSave(titolo, categoria, data, targetMd);
      updateActiveToolbarState();
    } finally {
      isHistoryNavigatingRef.current = false;
    }
  }, [titolo, categoria, data, scheduleAutoSave, updateActiveToolbarState]);

  // Ripete lo stato annullato (Redo - pulsante toolbar o fallback)
  const handleRedo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (redoStackRef.current.length === 0) return;

    let activeBlockIndex = 0;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      let b: Node | null = sel.getRangeAt(0).startContainer;
      while (b && b.parentNode !== editor) {
        b = b.parentNode;
      }
      if (b && b.parentNode === editor) {
        activeBlockIndex = Array.from(editor.children).indexOf(b as HTMLElement);
      }
    }

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
      try {
        const validIndex = Math.max(0, Math.min(activeBlockIndex, editor.children.length - 1));
        const targetBlock = (editor.children[validIndex] as HTMLElement) || editor;
        editor.focus();
        const newRange = document.createRange();
        newRange.selectNodeContents(targetBlock);
        newRange.collapse(false);
        const s = window.getSelection();
        if (s) {
          s.removeAllRanges();
          s.addRange(newRange);
          savedRangeRef.current = newRange.cloneRange();
        }
      } catch {}

      setCanUndo(undoStackRef.current.length > 1);
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
    isPoppedByBrowserRef.current = false;

    if (window.history.state?.quadernoReadingOpen) {
      window.history.replaceState({ quadernoEditorOpen: true, paginaId: pagina.id }, '');
    } else if (!window.history.state?.quadernoEditorOpen) {
      window.history.pushState({ quadernoEditorOpen: true, paginaId: pagina.id }, '');
    }

    const handlePopState = () => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      isPoppedByBrowserRef.current = true;
      handleDone(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!isPoppedByBrowserRef.current && window.history.state?.quadernoEditorOpen) {
        window.history.replaceState(null, '');
      }
    };
  }, [isOpen, pagina.id]);



  // Helper atomico e senza annidamento per applicare o rimuovere stili inline (colori, evidenziatori, dimensioni)
  const applyInlineStyleToRange = useCallback(
    (
      matcher: (el: HTMLElement) => boolean,
      createWrapper: ((val: string) => HTMLElement) | null,
      value: string | null
    ) => {
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

      // Se il cursore è collassato (nessun testo selezionato)
      if (range.collapsed) {
        const expandedRange = tryExpandToWord(range);
        if (expandedRange) {
          range = expandedRange;
        } else {
          // Cursore su spazio bianco o riga vuota
          if (!createWrapper || value === 'default' || value === 'clear') {
            const enclosing = findAncestor(range.startContainer, editor, matcher);
            if (enclosing) {
              const newRange = document.createRange();
              newRange.setStartAfter(enclosing);
              newRange.collapse(true);
              editor.focus();
              if (sel) {
                sel.removeAllRanges();
                sel.addRange(newRange);
              }
              savedRangeRef.current = newRange.cloneRange();
            }
            return;
          }

          const enclosing = findAncestor(range.startContainer, editor, matcher);
          if (enclosing) {
            splitElementAt(enclosing, range.startContainer, range.startOffset);
          }

          const wrapper = createWrapper(value!);
          const textNode = document.createTextNode('\u200B');
          wrapper.appendChild(textNode);
          range.insertNode(wrapper);

          const newRange = document.createRange();
          newRange.setStart(textNode, 1);
          newRange.collapse(true);
          editor.focus();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
          savedRangeRef.current = newRange.cloneRange();

          handleContentChanged();
          pushHistorySnapshot(true);
          return;
        }
      }

      // Range NON collassato (testo selezionato)
      const startAncestor = findAncestor(range.startContainer, editor, matcher);
      const endAncestor = findAncestor(range.endContainer, editor, matcher);

      let effectiveStartNode: Node = range.startContainer;
      let effectiveStartOffset: number = range.startOffset;
      let effectiveEndNode: Node = range.endContainer;
      let effectiveEndOffset: number = range.endOffset;

      if (startAncestor && endAncestor && startAncestor === endAncestor) {
        // Entrambi i confini sono all'interno dello stesso elemento antenato
        const { left } = splitElementAt(startAncestor, range.endContainer, range.endOffset);
        if (left) {
          const { right: rightStart } = splitElementAt(left, range.startContainer, range.startOffset);
          if (rightStart) {
            effectiveStartNode = rightStart;
            effectiveStartOffset = 0;
            effectiveEndNode = rightStart;
            effectiveEndOffset = rightStart.childNodes.length;
          } else {
            effectiveStartNode = left;
            effectiveStartOffset = 0;
            effectiveEndNode = left;
            effectiveEndOffset = left.childNodes.length;
          }
        }
      } else {
        if (endAncestor) {
          const { left: leftEnd } = splitElementAt(endAncestor, range.endContainer, range.endOffset);
          if (leftEnd) {
            effectiveEndNode = leftEnd;
            effectiveEndOffset = leftEnd.childNodes.length;
          }
        }
        if (startAncestor) {
          const { right: rightStart } = splitElementAt(startAncestor, range.startContainer, range.startOffset);
          if (rightStart) {
            effectiveStartNode = rightStart;
            effectiveStartOffset = 0;
          }
        }
      }

      const effectiveRange = document.createRange();
      try {
        effectiveRange.setStart(effectiveStartNode, effectiveStartOffset);
        effectiveRange.setEnd(effectiveEndNode, effectiveEndOffset);
      } catch {
        effectiveRange.setStart(range.startContainer, range.startOffset);
        effectiveRange.setEnd(range.endContainer, range.endOffset);
      }

      const frag = effectiveRange.extractContents();

      // Rimuovi TUTTI gli involucri preesistenti che corrispondono a matcher dentro il frammento
      const allMatching = Array.from(frag.querySelectorAll('*')).filter((el) => matcher(el as HTMLElement));
      allMatching.forEach((el) => {
        el.replaceWith(...Array.from(el.childNodes));
      });

      if (createWrapper && value && value !== 'default' && value !== 'clear') {
        const wrapper = createWrapper(value);
        wrapper.appendChild(frag);
        effectiveRange.insertNode(wrapper);

        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        editor.focus();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
        savedRangeRef.current = newRange.cloneRange();
      } else {
        const firstChild = frag.firstChild;
        const lastChild = frag.lastChild;
        effectiveRange.insertNode(frag);

        const newRange = document.createRange();
        if (firstChild && lastChild) {
          newRange.setStartBefore(firstChild);
          newRange.setEndAfter(lastChild);
        } else {
          newRange.setStart(effectiveRange.startContainer, effectiveRange.startOffset);
          newRange.collapse(true);
        }
        editor.focus();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
        savedRangeRef.current = newRange.cloneRange();
      }

      handleContentChanged();
      pushHistorySnapshot(true);
    },
    [handleContentChanged, pushHistorySnapshot]
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
          left: Math.max(8, Math.min(rect.left - 20, window.innerWidth - 245)),
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
          if (['P', 'H1', 'H2', 'H3', 'H4', 'DIV', 'BLOCKQUOTE', 'LI'].includes(tag)) {
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
      let lastCharOffset = 0;

      for (const block of affectedBlocks) {
        // Calcola l'offset relativo del cursore prima della sostituzione
        try {
          const preRange = document.createRange();
          preRange.setStart(block, 0);
          const maxEndOffset = range.startContainer.nodeType === Node.TEXT_NODE
            ? Math.min(range.startOffset, range.startContainer.nodeValue?.length ?? 0)
            : Math.min(range.startOffset, range.startContainer.childNodes.length);
          preRange.setEnd(range.startContainer, maxEndOffset);
          lastCharOffset = preRange.toString().length;
        } catch {
          lastCharOffset = 0;
        }

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

        // Se il blocco era un elemento di una lista (LI), estrailo pulitamente dividendo la lista
        if (block.tagName.toUpperCase() === 'LI') {
          const parentList = block.parentElement; // UL o OL
          if (parentList && parentList.parentNode) {
            const subsequentLis: Element[] = [];
            let next = block.nextElementSibling;
            while (next) {
              subsequentLis.push(next);
              next = next.nextElementSibling;
            }

            if (subsequentLis.length > 0) {
              const nextList = parentList.cloneNode(false) as HTMLElement;
              for (const sli of subsequentLis) {
                nextList.appendChild(sli);
              }
              parentList.after(nextList);
            }

            parentList.after(newEl);
            block.remove();

            if (!parentList.children.length) {
              parentList.remove();
            }
          } else {
            block.replaceWith(newEl);
          }
        } else {
          block.replaceWith(newEl);
        }

        lastReplaced = newEl;
      }

      if (lastReplaced) {
        editor.focus();
        const restoredRange = setCaretAtCharOffset(lastReplaced, lastCharOffset);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(restoredRange);
        }
        savedRangeRef.current = restoredRange.cloneRange();
      }
    } else {
      const newEl = document.createElement(targetTag);
      newEl.className = targetClass;
      if (isSub) newEl.dataset.role = 'subtitle';
      newEl.appendChild(document.createElement('br'));
      editor.appendChild(newEl);

      editor.focus();
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
    pushHistorySnapshot(true);
  };

  // 3. Stepper Dimensione Testo
  const changeFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(36, activeFontSize + delta));
    setActiveFontSize(newSize);

    const isSizeMatcher = (el: HTMLElement) =>
      el.classList.contains('doc-size-span') || !!el.dataset.size || !!el.style.fontSize;

    const createSizeWrapper = (sz: string) => {
      const span = document.createElement('span');
      span.className = 'doc-size-span';
      span.dataset.size = sz;
      span.style.fontSize = `${sz}px`;
      return span;
    };

    applyInlineStyleToRange(
      isSizeMatcher,
      createSizeWrapper,
      String(newSize)
    );
  };

  // 4. Evidenziatore Pastello
  const applyHighlight = (color: 'yellow' | 'green' | 'blue' | 'coral' | 'purple' | 'amber' | 'cyan' | 'gray' | 'clear') => {
    closeAllMenus();
    if (color !== 'clear') {
      setActiveHighlight(color);
    }

    const isHighlightMatcher = (el: HTMLElement) =>
      el.tagName === 'MARK' || el.classList.contains('doc-highlight') || !!el.dataset.highlight;

    const createHighlightWrapper = (c: string) => {
      const mark = document.createElement('mark');
      mark.className = `doc-highlight doc-highlight-${c}`;
      mark.dataset.highlight = c;
      return mark;
    };

    applyInlineStyleToRange(
      isHighlightMatcher,
      color === 'clear' ? null : createHighlightWrapper,
      color
    );
  };

  // 5. Colore Testo Scout
  const applyTextColor = (color: 'default' | 'purple' | 'blue' | 'cyan' | 'green' | 'lime' | 'amber' | 'red' | 'pink' | 'brown' | 'navy' | 'gray') => {
    closeAllMenus();
    setActiveColor(color);

    const isColorMatcher = (el: HTMLElement) =>
      el.dataset.color !== undefined || /doc-color-([a-z]+)/.test(el.className);

    const createColorWrapper = (c: string) => {
      const span = document.createElement('span');
      span.className = `doc-color-${c}`;
      span.dataset.color = c;
      span.style.color = getColorVar(c);
      return span;
    };

    applyInlineStyleToRange(
      isColorMatcher,
      color === 'default' ? null : createColorWrapper,
      color
    );
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
    pushHistorySnapshot(true);
  };

  // 6b. Blocco citazione con focus preservato
  const toggleBlockquote = () => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelection();
    editor.focus();
    const tag = isBlockquote ? 'p' : 'blockquote';
    try {
      document.execCommand('formatBlock', false, `<${tag}>`);
    } catch {
      document.execCommand('formatBlock', false, tag);
    }
    setIsBlockquote(!isBlockquote);
    handleContentChanged();
    pushHistorySnapshot(true);
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
    pushHistorySnapshot(true);
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

  // 9. Scorciatoie da tastiera e formattazione istantanea (Ctrl+Z, Ctrl+Y, Ctrl+B, Ctrl+I, Ctrl+U, Invio nei titoli)
  const handleKeyDown = (e: KeyboardEvent) => {
    // Gestione Invio (Enter) all'interno dei titoli per evitare che la riga successiva resti un titolo
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          let headingBlock: HTMLElement | null = null;
          let curr: Node | null = range.commonAncestorContainer;
          while (curr && curr !== editorRef.current) {
            if (curr.nodeType === Node.ELEMENT_NODE) {
              const el = curr as HTMLElement;
              const tag = el.tagName.toUpperCase();
              if (['H1', 'H2', 'H3', 'H4'].includes(tag) || el.classList.contains('doc-subtitle') || el.dataset.role === 'subtitle') {
                headingBlock = el;
                break;
              }
            }
            curr = curr.parentNode;
          }

          if (headingBlock) {
            // Se il titolo è completamente vuoto, convertilo in un paragrafo normale
            if (!headingBlock.textContent?.trim()) {
              e.preventDefault();
              const p = document.createElement('p');
              p.className = 'doc-p';
              p.appendChild(document.createElement('br'));
              headingBlock.replaceWith(p);
              const newRange = document.createRange();
              newRange.setStart(p, 0);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
              savedRangeRef.current = newRange.cloneRange();
              setActiveHeading(0);
              handleContentChanged();
              pushHistorySnapshot(true);
              return;
            }

            // Se il cursore è all'inizio (offset 0), inserisci un paragrafo normale prima del titolo
            const rangeToStart = document.createRange();
            rangeToStart.setStart(headingBlock, 0);
            rangeToStart.setEnd(range.startContainer, range.startOffset);
            if (!rangeToStart.toString()) {
              e.preventDefault();
              const p = document.createElement('p');
              p.className = 'doc-p';
              p.appendChild(document.createElement('br'));
              headingBlock.before(p);
              handleContentChanged();
              pushHistorySnapshot(true);
              return;
            }

            // Cursore alla fine o nel mezzo: estrai la parte successiva e inseriscila in un paragrafo normale
            e.preventDefault();
            const splitRange = document.createRange();
            splitRange.setStart(range.startContainer, range.startOffset);
            splitRange.setEnd(headingBlock, headingBlock.childNodes.length);
            const frag = splitRange.extractContents();

            if (!headingBlock.childNodes.length) {
              headingBlock.appendChild(document.createElement('br'));
            }

            const p = document.createElement('p');
            p.className = 'doc-p';
            if (frag.childNodes.length > 0 && frag.textContent?.trim()) {
              p.appendChild(frag);
            } else {
              p.appendChild(document.createElement('br'));
            }
            headingBlock.after(p);

            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            savedRangeRef.current = newRange.cloneRange();
            setActiveHeading(0);
            handleContentChanged();
            pushHistorySnapshot(true);
            return;
          }
        }
      }
    }

    // Gestione Backspace all'inizio di un titolo per convertirlo in paragrafo normale
    if (e.key === 'Backspace' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0);
        if (range.collapsed && editorRef.current.contains(range.commonAncestorContainer)) {
          let headingBlock: HTMLElement | null = null;
          let curr: Node | null = range.commonAncestorContainer;
          while (curr && curr !== editorRef.current) {
            if (curr.nodeType === Node.ELEMENT_NODE) {
              const el = curr as HTMLElement;
              const tag = el.tagName.toUpperCase();
              if (['H1', 'H2', 'H3', 'H4'].includes(tag) || el.classList.contains('doc-subtitle') || el.dataset.role === 'subtitle') {
                headingBlock = el;
                break;
              }
            }
            curr = curr.parentNode;
          }

          if (headingBlock) {
            const rangeToStart = document.createRange();
            rangeToStart.setStart(headingBlock, 0);
            rangeToStart.setEnd(range.startContainer, range.startOffset);
            if (!rangeToStart.toString()) {
              e.preventDefault();
              const p = document.createElement('p');
              p.className = 'doc-p';
              while (headingBlock.firstChild) {
                p.appendChild(headingBlock.firstChild);
              }
              if (!p.childNodes.length || (p.childNodes.length === 1 && p.firstChild?.nodeName === 'BR')) {
                p.replaceChildren(document.createElement('br'));
              }
              headingBlock.replaceWith(p);
              const newRange = document.createRange();
              newRange.setStart(p, 0);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
              savedRangeRef.current = newRange.cloneRange();
              setActiveHeading(0);
              handleContentChanged();
              pushHistorySnapshot(true);
              return;
            }
          }
        }
      }
    }

    // Gestione Invio in una citazione vuota per uscire dal blocco
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0);
        let blockquote: HTMLElement | null = null;
        let curr: Node | null = range.commonAncestorContainer;
        while (curr && curr !== editorRef.current) {
          if (curr.nodeType === Node.ELEMENT_NODE && (curr as HTMLElement).tagName.toUpperCase() === 'BLOCKQUOTE') {
            blockquote = curr as HTMLElement;
            break;
          }
          curr = curr.parentNode;
        }

        if (blockquote && (!blockquote.textContent?.trim())) {
          e.preventDefault();
          const p = document.createElement('p');
          p.className = 'doc-p';
          p.appendChild(document.createElement('br'));
          blockquote.replaceWith(p);
          const newRange = document.createRange();
          newRange.setStart(p, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          savedRangeRef.current = newRange.cloneRange();
          setIsBlockquote(false);
          handleContentChanged();
          pushHistorySnapshot(true);
          return;
        }
      }
    }

    // Tasto Tab per indentare senza perdere il focus del foglio
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
      handleContentChanged();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleRedo();
        return;
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
  const handleDone = async (wasPoppedByBrowser = false) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const cleanTitle = titolo.trim() || pagina.titolo;
    const currentMarkdown = editorRef.current ? domToMarkdown(editorRef.current) : (pagina.contenuto || '');

    if (inFlightPromiseRef.current) {
      try {
        await inFlightPromiseRef.current;
      } catch {}
    }

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
      if (!wasPoppedByBrowser && window.history.state?.quadernoEditorOpen) {
        window.history.back();
      }
      onClose(saved, wasPoppedByBrowser);
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
          onTouchStart={(e) => {
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
              title="Verde menta pastello"
            />
            <button
              type="button"
              className="doc-chip doc-chip-blue"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('blue')}
              title="Azzurro pastello"
            />
            <button
              type="button"
              className="doc-chip doc-chip-coral"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('coral')}
              title="Rosa corallo pastello"
            />
            <button
              type="button"
              className="doc-chip doc-chip-purple-hl"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('purple')}
              title="Lavanda pastello"
            />
            <button
              type="button"
              className="doc-chip doc-chip-amber-hl"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('amber')}
              title="Pesca pastello"
            />
            <button
              type="button"
              className="doc-chip doc-chip-cyan-hl"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('cyan')}
              title="Turchese pastello"
            />
            <button
              type="button"
              className="doc-chip doc-chip-gray-hl"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight('gray')}
              title="Grigio perla pastello"
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
          <div className="doc-palette-grid-6">
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
              title="Blu Canti"
            />
            <button
              type="button"
              className="doc-chip doc-chip-cyan"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('cyan')}
              title="Ciano Turchese"
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
              className="doc-chip doc-chip-lime"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('lime')}
              title="Verde Lime"
            />
            <button
              type="button"
              className="doc-chip doc-chip-giochi"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('amber')}
              title="Ambra Giochi"
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
              className="doc-chip doc-chip-pink"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('pink')}
              title="Rosa Fucsia"
            />
            <button
              type="button"
              className="doc-chip doc-chip-brown"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('brown')}
              title="Marrone Terra"
            />
            <button
              type="button"
              className="doc-chip doc-chip-navy"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('navy')}
              title="Blu Notte"
            />
            <button
              type="button"
              className="doc-chip doc-chip-gray"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextColor('gray')}
              title="Grigio Cenere"
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
            onClick={() => handleDone(false)}
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
            onClick={() => handleDone(false)}
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
                  backgroundColor: getHighlightVar(activeHighlight),
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
                  color: getColorVar(activeColor) === 'inherit' ? 'var(--color-text)' : getColorVar(activeColor),
                }}
              >
                A
              </span>
              <span
                className="doc-color-bar"
                style={{
                  backgroundColor: getColorVar(activeColor) === 'inherit' ? 'var(--color-text)' : getColorVar(activeColor),
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
            onClick={toggleBlockquote}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (editorRef.current) {
                    editorRef.current.focus();
                    const sel = window.getSelection();
                    if (sel && editorRef.current.firstChild) {
                      const range = document.createRange();
                      range.setStart(editorRef.current.firstChild, 0);
                      range.collapse(true);
                      sel.removeAllRanges();
                      sel.addRange(range);
                    }
                  }
                }
              }}
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setTitolo(val);
                const currentMarkdown = editorRef.current ? domToMarkdown(editorRef.current) : (pagina.contenuto || '');
                scheduleAutoSave(val, categoria, data, currentMarkdown);
              }}
            />

            <div className="doc-sheet-meta-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <div className="doc-sheet-cat-picker" style={{ width: '100%' }}>
                <label className="doc-sheet-meta-label" style={{ marginBottom: '6px', display: 'block' }}>Categoria:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {categories.map((c) => {
                    const isSelected = categoria === c.key;
                    const style = getCategoryPillColors(c.key, isSelected);
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          setCategoria(c.key);
                          const currentMarkdown = editorRef.current ? domToMarkdown(editorRef.current) : (pagina.contenuto || '');
                          scheduleAutoSave(titolo, c.key, data, currentMarkdown);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-full, 9999px)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: isSelected ? 700 : 500,
                          border: '1px solid',
                          borderColor: style.border,
                          backgroundColor: style.bg,
                          color: style.color,
                          cursor: 'pointer',
                          transition: 'all var(--duration-fast) var(--ease-ios)',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: style.dotColor,
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        />
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
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
