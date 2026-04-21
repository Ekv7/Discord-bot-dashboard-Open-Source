import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type CleanSelectOption = { value: string; label: string }
export type CleanSelectGroup = { label: string; options: CleanSelectOption[] }

type Props = {
  value: string
  onChange: (value: string) => void
  flatOptions?: CleanSelectOption[]
  groups?: CleanSelectGroup[]
  placeholder?: string
  className?: string
  /** id eines <label> für Barrierefreiheit */
  labelId?: string
}

function findLabel(value: string, flat?: CleanSelectOption[], groups?: CleanSelectGroup[]) {
  for (const o of flat ?? []) {
    if (o.value === value) return o.label
  }
  for (const g of groups ?? []) {
    const o = g.options.find((x) => x.value === value)
    if (o) return o.label
  }
  return null
}

export function CleanSelect({
  value,
  onChange,
  flatOptions,
  groups,
  placeholder = 'Wählen…',
  className = '',
  labelId,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const label = findLabel(value, flatOptions, groups) ?? placeholder

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = useCallback(
    (v: string) => {
      onChange(v)
      setOpen(false)
    },
    [onChange]
  )

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        onClick={() => setOpen((o) => !o)}
        className="dash-select-trigger"
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="dash-select-panel" role="listbox">
          {flatOptions?.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={value === o.value}
              onClick={() => select(o.value)}
              className={`dash-select-option ${value === o.value ? 'dash-select-option-active' : ''}`}
            >
              <span className="truncate">{o.label}</span>
            </button>
          ))}
          {groups && groups.length > 0 && (flatOptions?.length ?? 0) > 0 ? (
            <div className="mx-2 my-1 h-px bg-[var(--border)]" aria-hidden />
          ) : null}
          {groups?.map((g) => (
            <div key={g.label}>
              <div className="dash-label px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider">
                {g.label}
              </div>
              {g.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  onClick={() => select(o.value)}
                  className={`dash-select-option pl-4 ${value === o.value ? 'dash-select-option-active' : ''}`}
                >
                  <span className="min-w-0 truncate">{o.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
