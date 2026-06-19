import { useState } from 'react'
import { Download, Upload, FileText } from 'lucide-react'
import { Modal } from '@/pages/org/Modal'
import { DEMO_CSV, parseBeneficiariesCsv, type CsvParseResult } from '@/pages/org/csv'
import type { OrgBeneficiaryInput } from '@/hooks/useOrgBeneficiaries'

/** Import CSV des bénéficiaires (avec téléchargement d'un modèle de démo). */
export function ImportCsvModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (rows: OrgBeneficiaryInput[]) => Promise<number | null>
}) {
  const [parsed, setParsed] = useState<CsvParseResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function downloadDemo() {
    const blob = new Blob([DEMO_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'beneficiaires-modele.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setDone(null)
    setErr(null)
    const text = await file.text()
    setParsed(parseBeneficiariesCsv(text))
  }

  async function handleImport() {
    if (!parsed || parsed.rows.length === 0 || importing) return
    setImporting(true)
    setErr(null)
    const n = await onImport(parsed.rows)
    setImporting(false)
    if (n === null) setErr("Échec de l'import.")
    else setDone(n)
  }

  return (
    <Modal title="Importer des bénéficiaires (CSV)" onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Le fichier doit respecter le format suivant (en-tête obligatoire) :
          <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">prenom,nom,telephone,commentaire</code>
        </p>

        <button
          onClick={downloadDemo}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download size={16} /> Télécharger le CSV de démo
        </button>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-6 hover:border-primary hover:bg-primary-50/40">
          <Upload size={20} className="text-slate-400" />
          <div className="text-sm">
            <span className="font-medium text-slate-700">Choisir un fichier CSV</span>
            {fileName && <span className="ml-2 text-slate-400">{fileName}</span>}
          </div>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>

        {parsed && done === null && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-slate-700">
              <FileText size={15} /> {parsed.rows.length} bénéficiaire(s) prêt(s) à importer
            </p>
            {parsed.errors.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
                {parsed.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                {parsed.errors.length > 8 && <li>… +{parsed.errors.length - 8} autres</li>}
              </ul>
            )}
          </div>
        )}

        {done !== null && (
          <p className="rounded-xl bg-sauge/10 px-4 py-3 text-sm font-medium text-sauge">
            ✓ {done} bénéficiaire(s) importé(s).
          </p>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            {done !== null ? 'Fermer' : 'Annuler'}
          </button>
          {done === null && (
            <button
              onClick={handleImport}
              disabled={!parsed || parsed.rows.length === 0 || importing}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {importing ? 'Import…' : `Importer ${parsed?.rows.length ?? 0}`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
