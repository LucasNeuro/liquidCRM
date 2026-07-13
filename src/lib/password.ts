export type PasswordRule = {
  id: string
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: 'Pelo menos 8 caracteres',
    test: (p) => p.length >= 8,
  },
  {
    id: 'upper',
    label: 'Uma letra maiúscula (A–Z)',
    test: (p) => /[A-ZÀ-Ý]/.test(p),
  },
  {
    id: 'lower',
    label: 'Uma letra minúscula (a–z)',
    test: (p) => /[a-zà-ÿ]/.test(p),
  },
  {
    id: 'number',
    label: 'Um número (0–9)',
    test: (p) => /\d/.test(p),
  },
  {
    id: 'special',
    label: 'Um caractere especial (!@#$%&*...)',
    test: (p) => /[^A-Za-z0-9À-ÿ]/.test(p),
  },
]

export function getPasswordChecks(password: string) {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    ok: rule.test(password),
  }))
}

export function isPasswordStrong(password: string) {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}

export function passwordStrengthLabel(password: string) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length
  if (!password) return { label: '—', tone: 'muted' as const }
  if (passed <= 2) return { label: 'Fraca', tone: 'bad' as const }
  if (passed <= 4) return { label: 'Média', tone: 'mid' as const }
  return { label: 'Forte', tone: 'good' as const }
}
