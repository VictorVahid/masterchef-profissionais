import { useState } from 'react'
import type { Participant } from '@/types'
import { initials } from '@/lib/ranking'
import { safeImageUrl } from '@/lib/safe'

interface Props {
  participant: Participant
  size?: number
  className?: string
}

/** Foto do participante com fallback para as iniciais */
export function Avatar({ participant, size = 40, className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }

  const src = safeImageUrl(participant.photo)

  if (failed || !src) {
    return (
      <span
        style={{ ...style, fontSize: size * 0.32 }}
        className={`grid shrink-0 place-items-center rounded-full bg-surface font-medium tracking-wide text-muted ${className}`}
        aria-hidden
      >
        {initials(participant.name)}
      </span>
    )
  }

  return (
    <img
      src={src}
      referrerPolicy="no-referrer"
      decoding="async"
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={style}
      className={`shrink-0 rounded-full bg-surface object-cover object-top ring-1 ring-line ${className}`}
    />
  )
}
