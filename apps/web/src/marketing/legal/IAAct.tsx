import { LegalLayout, Section, P, UL, LI, Mail } from '@/marketing/legal/LegalLayout'

export function IAActPage() {
  return (
    <LegalLayout
      title="Conformité au Règlement européen sur l'IA (IA Act)"
      updated="5 juin 2026"
      intro={
        <P>
          Aicoute (société Oaventure) intègre des technologies d'intelligence artificielle au cœur
          de son service. Nous considérons l'encadrement de l'IA comme une responsabilité, au même
          titre que la protection des données personnelles. Cette page décrit notre démarche de mise
          en conformité avec le Règlement (UE) 2024/1689 (« IA Act »), en complément de notre
          politique de protection des données (RGPD) et de nos mentions légales. Le cadre s'applique
          de manière progressive ; nous adaptons nos engagements au calendrier réglementaire et
          tenons cette page à jour à mesure que les obligations entrent en application.
        </P>
      }
    >
      <Section title="Notre rôle au regard du règlement">
        <P>
          Au sens de l'IA Act, Oaventure agit en qualité de <strong>déployeur</strong> : nous
          intégrons et utilisons des modèles et services d'IA vocale fournis par des tiers (modèles
          d'IA à usage général d'OpenAI et de Google) pour proposer nos fonctionnalités. Nous ne
          développons pas nos propres modèles de fondation.
        </P>
        <P>
          À ce titre, nous sélectionnons des fournisseurs qui s'engagent eux-mêmes dans une démarche
          de conformité, et nous utilisons leurs systèmes conformément aux instructions et
          conditions qu'ils prévoient.
        </P>
      </Section>

      <Section title="Cadre réglementaire et calendrier">
        <P>L'IA Act est en vigueur depuis le 1er août 2024 et s'applique par étapes :</P>
        <UL>
          <LI>
            Depuis février 2025 : interdiction des pratiques d'IA à risque inacceptable (notation
            sociale, manipulation, certains usages biométriques) et obligation de littératie en IA
            des équipes.
          </LI>
          <LI>
            Depuis août 2025 : obligations applicables aux fournisseurs de modèles d'IA à usage
            général.
          </LI>
          <LI>
            Échéances à venir : les obligations propres aux systèmes d'IA à haut risque, ainsi que
            les règles de transparence renforcée, entrent en application sur un calendrier qui
            s'étale jusqu'en 2027-2028 selon la nature des systèmes.
          </LI>
        </UL>
        <P>
          Notre démarche anticipe ces échéances : nous préparons dès maintenant la documentation, la
          gouvernance et les contrôles requis, sans attendre leur caractère contraignant.
        </P>
      </Section>

      <Section title="Nos engagements concrets">
        <P>
          Notre service s'adresse à des personnes parfois âgées ou vulnérables ; nous y portons une
          attention particulière au travers des mesures suivantes :
        </P>
        <UL>
          <LI>
            <strong>Transparence.</strong> L'intelligence artificielle se présente comme telle dès
            la première seconde du premier appel : la personne sait qu'elle parle à une IA mandatée
            par son proche, et la finalité de l'échange est expliquée en termes compréhensibles.
          </LI>
          <LI>
            <strong>Supervision humaine.</strong> Les résultats produits par l'IA (résumés, points
            d'attention) sont conçus comme une aide à la décision destinée à l'aidant, contrôlable
            et corrigeable, et non comme une décision automatisée. L'IA ne pose aucun diagnostic et
            ne prend aucune décision médicale.
          </LI>
          <LI>
            <strong>Aucune pratique interdite.</strong> Nous n'employons pas l'IA pour des finalités
            prohibées par le règlement : pas de notation sociale, pas de manipulation, pas
            d'exploitation de la vulnérabilité des personnes, pas de surveillance biométrique non
            autorisée. Le service vise uniquement à maintenir un lien bienveillant et à alerter les
            proches.
          </LI>
          <LI>
            <strong>Usage conforme et maîtrisé.</strong> Nous utilisons les systèmes d'IA tiers
            conformément à leur destination et aux instructions de leurs fournisseurs, et nous
            surveillons leur fonctionnement dans le cadre de nos opérations.
          </LI>
          <LI>
            <strong>Journalisation et traçabilité.</strong> Nous conservons les éléments permettant
            de retracer le fonctionnement du service, dans le respect des durées et finalités
            applicables.
          </LI>
          <LI>
            <strong>Qualité et pertinence des données.</strong> Nous veillons à la pertinence des
            données d'entrée que nous maîtrisons et à la limitation des biais, en lien avec nos
            obligations de protection des données.
          </LI>
          <LI>
            <strong>Sélection des fournisseurs.</strong> Nous privilégions des fournisseurs d'IA
            engagés dans une démarche de conformité documentée et offrant les garanties techniques
            et contractuelles correspondantes.
          </LI>
          <LI>
            <strong>Compétence des équipes.</strong> Nous formons et sensibilisons nos
            collaborateurs concernés à un usage maîtrisé et responsable de l'IA (obligation de
            littératie en IA).
          </LI>
        </UL>
      </Section>

      <Section title="Articulation avec le RGPD">
        <P>
          Lorsque nos traitements d'IA impliquent des données personnelles, ils s'inscrivent dans le
          respect du RGPD : base légale, minimisation, information des personnes, exercice des droits
          et, le cas échéant, analyse d'impact relative à la protection des données (AIPD). La
          conformité IA Act et la conformité RGPD sont conduites de façon coordonnée.
        </P>
      </Section>

      <Section title="Gouvernance et contact">
        <P>
          La conformité IA est suivie en interne par notre référent conformité IA. Pour toute
          question relative à nos usages de l'intelligence artificielle, à la supervision humaine ou
          à l'exercice de vos droits :
        </P>
        <P>
          Oaventure — 13 bis avenue de la Motte-Picquet, 75007 Paris
          <br />
          Contact : <Mail address="contact@aicoute.fr" />
        </P>
        <P className="text-sm">
          Ce document décrit nos engagements et notre démarche de mise en conformité avec le
          Règlement (UE) 2024/1689. Il ne constitue pas une déclaration de conformité à des
          obligations qui ne sont pas encore pleinement applicables, et est susceptible d'évolution
          en fonction du cadre réglementaire et de ses textes d'application.
        </P>
      </Section>
    </LegalLayout>
  )
}
