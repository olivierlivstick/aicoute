import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown, UserPlus, Check } from 'lucide-react'
import { useSelectedBeneficiary } from '@/hooks/useSelectedBeneficiary'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { beneficiaries, selected, selectBeneficiary, loading } = useSelectedBeneficiary()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fermer le dropdown au clic hors
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handleSelect = (id: string) => {
    selectBeneficiary(id)
    setOpen(false)
  }

  const handleNew = () => {
    navigate('/beneficiary/new')
  }

  // Sur la page wizard, on n'affiche pas le bouton "Nouveau" (déjà là)
  const isWizard = location.pathname.startsWith('/beneficiary/new')

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-6 h-16 flex items-center gap-4 shadow-sm">
      {/* Dropdown bénéficiaires */}
      <div className="relative flex-1 max-w-sm" ref={dropdownRef}>
        {loading ? (
          <div className="h-10 w-full rounded-xl bg-slate-100 animate-pulse" />
        ) : beneficiaries.length === 0 ? (
          <div className="text-sm text-slate-400 italic">
            Aucun bénéficiaire configuré
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {selected?.first_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {selected ? `${selected.first_name} ${selected.last_name}` : 'Sélectionner un bénéficiaire'}
                  </p>
                  {selected?.is_active === false && (
                    <p className="text-[11px] text-slate-400">Profil désactivé</p>
                  )}
                </div>
              </div>
              <ChevronDown size={16} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-h-80 overflow-y-auto">
                {beneficiaries.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelect(b.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors',
                      b.id === selected?.id && 'bg-primary-50'
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary-100 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {b.first_name[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-700 flex-1 truncate">
                      {b.first_name} {b.last_name}
                    </span>
                    {b.id === selected?.id && <Check size={14} className="text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bouton nouveau bénéficiaire — désactivé pour l'instant (un seul
          bénéficiaire par compte ; la création initiale passe par l'écran d'accueil). */}
      {!isWizard && (
        <Button
          onClick={handleNew}
          variant="ghost"
          size="sm"
          disabled
          title="Bientôt disponible — un bénéficiaire par compte pour le moment"
        >
          <UserPlus size={16} />
          Nouveau bénéficiaire
        </Button>
      )}
    </header>
  )
}
