// Page situationnelle : /conseils/culpabilite-ne-pas-appeler-parents
import { ConseilsLayout, Lead, Section, P, UL, LI, A, Hr, ConseilsCTA } from '@/marketing/conseils/ConseilsLayout'

export function CulpabilitePage() {
  return (
    <ConseilsLayout
      title="Culpabilité de ne pas appeler ses parents âgés : que faire | Aicoute"
      description="Vous culpabilisez de ne pas appeler assez vos parents âgés ? Pourquoi c'est si fréquent, comment sortir du tout-ou-rien et mettre en place une présence durable."
      canonical="https://www.aicoute.fr/conseils/culpabilite-ne-pas-appeler-parents"
      h1="« Je culpabilise de ne pas appeler assez mes parents » : comment s'en sortir"
    >
      <Lead>
        Vous y pensez le soir, en vous couchant. Vous vous étiez dit « je l'appelle aujourd'hui », et
        la journée a filé. Encore. Et cette petite voix revient : <em>je ne fais pas assez.</em>
      </Lead>
      <P>
        Si vous lisez ces lignes, c'est que vous tenez à vos parents. La culpabilité que vous ressentez
        n'est pas le signe que vous les négligez — c'est le signe que vous les aimez, et que vous êtes
        débordé. Ce sont deux choses différentes, et il est possible de s'en sortir.
      </P>

      <Section title="Pourquoi vous culpabilisez (et pourquoi c'est si fréquent)">
        <P>
          Vous appartenez sans doute à ce qu'on appelle la « génération pivot » : prise en étau entre
          des enfants encore à charge, une vie professionnelle exigeante, et des parents qui
          vieillissent. Tout le monde réclame du temps, et il n'y en a jamais assez pour tout le monde.
        </P>
        <P>
          S'ajoute la distance, parfois, qui transforme un simple appel en rendez-vous qu'on n'arrive
          pas à caser. Et le sentiment, tenace, que quoi qu'on fasse, ce ne sera jamais à la hauteur de
          ce que nos parents ont fait pour nous.
        </P>
        <P>
          Cette culpabilité est extrêmement répandue. Elle n'est pas une faute. Mais laissée seule,
          elle épuise — et, paradoxalement, elle peut finir par éloigner, parce qu'on appréhende
          l'appel au lieu de l'attendre.
        </P>
      </Section>

      <Section title="Sortir du tout-ou-rien">
        <P>
          Le piège, c'est de penser en termes d'idéal impossible : « je devrais appeler tous les
          jours », « je devrais être présent ». Comme cet idéal est inatteignable, on ne tient pas, et
          on culpabilise de ne pas tenir. Le cercle se referme.
        </P>
        <P>La sortie passe par le réalisme :</P>
        <UL>
          <LI>
            <strong>Visez la régularité, pas la perfection.</strong> Un appel court mais fidèle, à un
            moment fixe de la semaine, vaut mieux qu'un idéal jamais atteint.
          </LI>
          <LI>
            <strong>Distinguez ce que vous pouvez tenir de ce que vous ne pouvez pas.</strong> Mieux
            vaut une promesse modeste tenue qu'une grande promesse abandonnée.
          </LI>
          <LI>
            <strong>Partagez la charge</strong> avec vos frères et sœurs, plutôt que de tout porter
            seul.
          </LI>
        </UL>
      </Section>

      <Section title="Une présence qui ne repose pas que sur vous">
        <P>
          Le vrai soulagement vient quand la présence auprès de votre parent ne dépend plus uniquement
          de votre disponibilité. Vous restez le lien essentiel — mais vous n'êtes plus le seul.
        </P>
        <P>
          Cela peut passer par un voisin, une aide à domicile, une association de visiteurs. Et, pour
          les jours où vous ne pouvez vraiment pas, par une présence régulière dédiée.
        </P>
        <P>
          C'est ce que nous proposons chez Aicoute : des appels téléphoniques réguliers à votre parent,
          une vraie conversation à son rythme, et un compte-rendu qui vous tient informé de comment il
          va. Soyons clairs — Aicoute ne remplace pas vos appels, et n'efface pas le lien irremplaçable
          que vous avez avec votre parent. Sa place est sur les jours creux, ceux où vous ne pouvez pas
          être là. L'idée n'est pas de vous remplacer, mais de vous soulager : une présence pour votre
          parent, et un peu moins de cette voix qui vous dit, le soir, que vous n'en faites pas assez.
        </P>
      </Section>

      <ConseilsCTA />

      <Hr />

      <P>
        <A href="/conseils/rompre-isolement-personne-agee">
          ← Voir toutes les solutions pour rompre l'isolement d'une personne âgée
        </A>
      </P>
    </ConseilsLayout>
  )
}
