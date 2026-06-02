// SECTION 9 — FAQ (accordéon natif <details>)
import { Icon } from '@/marketing/components/icons'

export function FAQ() {
  const items = [
    {
      q: "Mon proche va-t-il comprendre qu'il parle à une IA ?",
      a:
        "Oui, en toute transparence. Dès la première seconde du premier appel, Aicoute se présente comme une IA mandatée par vous. Cette honnêteté est au cœur de notre démarche — et la plupart de nos utilisateurs trouvent cela rassurant plutôt que dérangeant.",
    },
    {
      q: "Que se passe-t-il si mon proche dit quelque chose d'inquiétant ?",
      a:
        "Tout signal sensible — douleur physique, déprime, chute évoquée, sujet préoccupant — est remonté dans la section « Point d'attention » de votre résumé. Sur la formule Sérénité, vous recevez une alerte en temps réel.",
    },
    {
      q: 'Comment Aicoute se souvient-il des conversations précédentes ?',
      a:
        "Chaque conversation est résumée puis indexée dans la mémoire dédiée à votre proche : les sujets récurrents, les personnes mentionnées, les événements importants. L'IA peut ainsi reprendre le fil naturellement d'un appel à l'autre.",
    },
    {
      q: "Mon proche peut-il refuser d'être appelé ?",
      a:
        "Absolument et à tout moment. Pendant l'appel il lui suffit de le dire ; les appels suivants sont immédiatement suspendus et vous êtes informé·e. Le respect du consentement prime sur tout le reste.",
    },
    {
      q: "Sur quel numéro l'appel est-il passé ?",
      a:
        "Sur le numéro de ligne fixe ou mobile que vous renseignez lors de la création du profil. Vous pouvez le modifier à tout moment depuis votre espace personnel.",
    },
    {
      q: "Que devient l'enregistrement de l'appel après le résumé ?",
      a:
        "L'enregistrement audio brut est supprimé dans les 24 heures. Seule la transcription textuelle est conservée pendant 12 mois glissants, le temps utile à la continuité de la conversation. Vous pouvez tout effacer à la demande.",
    },
    {
      q: 'Peut-on tester Aicoute avant de payer ?',
      a:
        "Oui. Le premier appel est entièrement offert, sans carte bancaire, pour que vous et votre proche puissiez juger sur pièce avant tout engagement.",
    },
    {
      q: 'Comment résilier mon abonnement ?',
      a:
        "En deux clics depuis votre espace personnel, sans justificatif, sans appel à passer. Aucun engagement, aucun frais caché.",
    },
  ]

  return (
    <section id="faq" className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-12 items-start">
          <div className="md:sticky md:top-24">
            <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
              Vos questions
            </p>
            <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
              Questions fréquentes
            </h2>
            <p className="mt-5 text-brun-700 leading-relaxed">
              Tout ce qu'on nous demande le plus souvent. Une autre question ?{' '}
              <a href="#contact" className="text-terracotta-dark link-underline font-medium">
                Écrivez-nous.
              </a>
            </p>
          </div>

          <div className="md:col-span-2 space-y-3">
            {items.map((it, i) => (
              <details
                key={i}
                className="group bg-white rounded-xl border border-creme-sable overflow-hidden"
              >
                <summary className="flex items-start justify-between gap-6 px-6 py-5 text-brun-900 font-medium text-[17px] hover:bg-creme/40 transition-colors">
                  <span className="text-pretty">{it.q}</span>
                  <span className="faq-chevron mt-0.5 shrink-0 text-terracotta-dark">
                    <Icon.ChevronDown size={20} />
                  </span>
                </summary>
                <div className="px-6 pb-6 text-brun-700 leading-relaxed text-pretty">
                  {it.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
