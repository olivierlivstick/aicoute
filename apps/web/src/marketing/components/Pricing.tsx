// SECTION 7 — Tarifs (3 packs de minutes, dégressif, carte centrale mise en avant)
import { Icon } from '@/marketing/components/icons'
import { SIGNUP_URL } from '@/config/links'

type Pack = {
  name: string
  minutes: string       // quantité achetée, ex. '50'
  price: string         // prix du pack en €, ex. '25'
  perMinute: string     // tarif unitaire, ex. '0,50 € / minute'
  saving?: string        // badge d'économie à côté du prix, ex. '−10 %'
  cadence: string       // rythme d'appels (mis en avant), ex. '≈ 1 appel par semaine'
  detail: string        // équivalence en conversations (texte secondaire)
  cta: string
  featured: boolean
}

export function Pricing() {
  const packs: Pack[] = [
    {
      name: 'Le rendez-vous',
      minutes: '50',
      price: '25',
      perMinute: '0,50 € / minute',
      cadence: '≈ 1 appel par semaine',
      detail: 'Soit 5 à 7 conversations, pendant environ un mois.',
      cta: 'Choisir ce pack',
      featured: false,
    },
    {
      name: 'Le lien',
      minutes: '100',
      price: '45',
      perMinute: '0,45 € / minute',
      saving: '−10 %',
      cadence: '≈ 2 à 3 appels par semaine',
      detail: 'Soit 10 à 14 conversations, pendant environ un mois.',
      cta: 'Choisir ce pack',
      featured: true,
    },
    {
      name: 'La présence',
      minutes: '250',
      price: '100',
      perMinute: '0,40 € / minute',
      saving: '−20 %',
      cadence: '≈ presque 1 appel par jour',
      detail: 'Soit 25 à 35 conversations, pendant environ un mois.',
      cta: 'Choisir ce pack',
      featured: false,
    },
  ]

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

function PackCard({ pack }: { pack: Pack }) {
  const { featured } = pack
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

      <a
        href={SIGNUP_URL}
        aria-label={`${pack.cta} — ${pack.name}, ${pack.minutes} minutes`}
        className={`mt-8 inline-flex items-center justify-center px-6 py-3 rounded-md font-medium transition-colors ${
          featured
            ? 'bg-terracotta hover:bg-terracotta-dark text-creme'
            : 'border border-terracotta text-terracotta-dark hover:bg-terracotta hover:text-creme'
        }`}
      >
        {pack.cta}
      </a>
    </div>
  )
}
