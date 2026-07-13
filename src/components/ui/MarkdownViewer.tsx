import type { ReactNode } from 'react'

type Props = {
  markdown: string
  className?: string
}

/** Visualizador Markdown leve (sem deps) — headings, listas, code, negrito, links. */
export function MarkdownViewer({ markdown, className = '' }: Props) {
  const blocks = parseBlocks(markdown || '')

  return (
    <article
      className={`prose-liqui space-y-3 text-sm leading-relaxed text-liqui-navy ${className}`}
    >
      {blocks.map((block, i) => renderBlock(block, i))}
    </article>
  )
}

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'hr' }

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed === '---' || trimmed === '***') {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const code: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i += 1
      }
      i += 1
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2) })
      i += 1
      continue
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3) })
      i += 1
      continue
    }
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4) })
      i += 1
      continue
    }

    if (trimmed.startsWith('> ')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'quote', text: quote.join(' ') })
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    const para: string[] = [trimmed]
    i += 1
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('```') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim())
      i += 1
    }
    blocks.push({ type: 'p', text: para.join(' ') })
  }

  return blocks
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-bold">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px] text-zinc-700"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (m) {
        nodes.push(
          <a
            key={key++}
            href={m[2]}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-liqui-orange underline"
          >
            {m[1]}
          </a>,
        )
      }
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function renderBlock(block: Block, i: number): ReactNode {
  switch (block.type) {
    case 'h1':
      return (
        <h1 key={i} className="text-xl font-extrabold text-liqui-navy">
          {renderInline(block.text)}
        </h1>
      )
    case 'h2':
      return (
        <h2
          key={i}
          className="mt-4 border-b border-zinc-100 pb-1 text-base font-extrabold text-liqui-navy"
        >
          {renderInline(block.text)}
        </h2>
      )
    case 'h3':
      return (
        <h3 key={i} className="mt-3 text-sm font-bold text-liqui-navy">
          {renderInline(block.text)}
        </h3>
      )
    case 'p':
      return (
        <p key={i} className="text-sm text-zinc-700">
          {renderInline(block.text)}
        </p>
      )
    case 'ul':
      return (
        <ul key={i} className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol
          key={i}
          className="list-decimal space-y-1 pl-5 text-sm text-zinc-700"
        >
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      )
    case 'quote':
      return (
        <blockquote
          key={i}
          className="border-l-4 border-liqui-orange/60 bg-liqui-orange-soft/40 px-3 py-2 text-sm text-zinc-700"
        >
          {renderInline(block.text)}
        </blockquote>
      )
    case 'code':
      return (
        <pre
          key={i}
          className="overflow-x-auto rounded-xl bg-zinc-900 p-3 text-[12px] text-zinc-100"
        >
          <code>{block.text}</code>
        </pre>
      )
    case 'hr':
      return <hr key={i} className="border-zinc-200" />
    default:
      return null
  }
}
