import { X } from 'lucide-react'

/** Coquille de modale partagée par les pages organisation. */
export function Modal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brun-900/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} max-h-[88vh] overflow-auto rounded-2xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-serif font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
