import type { OrgBeneficiaryInput } from '@/hooks/useOrgBeneficiaries'

/**
 * Import CSV des bénéficiaires d'organisation. Format attendu (en-tête obligatoire) :
 *
 *   prenom,nom,telephone,commentaire
 *
 * - `prenom` et `nom` sont obligatoires ; `telephone` et `commentaire` optionnels.
 * - Séparateur `,` ou `;` auto-détecté ; champs entre guillemets supportés.
 * - Téléphone normalisé en E.164 (0X… → +33…).
 */

export const DEMO_CSV = `prenom,nom,telephone,commentaire
Marie,Dupont,+33612345678,Chambre 12 - aime parler de jardinage
Jean,Martin,0698765432,Malentendant - parler lentement
Suzanne,Bernard,+33611223344,
`

export interface CsvParseResult {
  rows: OrgBeneficiaryInput[]
  errors: string[]
}

/** Normalise un téléphone saisi librement vers de l'E.164 (FR par défaut). */
export function normalizePhone(raw: string): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  const cleaned = v.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return '+' + cleaned.slice(1).replace(/\D/g, '')
  if (cleaned.startsWith('0')) return '+33' + cleaned.slice(1)
  return cleaned ? '+' + cleaned : ''
}

function stripAccentsLower(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/** Parse une ligne CSV en respectant les champs entre guillemets. */
function parseLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Mappe un en-tête (insensible casse/accents) vers une clé interne. */
function headerKey(h: string): keyof OrgBeneficiaryInput | null {
  const k = stripAccentsLower(h)
  if (k === 'prenom') return 'first_name'
  if (k === 'nom') return 'last_name'
  if (k === 'telephone' || k === 'tel') return 'phone'
  if (k === 'commentaire' || k === 'comment') return 'comment'
  return null
}

export function parseBeneficiariesCsv(text: string): CsvParseResult {
  const errors: string[] = []
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { rows: [], errors: ['Le fichier est vide.'] }
  }

  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
  const header = parseLine(lines[0], delim).map(headerKey)

  if (!header.includes('first_name') || !header.includes('last_name')) {
    return {
      rows: [],
      errors: ['En-tête invalide. Colonnes attendues : prenom, nom, telephone, commentaire.'],
    }
  }

  const rows: OrgBeneficiaryInput[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i], delim)
    const rec: OrgBeneficiaryInput = { first_name: '', last_name: '', phone: null, comment: null }
    header.forEach((key, idx) => {
      if (!key) return
      const val = (cells[idx] ?? '').trim()
      if (key === 'phone') rec.phone = val ? normalizePhone(val) : null
      else if (key === 'comment') rec.comment = val || null
      else rec[key] = val
    })
    if (!rec.first_name || !rec.last_name) {
      errors.push(`Ligne ${i + 1} ignorée : prénom et nom obligatoires.`)
      continue
    }
    rows.push(rec)
  }

  return { rows, errors }
}
