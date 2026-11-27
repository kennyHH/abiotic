import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Check, ChevronDown, HelpCircle } from 'lucide-react';

interface InfoPopoverProps {
  ariaLabel: string;
  title?: string;
  align?: 'left' | 'right';
  icon?: ReactNode;
  triggerClassName?: string;
  children: ReactNode;
}

/**
 * Compact click/keyboard-accessible popover used to tuck secondary prose,
 * shortcuts, and metadata out of the main chrome.
 */
export function InfoPopover({
  ariaLabel,
  title,
  align = 'right',
  icon,
  triggerClassName = '',
  children,
}: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        title={title || ariaLabel}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className={`surface-hover pressable inline-flex items-center justify-center rounded transition-colors ${triggerClassName}`}
        style={{
          color: open ? 'var(--text-primary)' : 'var(--text-muted)',
          backgroundColor: open ? 'var(--bg-elevated)' : undefined,
        }}
      >
        {icon || <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={ariaLabel}
          className={`popover-enter absolute top-full z-40 mt-2 w-64 rounded-md border p-3 text-xs leading-relaxed sm:w-72 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)',
            boxShadow: 'var(--shadow-popover)',
            color: 'var(--text-secondary)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  accentColor?: string;
}

/**
 * Accessible tactile switch replacing browser-native checkboxes.
 */
export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  accentColor = 'var(--accent-chem)',
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="touch-switch pressable relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors"
      style={{
        backgroundColor: checked ? accentColor : 'var(--bg-well)',
        borderColor: checked ? 'transparent' : 'var(--border-strong)',
        boxShadow: checked ? undefined : 'var(--inset-well)',
      }}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export interface QuantityInputProps {
  value: number;
  itemName: string;
  ariaLabel?: string;
  onCommit: (nextQty: number) => void;
}

/**
 * Buffered numeric quantity input so backspacing to empty doesn't remove the item;
 * blur or Escape restores/clamps to 1..999.
 */
export function QuantityInput({
  value,
  itemName,
  ariaLabel,
  onCommit,
}: QuantityInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(String(value));
    }
  }, [value, editing]);

  const commitDraft = () => {
    setEditing(false);
    const parsed = parseInt(draft.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDraft('1');
      onCommit(1);
      return;
    }
    const clamped = Math.min(999, parsed);
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={editing ? draft : String(value)}
      onFocus={() => {
        setEditing(true);
        setDraft(String(value));
      }}
      onChange={(e) => {
        const digitsOnly = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
        setDraft(digitsOnly);
      }}
      onBlur={commitDraft}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setEditing(false);
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel || `Quantity of ${itemName}`}
      className="tabular-nums no-spinners w-11 rounded border bg-transparent px-1 py-0.5 text-center text-base sm:text-[13px]"
      style={{ borderColor: 'var(--border-subtle)' }}
    />
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface CustomSelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  icon?: ReactNode;
  active?: boolean;
  align?: 'left' | 'right';
}

/**
 * Accessible custom dark/light listbox dropdown replacing native OS `<select>`.
 */
export function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  icon,
  active = false,
  align = 'left',
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listboxId = useId();

  const selectedOption =
    options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const currentIdx = Math.max(
      0,
      options.findIndex((opt) => opt.value === value)
    );
    setFocusedIndex(currentIdx);

    const onPointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open, options, value]);

  useEffect(() => {
    if (open) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [open, focusedIndex]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(options.length - 1);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className="surface-hover touch-chip pressable flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors"
        style={{
          backgroundColor: active
            ? 'var(--control-active-bg)'
            : 'var(--bg-well)',
          borderColor: active
            ? 'var(--control-active-border)'
            : 'var(--border-subtle)',
          boxShadow: active ? 'var(--specular-top)' : 'var(--inset-well)',
          color: 'var(--text-primary)',
        }}
      >
        {icon && (
          <span
            className="shrink-0"
            aria-hidden="true"
            style={{ color: 'var(--text-muted)' }}
          >
            {icon}
          </span>
        )}
        <span>{selectedOption?.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={handleListKeyDown}
          className={`popover-enter absolute top-full z-40 mt-1.5 min-w-full max-h-72 overflow-y-auto rounded-md border p-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          {options.map((opt, idx) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                ref={(el) => {
                  optionRefs.current[idx] = el;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="surface-hover flex w-full items-center justify-between gap-3 rounded px-2.5 py-1.5 text-left text-[13px] whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: selected
                    ? 'var(--control-active-bg)'
                    : 'transparent',
                  color: selected
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                  fontWeight: selected ? 600 : 500,
                }}
              >
                <span>{opt.label}</span>
                {selected && (
                  <Check
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                    style={{ color: 'var(--accent-chem)' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
