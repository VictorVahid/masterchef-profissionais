import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Episode, Participant } from '@/types'
import { Avatar } from './Avatar'
import { Modal } from './Modal'
import { CompareIcon, SearchIcon } from './icons'

interface Props {
  open: boolean
  onClose: () => void
  participants: Participant[]
  episodes: Episode[]
  onParticipant: (id: string) => void
  onEpisode: (n: number) => void
  onCompare: () => void
}

interface Item {
  key: string
  label: string
  hint: string
  icon: ReactNode
  keywords: string
  run: () => void
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Busca rápida (Ctrl/⌘+K ou /): participantes, episódios e ações */
export function CommandPalette({ open, onClose, participants, episodes, onParticipant, onEpisode, onCompare }: Props) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const items = useMemo<Item[]>(
    () => [
      ...participants.map((p) => ({
        key: p.id,
        label: p.name,
        hint: p.specialty ?? p.currentCompany,
        icon: <Avatar participant={p} size={28} />,
        keywords: `${p.name} ${p.specialty ?? ''} ${p.city} ${p.veteran ? 'veterano' : 'estreante'}`,
        run: () => onParticipant(p.id),
      })),
      ...[...episodes].reverse().map((e) => ({
        key: `ep${e.number}`,
        label: `EP ${e.number} · ${e.title}`,
        hint: 'Episódio',
        icon: <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-[11px] font-medium text-accent">{e.number}</span>,
        keywords: `ep ${e.number} episodio ${e.title}`,
        run: () => onEpisode(e.number),
      })),
      {
        key: 'compare',
        label: 'Comparar participantes',
        hint: 'Ação',
        icon: <span className="grid size-7 place-items-center rounded-full bg-surface text-muted"><CompareIcon className="size-4" /></span>,
        keywords: 'comparar frente a frente versus',
        run: onCompare,
      },
    ],
    [participants, episodes, onParticipant, onEpisode, onCompare],
  )

  const results = useMemo(() => {
    const q = normalize(query.trim())
    return q ? items.filter((i) => q.split(/\s+/).every((t) => normalize(i.keywords).includes(t))) : items
  }, [items, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
    }
  }, [open])
  useEffect(() => setIndex(0), [query])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const run = (item?: Item) => {
    if (!item) return
    onClose()
    item.run()
  }

  return (
    <Modal open={open} onClose={onClose} label="Busca rápida" width="max-w-lg" top>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <SearchIcon className="size-4 shrink-0 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setIndex((i) => Math.min(i + 1, results.length - 1)))
            if (e.key === 'ArrowUp') (e.preventDefault(), setIndex((i) => Math.max(i - 1, 0)))
            if (e.key === 'Enter') (e.preventDefault(), run(results[index]))
          }}
          placeholder="Buscar participante, episódio ou ação…"
          aria-label="Buscar"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-subtle"
        />
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-subtle sm:block">Esc</kbd>
      </div>
      <ul ref={list} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
        {results.map((item, i) => (
          <li key={item.key} role="option" aria-selected={i === index} data-index={i}>
            <button
              type="button"
              onMouseMove={() => setIndex(i)}
              onClick={() => run(item)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm ${
                i === index ? 'bg-surface' : ''
              }`}
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="hidden shrink-0 truncate text-xs text-subtle sm:block sm:max-w-40">{item.hint}</span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-subtle">Nada encontrado.</li>}
      </ul>
    </Modal>
  )
}
