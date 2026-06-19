/**
 * Coquille temporaire des pages organisation (Lot 0).
 * Remplacée par le contenu réel au fil des lots 1→5.
 */
export function OrgPlaceholder({ title, lot }: { title: string; lot: string }) {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-serif font-semibold text-slate-800">{title}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
        <p className="text-sm text-slate-500">
          Cette page arrive bientôt.
        </p>
        <p className="mt-1 text-xs uppercase tracking-widest text-slate-300">{lot}</p>
      </div>
    </div>
  )
}
