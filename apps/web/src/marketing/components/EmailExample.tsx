// SECTION 5 — Exemple concret : mockup d'email + extrait transcription
import { Icon } from '@/marketing/components/icons'
import { Logo } from '@/components/Logo'

export function EmailExample() {
  const transcript = [
    { who: 'MODECT', text: "Bonjour Yvette, c'est MODECT. Comment allez-vous ce matin ?" },
    { who: 'Yvette', text: "Oh très bien, je viens de me servir un café. Vous savez, mes rosiers commencent à fleurir !" },
    { who: 'MODECT', text: "Quelle joie ! La dernière fois vous m'aviez dit que vous attendiez de voir les premières roses. Quelle couleur sont-elles ?" },
    { who: 'Yvette', text: "Roses pâles, comme celles que ma mère cultivait. Cela me rappelle des souvenirs…" },
  ]

  return (
    <section className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            Un exemple
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Voici ce que reçoit Sophie après l'appel à sa mère.
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-5 gap-6 md:gap-8 items-start">
          {/* Email — mockup */}
          <article className="md:col-span-3 bg-white border border-creme-sable rounded-xl overflow-hidden">
            {/* Barre Mail simulée */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-creme-sable bg-creme/60">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-brique/40" />
                <span className="w-3 h-3 rounded-full bg-ocre/50" />
                <span className="w-3 h-3 rounded-full bg-sauge/50" />
              </div>
              <p className="text-xs text-brun-700 ml-2">Boîte de réception — MODECT</p>
            </div>

            <div className="p-7 md:p-9">
              {/* Expéditeur */}
              <div className="flex items-center gap-3 pb-5 border-b border-creme-sable">
                <div className="w-10 h-10 rounded-full bg-creme-sable flex items-center justify-center">
                  <Logo variant="mark" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brun-900">
                    <span className="font-medium">MODECT</span>{' '}
                    <span className="text-brun-700">&lt;nouvelles@modect.fr&gt;</span>
                  </p>
                  <p className="text-xs text-brun-700">à sophie.lemaire@gmail.com — mardi 14 mai, 10 : 42</p>
                </div>
                <p className="text-xs text-brun-700 hidden sm:block">Boîte personnelle</p>
              </div>

              <h3 className="mt-5 font-medium text-lg text-brun-900">
                Nouvelles d'Yvette — mardi 14 mai
              </h3>

              <div className="mt-5 space-y-4 text-[15px] text-brun-900 leading-relaxed text-pretty">
                <p>Bonjour Sophie,</p>
                <p>
                  Votre maman était particulièrement en forme ce matin. Elle a
                  beaucoup parlé de son jardin : les rosiers commencent à
                  fleurir, et elle est ravie. Elle a aussi évoqué une visite de
                  sa voisine Mireille la semaine dernière, qui lui a apporté
                  une tarte.
                </p>

                {/* Point d'attention — encart subtil */}
                <div className="bg-creme rounded-lg border-l-2 border-ocre px-4 py-3">
                  <p className="text-xs uppercase tracking-widest text-ocre font-medium mb-1">
                    Point d'attention
                  </p>
                  <p className="text-brun-700">
                    Elle a mentionné une légère douleur au genou gauche, sans
                    s'en inquiéter, mais peut-être à surveiller lors de votre
                    prochain échange.
                  </p>
                </div>

                <p>
                  <span className="font-medium">Humeur générale</span> :
                  positive et bavarde.
                </p>

                <p className="text-brun-700">
                  La transcription complète est disponible dans votre espace personnel.
                </p>

                <p className="text-brun-700">
                  À mardi prochain,<br />
                  L'équipe MODECT
                </p>
              </div>

              <div className="mt-7 pt-5 border-t border-creme-sable flex flex-wrap gap-3">
                <a href="#" className="text-sm text-terracotta-dark font-medium link-underline">
                  Lire la transcription complète →
                </a>
                <span className="text-creme-sable">·</span>
                <a href="#" className="text-sm text-brun-700 link-underline">
                  Ajuster les préférences d'appel
                </a>
              </div>
            </div>
          </article>

          {/* Transcription — aperçu */}
          <aside className="md:col-span-2 bg-creme rounded-xl p-6 md:p-7 border border-creme-sable">
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark">
                Aperçu transcription
              </p>
              <p className="text-xs text-brun-700">4 min 12 s</p>
            </div>

            <ul className="space-y-4">
              {transcript.map((line, i) => {
                const isModect = line.who === 'MODECT'
                return (
                  <li key={i} className="flex gap-3">
                    <div className="shrink-0 w-8 flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium ${
                          isModect
                            ? 'bg-terracotta text-creme'
                            : 'bg-creme-sable text-brun-900'
                        }`}
                        aria-hidden="true"
                      >
                        {isModect ? 'M' : 'Y'}
                      </div>
                      {i < transcript.length - 1 && (
                        <span className="flex-1 w-px bg-creme-sable mt-1 min-h-[12px]" />
                      )}
                    </div>
                    <div className="pb-1 flex-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-wider text-brun-700">
                        {line.who}
                      </p>
                      <p className="mt-0.5 text-[14px] text-brun-900 leading-relaxed text-pretty">
                        « {line.text} »
                      </p>
                    </div>
                  </li>
                )
              })}
              <li className="flex gap-3 opacity-60">
                <div className="shrink-0 w-8 flex flex-col items-center">
                  <span className="w-7 h-7 rounded-full border border-dashed border-brun-700/40" />
                </div>
                <p className="text-[13px] text-brun-700 italic mt-1.5">
                  …conversation continue (3 min 28 s)
                </p>
              </li>
            </ul>

            <a href="#" className="mt-6 inline-flex items-center gap-1.5 text-sm text-terracotta-dark font-medium link-underline">
              Voir la transcription entière
              <Icon.ArrowRight size={14} />
            </a>
          </aside>
        </div>
      </div>
    </section>
  )
}
