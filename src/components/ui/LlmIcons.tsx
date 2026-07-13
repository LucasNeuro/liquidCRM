type SvgProps = {
  className?: string
  title?: string
}

/** Marca Google Gemini (sparkle oficial simplificado, com gradiente). */
export function GeminiIcon({ className = 'h-5 w-5', title }: SvgProps) {
  const gid = 'liqui-gemini-grad'
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={title || 'Google Gemini'}
    >
      <title>{title || 'Google Gemini'}</title>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="35%" stopColor="#9B72CB" />
          <stop offset="68%" stopColor="#D96570" />
          <stop offset="100%" stopColor="#D68136" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gid})`}
        d="M12 2c0 5.523 4.477 10 10 10-5.523 0-10 4.477-10 10 0-5.523-4.477-10-10-10 5.523 0 10-4.477 10-10z"
      />
    </svg>
  )
}

/**
 * Marca Mistral AI (emblema geométrico laranja reconhecível).
 * Caminho baseado no pictograma público da marca.
 */
export function MistralIcon({ className = 'h-5 w-5', title }: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={title || 'Mistral AI'}
    >
      <title>{title || 'Mistral AI'}</title>
      <g fill="#FF7000">
        <path d="M3 4.5h4.2v3.6H3zM10.2 4.5H24v3.6H10.2z" />
        <path d="M3 9.9h11.4v3.6H3zM18 9.9h3v3.6h-3z" />
        <path d="M3 15.3h4.2V21H3zM10.2 15.3H24V21H10.2z" />
      </g>
    </svg>
  )
}

/** Bolha com SVG de LLM (mesmo formato do IconBubble). */
export function LlmIconBubble({
  provider,
  size = 'lg',
}: {
  provider: 'gemini' | 'mistral'
  size?: 'sm' | 'md' | 'lg'
}) {
  const box =
    size === 'sm'
      ? 'h-6 w-6 rounded-lg'
      : size === 'md'
        ? 'h-7 w-7 rounded-xl'
        : 'h-9 w-9 rounded-xl'
  const icon =
    size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-zinc-50 ring-1 ring-zinc-200/80 ${box}`}
    >
      {provider === 'gemini' ? (
        <GeminiIcon className={icon} />
      ) : (
        <MistralIcon className={icon} />
      )}
    </span>
  )
}
