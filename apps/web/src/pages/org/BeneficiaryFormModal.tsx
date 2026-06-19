import { useState } from 'react'
import type { Beneficiary } from '@modect/shared'
import { PhoneInput } from '@/components/PhoneInput'
import { Modal } from '@/pages/org/Modal'
import type { OrgBeneficiaryInput } from '@/hooks/useOrgBeneficiaries'

const fieldCls =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-4 font-body text-base text-slate-800 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary'

/** Création / édition d'un bénéficiaire d'organisation (champs légers). */
export function BeneficiaryFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: Beneficiary | null
  onClose: () => void
  onSubmit: (input: OrgBeneficiaryInput) => Promise<boolean>
}) {
  const [firstName, setFirstName] = useState(initial?.first_name ?? '')
  const [lastName, setLastName] = useState(initial?.last_name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const valid = firstName.trim() && lastName.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setErr(null)
    const ok = await onSubmit({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || null,
      comment: comment.trim() || null,
    })
    setSaving(false)
    if (ok) onClose()
    else setErr("Échec de l'enregistrement.")
  }

  return (
    <Modal title={initial ? 'Modifier le bénéficiaire' : 'Nouveau bénéficiaire'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Prénom *</label>
            <input className={fieldCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nom *</label>
            <input className={fieldCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Téléphone</label>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Commentaire</label>
          <textarea
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 font-body text-base text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex. Chambre 12, malentendant, ne pas appeler avant 10h…"
          />
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="submit"
            disabled={!valid || saving}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
