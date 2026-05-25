// SECTION 8 — Ils en parlent (citations d'experts)
// NOTE : placeholders à valider avec le client.
export function Experts() {
  const quotes = [
    {
      text:
        "L'isolement social a un impact aussi délétère sur la santé que le tabagisme.",
      author: 'Dr. [Nom à confirmer]',
      role: 'Gériatre',
      source: 'Source à venir',
    },
    {
      text:
        "Maintenir une conversation régulière, même brève, est l'un des facteurs les plus protecteurs face au déclin cognitif chez les personnes âgées.",
      author: '[À confirmer]',
      role: 'Chercheur·euse en neurosciences',
      source: 'Source à venir',
    },
    {
      text:
        "La technologie ne remplace pas la présence — mais bien pensée, elle peut prolonger le geste familial entre deux visites.",
      author: '[À confirmer]',
      role: 'Sociologue du grand âge',
      source: 'Source à venir',
    },
  ]

  return (
    <section className="bg-creme py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            Ils en parlent
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Le lien social,<br className="hidden md:block" />
            <span className="italic text-terracotta-dark">enjeu de santé publique.</span>
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {quotes.map((q, i) => (
            <figure
              key={i}
              className="bg-creme-sable rounded-xl p-8 flex flex-col"
            >
              {/* Guillemet décoratif */}
              <span className="font-serif text-5xl leading-none text-terracotta -mb-2" aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="font-serif italic text-xl text-brun-900 leading-snug text-pretty flex-1">
                {q.text}
              </blockquote>
              <figcaption className="mt-6 pt-5 border-t border-creme">
                <p className="font-medium text-brun-900">{q.author}</p>
                <p className="text-sm text-brun-700">{q.role}</p>
                <p className="text-xs text-brun-700/70 mt-1 italic">{q.source}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-8 text-xs text-brun-700/60 italic">
          Placeholders à finaliser avec le client.
        </p>
      </div>
    </section>
  )
}
