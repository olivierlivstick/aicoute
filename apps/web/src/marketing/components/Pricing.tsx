// SECTION 7 — Tarifs (3 packs de minutes, dégressif, carte centrale mise en avant)
import { useState } from 'react'
import { Icon } from '@/marketing/components/icons'
import { MINUTE_PACKS, type MinutePack } from '@modect/shared'
import { startCheckout } from '@/lib/checkout'

const PACK_CTA = 'Choisir ce pack'

export function Pricing() {
  const packs = MINUTE_PACKS

  return (
    <section id="tarifs" className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Choisissez votre temps de conversation.
          </h2>
          <p className="mt-4 text-lg text-brun-700 text-pretty">
            Un tarif à la minute, dégressif. Vous achetez des minutes de
            conversation, sans abonnement, sans engagement.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6 items-stretch">
          {packs.map((p) => (
            <PackCard key={p.name} pack={p} />
          ))}
        </div>

        <p className="mt-10 text-sm text-center text-brun-700 max-w-2xl mx-auto leading-relaxed">
          Une conversation dure en moyenne 7 à 10 minutes. Vos minutes restent
          valables 6 mois — et vous pouvez activer la recharge automatique pour
          ne jamais interrompre le lien.
        </p>
      </div>
    </section>
  )
}

function PackCard({ pack }: { pack: MinutePack }) {
  const { featured } = pack
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onBuy = async () => {
    setError(null)
    setLoading(true)
    try {
      await startCheckout(pack.id)
      // redirection en cours — on laisse le spinner actif
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
      setLoading(false)
    }
  }

  return (
    <div
      className={`relative bg-white rounded-xl p-8 flex flex-col ${
        featured
          ? 'border-2 border-terracotta md:-translate-y-2'
          : 'border border-creme-sable'
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-terracotta text-creme rounded-full px-3 py-1 text-xs font-medium tracking-wide">
          Le plus choisi
        </span>
      )}

      <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark">
        {pack.name}
      </p>

      {/* Minutes achetées (mise en avant) */}
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-serif text-5xl text-brun-900">{pack.minutes}</span>
        <span className="text-base text-brun-700">minutes</span>
      </div>

      {/* Prix du pack + badge d'économie */}
      <div className="mt-3 flex items-center gap-2.5">
        <span className="font-serif text-2xl text-brun-900">{pack.price} €</span>
        {pack.saving && (
          <span className="bg-ocre text-creme rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide">
            {pack.saving}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-brun-700">{pack.perMinute}</p>

      {/* Rythme d'appels (mis en avant) + équivalence conversations */}
      <div className="mt-7 flex-1">
        <p className="flex items-center gap-2.5 text-[15px] font-semibold text-brun-900">
          <span className="shrink-0 text-terracotta">
            <Icon.Phone size={18} stroke="#C75D3A" />
          </span>
          {pack.cadence}
        </p>
        <p className="mt-2 text-sm text-brun-700 leading-relaxed text-pretty">
          {pack.detail}
        </p>
      </div>

      <button
        type="button"
        onClick={onBuy}
        disabled={loading}
        aria-label={`${PACK_CTA} — ${pack.name}, ${pack.minutes} minutes`}
        className={`mt-8 inline-flex items-center justify-center px-6 py-3 rounded-md font-medium transition-colors disabled:opacity-70 disabled:cursor-wait ${
          featured
            ? 'bg-terracotta hover:bg-terracotta-dark text-creme'
            : 'border border-terracotta text-terracotta-dark hover:bg-terracotta hover:text-creme'
        }`}
      >
        {loading ? 'Redirection…' : PACK_CTA}
      </button>
      {error && (
        <p className="mt-2 text-sm text-center text-[#B23A48]">{error}</p>
      )}
    </div>
  )
}
