// SECTION 2 — Le constat (chiffres-clés)
export function Stats() {
  const cards = [
    { value: '2 millions', label: 'de personnes âgées isolées en France' },
    { value: '750 000', label: 'vivent sans aucun contact humain régulier' },
    { value: '+42 %', label: "d'augmentation en seulement 4 ans" },
  ]

  return (
    <section id="constat" className="bg-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            La réalité d'aujourd'hui
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            2 millions de personnes âgées souffrent d'isolement en France.
          </h2>
          <p className="mt-6 text-lg text-brun-700 leading-relaxed max-w-2xl text-pretty">
            Selon le Baromètre 2025 des Petits Frères des Pauvres, 750 000
            d'entre elles vivent en « mort sociale », sans aucun contact
            humain au quotidien. Un chiffre qui a bondi de 42 % en seulement
            quatre ans.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {cards.map((c) => (
            <div
              key={c.value}
              className="bg-white border border-creme-sable rounded-xl p-8 text-center"
            >
              <p className="font-serif text-5xl md:text-[3.25rem] text-terracotta leading-none">
                {c.value}
              </p>
              <p className="mt-4 text-brun-700 leading-relaxed">{c.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 italic text-brun-700 max-w-2xl leading-relaxed text-pretty">
          Et pourtant, beaucoup d'entre elles ont des enfants, des
          petits-enfants, qui aimeraient appeler plus souvent — mais le
          quotidien, la distance, la culpabilité parfois… rendent la
          régularité difficile. Aicoute a été pensé pour eux.
        </p>
        <p className="mt-4 text-xs text-brun-700/60">
          Source : Petits Frères des Pauvres, Baromètre 2025
        </p>
      </div>
    </section>
  )
}
