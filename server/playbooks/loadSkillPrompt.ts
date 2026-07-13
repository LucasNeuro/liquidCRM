import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(process.cwd())

/** Carrega o prompt canônico de uma skill do projeto. */
export function loadSkillPrompt(skillName: string): string {
  const path = resolve(
    ROOT,
    'skills',
    skillName,
    'prompt.system.md',
  )
  return readFileSync(path, 'utf8').trim()
}
