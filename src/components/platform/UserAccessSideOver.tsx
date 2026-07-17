import { useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, Trash2, UserCheck, UserMinus } from 'lucide-react'
import { SideOver } from '../ui/SideOver'
import {
  MENU_ACCESS_GROUPS,
  type MenuAccess,
  type MenuAccessKey,
} from '../../lib/menuAccess'
import type { ProfileRole } from '../../lib/profiles'

type Props = {
  mode: 'create' | 'edit'
  title: string
  email: string
  name: string
  role: ProfileRole
  active: boolean
  menuAccess: MenuAccess
  saving?: boolean
  onClose: () => void
  onSave: () => void
  onDeleteSoft?: () => void
  onHardDelete?: () => void
  onChangeName: (v: string) => void
  onChangeEmail?: (v: string) => void
  onChangeRole: (v: ProfileRole) => void
  onChangeActive: (v: boolean) => void
  onChangeMenu: (key: MenuAccessKey, value: boolean) => void
  onActivateNow?: () => void
  onInactivateNow?: () => void
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
        disabled ? 'opacity-50' : 'hover:bg-zinc-50'
      }`}
    >
      <span className="text-sm font-medium text-liqui-navy">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-liqui-orange' : 'bg-zinc-200'
        } disabled:cursor-not-allowed`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
        <span className="sr-only">{label}</span>
      </button>
    </label>
  )
}

function AccordionGroup({
  label,
  children,
  defaultOpen = false,
}: {
  label: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-zinc-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3.5 text-left"
      >
        <span className="text-xs font-extrabold uppercase tracking-wide text-liqui-navy">
          {label}
        </span>
        <ChevronRight
          className={`h-4 w-4 text-zinc-400 transition ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

export function UserAccessSideOver({
  mode,
  title,
  email,
  name,
  role,
  active,
  menuAccess,
  saving,
  onClose,
  onSave,
  onDeleteSoft,
  onHardDelete,
  onChangeName,
  onChangeEmail,
  onChangeRole,
  onChangeActive,
  onChangeMenu,
  onActivateNow,
  onInactivateNow,
}: Props) {
  const isConsultor = role === 'consultor'
  const initials = useMemo(
    () => (name || email || '?').slice(0, 2).toUpperCase(),
    [name, email],
  )

  return (
    <SideOver
      title={title}
      subtitle={
        mode === 'edit'
          ? 'Aprovação + menu que o consultor vê ao logar'
          : 'Fluxo excepcional — preferir cadastro do próprio consultor'
      }
      onClose={onClose}
      widthClass="max-w-xl"
      headerExtra={
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-liqui-navy text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-liqui-navy">
              {name || 'Sem nome'}
            </p>
            <p className="truncate text-xs text-zinc-500">{email || '—'}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
              active
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {active ? 'Ativo' : 'Pendente'}
          </span>
          <span className="rounded-full bg-liqui-orange-soft px-2.5 py-0.5 text-[10px] font-bold uppercase text-liqui-navy">
            {role === 'owner' ? 'Owner' : 'Consultor'}
          </span>
        </div>
      }
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="flex-1 rounded-xl bg-liqui-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Salvando…' : mode === 'create' ? 'Criar' : 'Salvar'}
            </button>
          </div>
          {mode === 'edit' && onDeleteSoft && (
            <button
              type="button"
              disabled={saving}
              onClick={onDeleteSoft}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Desativar acesso
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <p className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-xs leading-relaxed text-zinc-600">
          O consultor se cadastra com a própria e-mail/senha. O owner só{' '}
          <strong>aprova</strong> a conta e define <strong>quais menus</strong>{' '}
          aparecem na visão dele.
        </p>

        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
            Perfil
          </p>
          <label className="block text-sm font-semibold text-liqui-navy">
            Nome
            <input
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
            />
          </label>

          {mode === 'create' && onChangeEmail ? (
            <label className="block text-sm font-semibold text-liqui-navy">
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => onChangeEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
              />
            </label>
          ) : (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
              {email}
            </div>
          )}

          <label className="block text-sm font-semibold text-liqui-navy">
            Cargo
            <select
              value={role}
              onChange={(e) => onChangeRole(e.target.value as ProfileRole)}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
            >
              <option value="consultor">Consultor (vendas)</option>
              <option value="owner">Owner (plataforma)</option>
            </select>
          </label>
        </section>

        {mode === 'edit' && (
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              Aprovação
            </p>
            <div className="rounded-2xl border border-zinc-100 px-2 py-1">
              <Toggle
                label="Conta ativa (libera login no CRM)"
                checked={active}
                onChange={onChangeActive}
                disabled={role === 'owner'}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving || active || !onActivateNow || role === 'owner'}
                onClick={onActivateNow}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-bold text-liqui-navy disabled:opacity-40"
              >
                <UserCheck className="h-3.5 w-3.5 text-liqui-orange" />
                Ativar agora
              </button>
              <button
                type="button"
                disabled={saving || !active || !onInactivateNow || role === 'owner'}
                onClick={onInactivateNow}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-bold text-liqui-navy disabled:opacity-40"
              >
                <UserMinus className="h-3.5 w-3.5 text-liqui-orange" />
                Inativar agora
              </button>
            </div>
          </section>
        )}

        {isConsultor ? (
          <section>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              Acessos no menu
            </p>
            <p className="mb-2 text-xs text-zinc-500">
              Ligue o que o consultor verá depois do login.
            </p>
            <div className="rounded-2xl border border-zinc-100 px-3">
              {MENU_ACCESS_GROUPS.map((group) => (
                <AccordionGroup
                  key={group.id}
                  label={group.label}
                  defaultOpen={group.id === 'vendas'}
                >
                  {group.items.map((item) => (
                    <Toggle
                      key={item.key}
                      label={item.label}
                      checked={menuAccess[item.key]}
                      disabled={item.key === 'plataforma'}
                      onChange={(v) => onChangeMenu(item.key, v)}
                    />
                  ))}
                  {group.id === 'plataforma' && (
                    <p className="px-3 pb-2 text-[11px] text-zinc-400">
                      Plataforma fica exclusiva do owner.
                    </p>
                  )}
                </AccordionGroup>
              ))}
            </div>
          </section>
        ) : (
          <p className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600">
            Owners têm acesso completo a todos os menus.
          </p>
        )}

        {mode === 'edit' && onHardDelete && (
          <section className="space-y-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={onHardDelete}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
            >
              Excluir permanentemente do Auth
            </button>
            <p className="text-[11px] text-zinc-400">
              Soft delete (rodapé) só desativa. Remoção permanente apaga o login.
            </p>
          </section>
        )}

        {mode === 'create' && (
          <p className="text-xs text-amber-700">
            Preferível: o consultor usa /cadastro com a senha dele. Este criar
            só para casos especiais (conta entra pendente até ativar).
          </p>
        )}
      </div>
    </SideOver>
  )
}
