// SECTION 9 — FAQ (arborescence 2 niveaux : catégories → accordéon de Q/R)
import { useId, useState } from 'react'
import { Icon } from '@/marketing/components/icons'

type QA = { q: string; a: string }
type Category = { title: string; items: QA[] }

const CATEGORIES: Category[] = [
  {
    title: 'Comment ça marche',
    items: [
      {
        q: 'Comment Aicoute se souvient-il des conversations précédentes ?',
        a:
          "Chaque conversation est résumée puis indexée dans la mémoire dédiée à votre proche : les sujets récurrents, les personnes mentionnées, les événements importants. L'IA peut ainsi reprendre le fil naturellement d'un appel à l'autre.",
      },
      {
        q: "Sur quel numéro l'appel est-il passé ?",
        a:
          "Sur le numéro de ligne fixe ou mobile que vous renseignez lors de la création du profil. Vous pouvez le modifier à tout moment depuis votre espace personnel.",
      },
      {
        q: "Que se passe-t-il si mon proche dit quelque chose d'inquiétant ?",
        a:
          "Tout signal sensible — douleur physique, déprime, chute évoquée, sujet préoccupant — est remonté dans la section « Point d'attention » de votre résumé. Vous pouvez aussi activer une alerte par email en temps réel pour être prévenu·e sans attendre le résumé.",
      },
      {
        q: 'Mon proche peut-il appeler Aicoute lui-même ?',
        a:
          "Aicoute appelle votre proche à la fréquence que vous avez définie. Mais, votre proche peut aussi appeler Aicoute de lui-même, lorsqu'il en ressent le besoin — un soir un peu solitaire, une envie de raconter sa journée, un moment sans visite. La présence ne dépendra plus seulement du calendrier : elle sera là aussi quand l'envie vient.",
      },
      {
        q: 'Puis-je suivre plusieurs proches depuis un seul compte ?',
        a:
          "Oui. Un même compte peut réunir plusieurs bénéficiaires — vos deux parents, un parent et une tante… Chacun garde son profil, sa fréquence d'appel et son historique, et vous retrouvez tous leurs résumés au même endroit. Vos minutes forment un solde unique, que vous répartissez librement entre vos proches selon les besoins de chacun.",
      },
    ],
  },
  {
    title: 'Essayer Aicoute',
    items: [
      {
        q: 'Peut-on tester Aicoute avant de payer ?',
        a:
          "Oui. Le premier appel est entièrement offert, sans carte bancaire, pour que vous et votre proche puissiez juger sur pièce avant tout engagement.",
      },
    ],
  },
  {
    title: 'Tarifs & minutes',
    items: [
      {
        q: 'Comment fonctionnent les minutes ?',
        a:
          "Vous achetez un pack de minutes de conversation — par exemple 100 minutes. À chaque appel, seul le temps réellement passé à échanger avec votre proche est décompté. Une conversation dure en moyenne 7 à 10 minutes, et vous voyez votre solde restant à tout moment dans votre espace personnel.",
      },
      {
        q: "Pourquoi un tarif à la minute plutôt qu'un abonnement ?",
        a:
          "Parce que chaque famille a son rythme : un appel par semaine pour les uns, un rendez-vous quotidien pour les autres. Payer au temps réel de conversation, c'est ne payer que pour la présence dont votre proche a besoin — ni plus, ni moins.",
      },
      {
        q: 'Les appels passés par mon proche consomment-ils des minutes ?',
        a:
          "Oui, ils sont décomptés de votre solde comme les appels d'Aicoute — mais des garde-fous évitent toute mauvaise surprise. Par défaut, ces appels sont limités à 10 minutes par conversation et à un appel par jour. Vous pouvez ajuster ces limites, ou les désactiver, à tout moment depuis votre espace personnel.",
      },
      {
        q: 'Et si mon proche ne décroche pas, ou si l\'appel est très court ?',
        a:
          "Vous ne payez que les conversations qui ont vraiment lieu. Un appel sans réponse, une sonnerie dans le vide ou un échange interrompu au bout de quelques secondes ne consomment aucune minute. Nous ne décomptons que le temps de présence réel.",
      },
      {
        q: "Mes minutes ont-elles une date d'expiration ?",
        a:
          "Vos minutes restent valables 6 mois après l'achat — de quoi tenir votre rythme sereinement, même en cas de pause (vacances, hospitalisation…). Rien ne se déclenche tant qu'il vous reste des minutes.",
      },
      {
        q: 'Que se passe-t-il quand mon pack est presque épuisé ?',
        a:
          "Nous vous prévenons par email bien avant la fin, pour que le lien ne s'interrompe jamais à votre insu. Vous pouvez alors racheter un pack en deux clics, ou activer la recharge automatique pour ne plus jamais y penser.",
      },
      {
        q: 'La recharge automatique est-elle obligatoire ?',
        a:
          "Non, jamais. C'est une simple option, que vous activez si vous le souhaitez et désactivez quand vous voulez, sans justificatif. Elle existe uniquement pour celles et ceux qui veulent garantir une présence sans interruption à leur proche.",
      },
      {
        q: 'Suis-je engagé sur la durée ?',
        a:
          "Non, aucun engagement. Vous achetez des minutes quand vous en avez besoin, c'est tout : pas de prélèvement mensuel, rien à résilier. La seule exception est la recharge automatique, si vous l'activez — et elle se désactive en deux clics.",
      },
    ],
  },
  {
    title: 'Transparence & consentement',
    items: [
      {
        q: 'Mon proche va-t-il comprendre qu\'il parle à une IA ?',
        a:
          "Oui, en toute transparence. Dès la première seconde du premier appel, Aicoute se présente comme une IA mandatée par vous. Cette honnêteté est au cœur de notre démarche — et la plupart de nos utilisateurs trouvent cela rassurant plutôt que dérangeant.",
      },
      {
        q: "Mon proche peut-il refuser d'être appelé ?",
        a:
          "Absolument et à tout moment. Pendant l'appel il lui suffit de le dire ; les appels suivants sont immédiatement suspendus et vous êtes informé·e. Le respect du consentement prime sur tout le reste.",
      },
    ],
  },
  {
    title: 'Confidentialité & sécurité',
    items: [
      {
        q: "Que devient l'enregistrement de l'appel après le résumé ?",
        a:
          "L'enregistrement audio brut est supprimé dans les 24 heures. Seule la transcription textuelle est conservée pendant 12 mois glissants, le temps utile à la continuité de la conversation. Vous pouvez tout effacer à la demande.",
      },
    ],
  },
]

export function FAQ() {
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

          <div className="md:col-span-2 space-y-10">
            {CATEGORIES.map((cat) => (
              <section key={cat.title} aria-label={cat.title}>
                <h3 className="font-serif text-xl text-brun-900 mb-4">
                  {cat.title}
                </h3>
                <div className="space-y-3">
                  {cat.items.map((it) => (
                    <FaqItem key={it.q} item={it} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FaqItem({ item }: { item: QA }) {
  const [open, setOpen] = useState(false)
  const uid = useId()
  const btnId = `faq-btn-${uid}`
  const panelId = `faq-panel-${uid}`

  return (
    <div className="bg-white rounded-xl border border-creme-sable overflow-hidden">
      <h4 className="m-0">
        <button
          type="button"
          id={btnId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-start justify-between gap-6 px-6 py-5 text-left text-brun-900 font-medium text-[17px] hover:bg-creme/40 transition-colors"
        >
          <span className="text-pretty">{item.q}</span>
          <span
            className={`mt-0.5 shrink-0 text-terracotta-dark transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <Icon.ChevronDown size={20} />
          </span>
        </button>
      </h4>
      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        hidden={!open}
        className="px-6 pb-6 text-brun-700 leading-relaxed text-pretty"
      >
        {item.a}
      </div>
    </div>
  )
}
