import { LegalLayout, Section, P, UL, LI, Mail } from '@/marketing/legal/LegalLayout'

export function MentionsLegalesPage() {
  return (
    <LegalLayout
      title="Mentions légales"
      updated="5 juin 2026"
      intro={
        <P>
          Conformément à l'article 6 III de la loi n° 2004-575 du 21 juin 2004 pour la confiance
          dans l'économie numérique (LCEN), voici les informations relatives à l'éditeur et à
          l'hébergement du site aicoute.fr.
        </P>
      }
    >
      <Section title="1. Éditeur du site">
        <P>Le site aicoute.fr est édité par :</P>
        <UL>
          <LI>
            <strong>Dénomination sociale :</strong> Oaventure
          </LI>
          <LI>
            <strong>Forme juridique :</strong> Entreprise unipersonnelle à responsabilité limitée
            (EURL)
          </LI>
          <LI>
            <strong>Capital social :</strong> 1 000 €
          </LI>
          <LI>
            <strong>Siège social :</strong> 13 bis avenue de la Motte-Picquet, 75007 Paris
          </LI>
          <LI>
            <strong>SIREN :</strong> 522 756 113
          </LI>
          <LI>
            <strong>RCS :</strong> Paris 522 756 113
          </LI>
          <LI>
            <strong>N° de TVA intracommunautaire :</strong> FR93522756113
          </LI>
          <LI>
            <strong>Courriel :</strong> <Mail address="contact@aicoute.fr" />
          </LI>
        </UL>
      </Section>

      <Section title="2. Directeur de la publication">
        <P>
          Le directeur de la publication est Monsieur Olivier Adler, en sa qualité de gérant de la
          société Oaventure.
        </P>
      </Section>

      <Section title="3. Hébergement">
        <P>
          Le site et le service sont hébergés par les prestataires suivants. L'adresse postale
          exacte de chaque hébergeur est indiquée sur son site officiel.
        </P>
        <P>
          <strong>Site et application web</strong>
          <br />
          Netlify, Inc. — San Francisco, Californie, États-Unis — netlify.com
        </P>
        <P>
          <strong>Service de conversation vocale temps réel (pont d'appel)</strong>
          <br />
          Render, Inc. — région d'exécution : Francfort (Allemagne, Union européenne) — render.com
        </P>
        <P>
          <strong>Acheminement des appels téléphoniques</strong>
          <br />
          Twilio Inc. — États-Unis — twilio.com
        </P>
        <P>
          <strong>Base de données, authentification et stockage</strong>
          <br />
          Supabase, Inc. — région d'hébergement des données : Union européenne — supabase.com
        </P>
      </Section>

      <Section title="4. Propriété intellectuelle">
        <P>
          L'ensemble des éléments composant le site aicoute.fr (marque, logo, textes, interfaces,
          graphismes, code) est la propriété exclusive de l'éditeur ou fait l'objet d'une
          autorisation d'utilisation. Toute reproduction, représentation, modification ou
          exploitation, totale ou partielle, sans autorisation écrite préalable de l'éditeur est
          interdite et constitutive de contrefaçon.
        </P>
        <P>
          Les informations renseignées par les utilisateurs au sujet d'un proche ainsi que le
          contenu des échanges (transcriptions, comptes-rendus) restent la propriété des personnes
          concernées et ne sont traités que dans le cadre du service.
        </P>
      </Section>

      <Section title="5. Données personnelles">
        <P>
          Le traitement des données personnelles réalisé dans le cadre du site et du service est
          décrit dans notre politique de protection des données (RGPD). Vous y trouverez notamment
          les finalités, les bases légales, les durées de conservation, les sous-traitants et les
          modalités d'exercice de vos droits.
        </P>
      </Section>

      <Section title="6. Cookies">
        <P>
          Le site n'utilise aucun cookie publicitaire ni de traçage. La mesure d'audience est
          réalisée au moyen d'une solution respectueuse de la vie privée (Umami), sans cookie ni
          identification personnelle. Seuls des cookies strictement nécessaires au fonctionnement de
          l'espace personnel (session d'authentification) sont déposés ; ils ne requièrent pas votre
          consentement.
        </P>
      </Section>

      <Section title="7. Contact">
        <P>
          Pour toute question relative au site, vous pouvez nous écrire à{' '}
          <Mail address="contact@aicoute.fr" />.
        </P>
      </Section>
    </LegalLayout>
  )
}
