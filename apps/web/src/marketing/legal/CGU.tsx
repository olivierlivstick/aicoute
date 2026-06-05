// CGU — contenu GÉNÉRIQUE provisoire, à relire et adapter juridiquement.
// (corraict.com n'a pas de page CGU ; ce texte est une trame de départ.)
import { LegalLayout, Section, P, UL, LI, Mail } from '@/marketing/legal/LegalLayout'

export function CGUPage() {
  return (
    <LegalLayout
      title="Conditions générales d'utilisation"
      updated="5 juin 2026"
      intro={
        <P>
          Les présentes conditions générales d'utilisation (CGU) encadrent l'accès et l'usage du
          service Aicoute, édité par la société Oaventure (cf. mentions légales). En créant un
          compte et en utilisant le service, l'utilisateur accepte les présentes conditions.
        </P>
      }
    >
      <Section title="1. Objet">
        <P>
          Aicoute est un service de compagnon conversationnel par téléphone : à la demande d'un
          aidant, une intelligence artificielle appelle régulièrement un proche, échange avec lui et
          adresse à l'aidant un compte-rendu de l'appel. Les présentes CGU définissent les modalités
          de mise à disposition du service ainsi que les droits et obligations des parties.
        </P>
      </Section>

      <Section title="2. Accès au service et compte">
        <P>
          L'accès au service nécessite la création d'un compte par l'aidant, qui s'engage à fournir
          des informations exactes et à préserver la confidentialité de ses identifiants. L'aidant
          est responsable des activités réalisées depuis son compte.
        </P>
      </Section>

      <Section title="3. Engagements de l'utilisateur">
        <UL>
          <LI>
            Informer le proche concerné de la mise en place des appels et recueillir son accord
            préalable.
          </LI>
          <LI>
            Utiliser le service de manière loyale, dans le respect des lois en vigueur et des droits
            des tiers.
          </LI>
          <LI>
            Ne fournir que des informations qu'il est en droit de communiquer et veiller à leur
            exactitude.
          </LI>
        </UL>
      </Section>

      <Section title="4. Disponibilité et responsabilité">
        <P>
          Aicoute met en œuvre les moyens raisonnables pour assurer la disponibilité et la qualité
          du service, sans garantie d'absence totale d'interruption. Le service constitue une
          présence de convivialité et de veille bienveillante ; il ne saurait se substituer à un
          dispositif d'urgence, à un suivi médical ou à une téléassistance. En cas de situation
          d'urgence, il convient de contacter les services compétents.
        </P>
      </Section>

      <Section title="5. Abonnement et résiliation">
        <P>
          Les conditions financières (formules, tarifs, période d'essai) sont présentées lors de la
          souscription. L'aidant peut résilier son abonnement à tout moment depuis son espace
          personnel, sans frais ni justificatif.
        </P>
      </Section>

      <Section title="6. Données personnelles">
        <P>
          Le traitement des données personnelles est décrit dans notre politique de protection des
          données (RGPD), qui fait partie intégrante des présentes conditions.
        </P>
      </Section>

      <Section title="7. Propriété intellectuelle">
        <P>
          Le service, sa marque et ses contenus sont protégés. Aucune disposition des présentes ne
          confère à l'utilisateur de droit de propriété sur ces éléments, en dehors du droit
          d'usage strictement nécessaire à l'utilisation du service.
        </P>
      </Section>

      <Section title="8. Modification des conditions">
        <P>
          Aicoute peut faire évoluer les présentes CGU. Les utilisateurs sont informés des
          modifications substantielles ; la date de dernière mise à jour figure en haut de cette
          page.
        </P>
      </Section>

      <Section title="9. Contact">
        <P>
          Pour toute question relative aux présentes conditions, vous pouvez nous écrire à{' '}
          <Mail address="contact@aicoute.fr" />.
        </P>
      </Section>
    </LegalLayout>
  )
}
