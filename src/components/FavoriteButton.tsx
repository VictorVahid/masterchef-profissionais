import type { MouseEvent } from 'react'
import type { Participant } from '@/types'
import { useFavorites } from '@/hooks/useFavorites'
import { useToast } from './Toast'
import { HeartIcon } from './icons'

/** Coração para adicionar/remover da torcida */
export function FavoriteButton({ participant, size = 'sm' }: { participant: Participant; size?: 'sm' | 'md' }) {
  const { has, toggle } = useFavorites()
  const toast = useToast()
  const on = has(participant.id)
  const first = participant.name.split(' ')[0]

  const onClick = (e: MouseEvent) => {
    e.stopPropagation()
    toast(toggle(participant.id) ? `Você está torcendo por ${first}` : `${first} saiu da sua torcida`)
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick(e as unknown as MouseEvent))}
      aria-pressed={on}
      aria-label={on ? `Remover ${participant.name} da torcida` : `Torcer por ${participant.name}`}
      title={on ? 'Na sua torcida' : 'Torcer'}
      className={`inline-grid shrink-0 cursor-pointer place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
        size === 'md' ? 'size-8' : 'size-6'
      } ${on ? 'text-accent' : 'text-subtle hover:text-accent'}`}
    >
      <HeartIcon filled={on} className={size === 'md' ? 'size-[18px]' : 'size-3.5'} />
    </span>
  )
}
