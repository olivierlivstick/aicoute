import { LegalLayout, Section, P, Mail } from '@/marketing/legal/LegalLayout'

export function CharteEthiquePage() {
  return (
    <LegalLayout
      title="Notre charte éthique"
      updated="9 juin 2026"
      intro={
        <>
          <P>
            Aicoute s'adresse à des personnes parfois fragiles, souvent seules. Confier un peu de
            cette solitude à une intelligence artificielle n'a rien d'anodin, et nous prenons cette
            responsabilité au sérieux.
          </P>
          <P className="mt-3">
            Cette charte n'est pas un argument commercial. C'est l'ensemble des engagements que nous
            tenons envers les personnes accompagnées et leurs proches — et que vous êtes en droit de
            nous opposer. Nous l'avons écrite avant tout pour nous tenir nous-mêmes à un standard,
            dans un domaine où la confiance ne se réclame pas&nbsp;: elle se mérite.
          </P>
        </>
      }
    >
      <Section title="1. Nous ne faisons jamais semblant d'être humains">
        <P>
          La personne qui échange avec Aicoute sait qu'elle parle à une intelligence artificielle.
          Nous ne cherchons jamais à entretenir l'illusion d'un échange humain, ni à exploiter une
          éventuelle confusion. Notre métier est d'écouter avec justesse et attention — pas de
          tromper.
        </P>
      </Section>

      <Section title="2. Nous complétons la présence humaine, nous ne la remplaçons pas">
        <P>
          Aicoute n'a pas vocation à devenir le seul lien d'une personne avec le monde. Nous existons
          pour soutenir le lien familial et social, jamais pour s'y substituer. Une bonne utilisation
          d'Aicoute, c'est une personne qui se sent <strong>plus</strong> reliée à ses proches, pas
          plus dépendante de nous. C'est la mesure à laquelle nous tenons notre service.
        </P>
      </Section>

      <Section title="3. La personne accompagnée reste libre et actrice">
        <P>
          Elle peut appeler quand elle le souhaite, refuser un appel, écourter une conversation ou
          cesser d'utiliser le service à tout moment, sans avoir à se justifier. Nous nous adressons
          à elle comme à une personne à part entière, jamais avec condescendance. Son autonomie et sa
          dignité priment toujours.
        </P>
      </Section>

      <Section title="4. Rien ne se fait sans l'accord de la personne concernée">
        <P>
          Un proche peut mettre en place le service, mais la personne accompagnée doit y consentir.
          Nous refusons de devenir un outil de surveillance imposé à quelqu'un à son insu. La
          confiance se construit avec elle, pas seulement autour d'elle.
        </P>
      </Section>

      <Section title="5. Ce qui se dit reste protégé">
        <P>
          Les conversations relèvent de l'intime. Les données sont traitées dans le strict respect du
          RGPD, sécurisées, et ne sont jamais cédées ni revendues à des tiers. Les comptes rendus
          partagés avec les proches servent à maintenir le lien — la personne accompagnée sait qu'ils
          existent. Nous ne pratiquons aucune écoute secrète.
        </P>
      </Section>

      <Section title="6. Face à une inquiétude, nous ne restons pas seuls">
        <P>
          Aicoute n'est pas un service d'urgence ni un dispositif médical. Mais lorsqu'une
          conversation laisse paraître une détresse ou une situation préoccupante, nous avons un
          protocole pour alerter les bonnes personnes — proches et, si nécessaire, secours. Nous ne
          laissons jamais une alerte sans suite.
        </P>
      </Section>

      <Section title="7. Nous sommes honnêtes sur ce qu'Aicoute n'est pas">
        <P>
          Aicoute n'est ni un médecin, ni un psychologue, ni un service d'urgence, ni un substitut à
          l'amour et à la présence de ceux qui comptent. Nous le disons clairement, parce que la
          confiance commence par reconnaître ses propres limites.
        </P>
      </Section>

      <Section title="8. Nous ne profitons jamais de la vulnérabilité">
        <P>
          Nous n'utilisons pas l'attachement ou le besoin de présence pour pousser à consommer
          davantage. Notre tarification est claire, sans piège, et conçue pour servir la personne —
          jamais pour tirer parti de sa solitude.
        </P>
      </Section>

      <div className="pt-2 border-t border-creme-sable">
        <P className="italic text-brun-700/80 mt-6">
          Cette charte est un engagement vivant. Elle évolue avec notre service, et nous nous tenons
          à votre disposition pour en répondre à tout moment.
        </P>
        <P className="mt-3">
          Une question sur ces engagements&nbsp;? Écrivez-nous à <Mail address="contact@aicoute.fr" />.
        </P>
      </div>
    </LegalLayout>
  )
}
