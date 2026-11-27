import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  FileJson,
  Upload,
  X,
} from 'lucide-react';
import type { RecipeDatabase } from '../types/recipes';
import {
  buildExportJson,
  downloadJsonFile,
  encodeShareCode,
  MAX_IMPORT_BYTES,
  parsePortableData,
  type CustomAcquireItem,
  type PortableData,
} from '../lib/portability';
import { useDialogA11y } from '../hooks/useDialogA11y';

type ModalTab = 'export' | 'import';
type ImportMode = 'merge' | 'replace';

interface ExportImportModalProps {
  open: boolean;
  db: RecipeDatabase;
  pantry: Record<string, number>;
  favorites: string[];
  acquire: Record<string, number>;
  customAcquire: CustomAcquireItem[];
  onClose: () => void;
  onImportData: (incoming: PortableData, mode: ImportMode) => void;
}

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand below
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ExportImportModal({
  open,
  db,
  pantry,
  favorites,
  acquire,
  customAcquire,
  onClose,
  onImportData,
}: ExportImportModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasLocalData =
    Object.values(pantry).some((q) => q > 0) ||
    favorites.length > 0 ||
    Object.values(acquire).some((q) => q > 0) ||
    customAcquire.length > 0;

  const [tab, setTab] = useState<ModalTab>('export');
  const [importText, setImportText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>(() =>
    hasLocalData ? 'merge' : 'replace'
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [downloadedFile, setDownloadedFile] = useState(false);

  useDialogA11y(open, modalRef, onClose);

  const currentData = useMemo<PortableData>(
    () => ({
      pantry,
      favorites,
      acquire,
      customAcquire,
    }),
    [pantry, favorites, acquire, customAcquire]
  );

  const currentSummary = useMemo(() => {
    const pantryItems = Object.values(pantry).filter((q) => q > 0).length;
    const acquireCount =
      Object.values(acquire).filter((q) => q > 0).length + customAcquire.length;
    return {
      pantryItems,
      favoriteCount: favorites.length,
      acquireCount,
    };
  }, [pantry, favorites, acquire, customAcquire]);

  const shareCode = useMemo(
    () => (open ? encodeShareCode(currentData) : ''),
    [open, currentData]
  );

  const parsedImport = useMemo(() => {
    if (!importText.trim()) return null;
    return parsePortableData(importText, db);
  }, [importText, db]);

  if (!open) return null;

  const handleDownloadJson = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const json = buildExportJson(currentData);
    downloadJsonFile(`abiotic-pantry-${dateStamp}.json`, json);
    setDownloadedFile(true);
    window.setTimeout(() => setDownloadedFile(false), 2500);
  };

  const handleCopyCode = async () => {
    setCopyError(null);
    const ok = await copyTextToClipboard(shareCode);
    if (ok) {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2500);
    } else {
      setCopyError(
        'Clipboard access was blocked. Select and copy the ABF1 code manually.'
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportText('');
      setFileError('Selected file exceeds the 250 KB backup limit.');
      return;
    }
    try {
      const content = await readFileAsText(file);
      setImportText(content);
    } catch {
      setImportText('');
      setFileError('Could not read the selected file.');
    }
  };

  const handleApplyImport = () => {
    if (!parsedImport || !parsedImport.ok) return;
    onImportData(parsedImport.data, importMode);
    setImportText('');
    setFileError(null);
    onClose();
  };

  return (
    <div
      className="scrim-enter fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[3px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-import-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="popover-enter flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-md border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--shadow-popover)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden="true"
          className="facility-stripe w-full shrink-0"
        />

        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-3.5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <h2
              id="export-import-title"
              className="flex items-center gap-2 text-base font-semibold tracking-[-0.015em]"
              style={{ color: 'var(--text-primary)' }}
            >
              <ArrowLeftRight
                className="h-4 w-4"
                aria-hidden="true"
                style={{ color: 'var(--accent-chem)' }}
              />
              <span>Export &amp; Import Data</span>
            </h2>
            <p
              className="mt-0.5 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Move your Pantry, Favourites, and To Acquire list across browsers
              or devices.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export and import dialog"
            className="surface-hover touch-target rounded border p-1.5 transition-colors"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div
          className="border-b px-5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-ground)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div
            role="group"
            aria-label="Backup action"
            className="grid grid-cols-2 gap-1 rounded-md border p-0.5"
            style={{
              backgroundColor: 'var(--bg-well)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--inset-well)',
            }}
          >
            <button
              type="button"
              aria-pressed={tab === 'export'}
              onClick={() => setTab('export')}
              className="touch-chip flex items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={{
                backgroundColor:
                  tab === 'export' ? 'var(--control-active-bg)' : 'transparent',
                borderColor:
                  tab === 'export'
                    ? 'var(--control-active-border)'
                    : 'transparent',
                boxShadow:
                  tab === 'export' ? 'var(--specular-top)' : undefined,
                color:
                  tab === 'export'
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
              }}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export</span>
            </button>
            <button
              type="button"
              aria-pressed={tab === 'import'}
              onClick={() => {
                setTab('import');
                setImportMode(hasLocalData ? 'merge' : 'replace');
              }}
              className="touch-chip flex items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={{
                backgroundColor:
                  tab === 'import' ? 'var(--control-active-bg)' : 'transparent',
                borderColor:
                  tab === 'import'
                    ? 'var(--control-active-border)'
                    : 'transparent',
                boxShadow:
                  tab === 'import' ? 'var(--specular-top)' : undefined,
                color:
                  tab === 'import'
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
              }}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Import</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {tab === 'export' ? (
            <>
              {/* Current Data Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded border px-3 py-2"
                  style={{
                    backgroundColor: 'var(--bg-ground)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Pantry
                  </div>
                  <div
                    className="font-readout mt-0.5 text-sm font-semibold"
                    style={{ color: 'var(--accent-ready)' }}
                  >
                    {currentSummary.pantryItems}{' '}
                    {currentSummary.pantryItems === 1 ? 'item' : 'items'}
                  </div>
                </div>
                <div
                  className="rounded border px-3 py-2"
                  style={{
                    backgroundColor: 'var(--bg-ground)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Favourites
                  </div>
                  <div
                    className="font-readout mt-0.5 text-sm font-semibold"
                    style={{ color: 'var(--accent-food)' }}
                  >
                    {currentSummary.favoriteCount}{' '}
                    {currentSummary.favoriteCount === 1 ? 'recipe' : 'recipes'}
                  </div>
                </div>
                <div
                  className="rounded border px-3 py-2"
                  style={{
                    backgroundColor: 'var(--bg-ground)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    To Acquire
                  </div>
                  <div
                    className="font-readout mt-0.5 text-sm font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {currentSummary.acquireCount}{' '}
                    {currentSummary.acquireCount === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </div>

              {/* JSON File Download */}
              <div
                className="space-y-2 rounded border p-3.5"
                style={{
                  backgroundColor: 'var(--bg-ground)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div
                      className="flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <FileJson
                        className="h-4 w-4"
                        aria-hidden="true"
                        style={{ color: 'var(--accent-chem)' }}
                      />
                      <span>JSON Backup File</span>
                    </div>
                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Human-readable backup file for long-term storage.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="surface-hover touch-chip pressable inline-flex shrink-0 items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: downloadedFile
                        ? 'var(--accent-ready-bg)'
                        : 'var(--accent-chem-bg)',
                      borderColor: downloadedFile
                        ? 'var(--accent-ready-border)'
                        : 'var(--accent-chem-border)',
                      color: downloadedFile
                        ? 'var(--accent-ready)'
                        : 'var(--accent-chem)',
                    }}
                  >
                    {downloadedFile ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Downloaded</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Download .json</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Share Code Box */}
              <div
                className="space-y-2 rounded border p-3.5"
                style={{
                  backgroundColor: 'var(--bg-ground)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Portable Share Code
                    </div>
                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Copy and paste across devices or share with co-op teammates.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="surface-hover touch-chip pressable inline-flex shrink-0 items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: copiedCode
                        ? 'var(--accent-ready-bg)'
                        : 'var(--bg-elevated)',
                      borderColor: copiedCode
                        ? 'var(--accent-ready-border)'
                        : 'var(--border-strong)',
                      color: copiedCode
                        ? 'var(--accent-ready)'
                        : 'var(--text-primary)',
                    }}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copy Share Code</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  readOnly
                  value={shareCode}
                  aria-label="Portable share code"
                  rows={3}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-code w-full resize-none rounded border p-2.5 text-xs leading-relaxed"
                  style={{
                    backgroundColor: 'var(--bg-well)',
                    borderColor: 'var(--border-subtle)',
                    boxShadow: 'var(--inset-well)',
                    color: 'var(--text-secondary)',
                  }}
                />
                {copyError && (
                  <p
                    className="text-xs"
                    style={{ color: 'var(--accent-food)' }}
                  >
                    {copyError}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* File Picker */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="import-backup-textarea"
                  className="text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Paste ABF1 share code or JSON backup
                </label>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    aria-label="Upload JSON backup file"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="surface-hover touch-chip pressable inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Choose .json file</span>
                  </button>
                </div>
              </div>

              <textarea
                id="import-backup-textarea"
                value={importText}
                onChange={(e) => {
                  setFileError(null);
                  setImportText(e.target.value);
                }}
                placeholder="Paste an ABF1:... share code or exported .json contents..."
                rows={4}
                className="font-code w-full rounded border p-2.5 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-well)',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--inset-well)',
                  color: 'var(--text-primary)',
                }}
              />

              {(fileError || (parsedImport && !parsedImport.ok)) && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded border border-l-[3px] px-3 py-2 text-xs"
                  style={{
                    backgroundColor: 'var(--accent-hazard-bg)',
                    borderColor: 'var(--accent-hazard-border)',
                    borderLeftColor: 'var(--accent-hazard)',
                    color: 'var(--accent-hazard)',
                  }}
                >
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span style={{ color: 'var(--text-primary)' }}>
                    {fileError || (parsedImport && !parsedImport.ok ? parsedImport.error : '')}
                  </span>
                </div>
              )}

              {!fileError && parsedImport && parsedImport.ok && (
                <div
                  className="space-y-3 rounded border p-3.5"
                  style={{
                    backgroundColor: 'var(--bg-ground)',
                    borderColor: 'var(--accent-ready-border)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: 'var(--accent-ready)' }}
                    >
                      Backup validated — ready to import
                    </span>
                    <span
                      className="font-readout text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {parsedImport.stats.pantryCount} pantry ·{' '}
                      {parsedImport.stats.favoriteCount} favourites ·{' '}
                      {parsedImport.stats.acquireCount} acquire
                    </span>
                  </div>

                  {(parsedImport.stats.ignoredItems > 0 ||
                    parsedImport.stats.ignoredRecipes > 0) && (
                    <p
                      className="text-xs"
                      style={{ color: 'var(--accent-food)' }}
                    >
                      Skipped {parsedImport.stats.ignoredItems} unknown items and{' '}
                      {parsedImport.stats.ignoredRecipes} unknown recipes not in
                      the current database.
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <div
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      How should existing data be handled?
                    </div>
                    <div
                      role="group"
                      aria-label="Import conflict mode"
                      className="grid grid-cols-2 gap-1 rounded-md border p-0.5"
                      style={{
                        backgroundColor: 'var(--bg-well)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <button
                        type="button"
                        aria-pressed={importMode === 'merge'}
                        onClick={() => setImportMode('merge')}
                        className="rounded border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        style={{
                          backgroundColor:
                            importMode === 'merge'
                              ? 'var(--control-active-bg)'
                              : 'transparent',
                          borderColor:
                            importMode === 'merge'
                              ? 'var(--control-active-border)'
                              : 'transparent',
                          color:
                            importMode === 'merge'
                              ? 'var(--text-primary)'
                              : 'var(--text-muted)',
                        }}
                      >
                        Merge with current
                      </button>
                      <button
                        type="button"
                        aria-pressed={importMode === 'replace'}
                        onClick={() => setImportMode('replace')}
                        className="rounded border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        style={{
                          backgroundColor:
                            importMode === 'replace'
                              ? 'var(--control-active-bg)'
                              : 'transparent',
                          borderColor:
                            importMode === 'replace'
                              ? 'var(--control-active-border)'
                              : 'transparent',
                          color:
                            importMode === 'replace'
                              ? 'var(--text-primary)'
                              : 'var(--text-muted)',
                        }}
                      >
                        Replace current
                      </button>
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {importMode === 'merge'
                        ? 'Keeps current items and favourites, adds missing entries, and takes the higher quantity on overlap.'
                        : 'Replaces your current Pantry, Favourites, and To Acquire list while preserving UI preferences.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyImport}
                    className="pressable flex w-full items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: 'var(--accent-ready)',
                      borderColor: 'transparent',
                      color: 'var(--text-on-ready)',
                    }}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Apply {importMode === 'merge' ? 'Merge' : 'Replace'} Import
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
