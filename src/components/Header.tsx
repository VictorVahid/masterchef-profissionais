import { useTheme } from '@/hooks/useTheme'
import { ChefHatIcon, MoonIcon, SearchIcon, SunIcon } from './icons'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function Header({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="group flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-bg transition-transform group-hover:-rotate-6">
            <ChefHatIcon className="size-4" />
          </span>
          <span className="font-serif text-[1.15rem] tracking-tight">
            MasterChef <span className="text-muted">Profissionais</span>
          </span>
        </a>

        <nav className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Busca rápida"
            className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-fg sm:border sm:border-line sm:pr-1.5"
          >
            <SearchIcon className="size-4" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[10px] text-subtle sm:inline">
              {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>
          <a
            href="#ranking"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg sm:block"
          >
            Ranking
          </a>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            {theme === 'dark' ? <SunIcon className="size-[18px]" /> : <MoonIcon className="size-[18px]" />}
          </button>
        </nav>
      </div>
    </header>
  )
}
