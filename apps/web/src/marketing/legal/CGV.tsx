// CGV — vente à distance B2C des packs de minutes Aicoute (paiement unique Stripe).
// Trame GÉNÉRIQUE à relire et faire valider juridiquement.
// Décisions produit (2026-06-16) : service exécuté immédiatement avec renonciation
// expresse au droit de rétractation ; minutes sans durée de validité ; pas encore
// de médiateur de la consommation désigné (clause à compléter).
import { LegalLayout, Section, P, UL, LI, Mail } from '@/marketing/legal/LegalLayout'

export function CGVPage() {
  return (
    <LegalLayout
      title="Conditions générales de vente"
      updated="16 juin 2026"
      intro={
        <P>
          Les présentes conditions générales de vente (CGV) régissent les ventes de prestations et de
          crédits de minutes proposées sur le site aicoute.fr par la société Oaventure (cf. mentions
          légales). Elles s'appliquent à toute commande passée par un client, qu'il soit consommateur
          ou professionnel, et complètent nos conditions générales d'utilisation (CGU). En validant sa
          commande, le client déclare avoir pris connaissance des présentes CGV et les accepter sans
          réserve.
        </P>
      }
    >
      <Section title="1. Identité du vendeur">
        <UL>
          <LI>
            <strong>Dénomination sociale :</strong> Oaventure (EURL au capital de 1 000 €)
          </LI>
          <LI>
            <strong>Siège social :</strong> 13 bis avenue de la Motte-Picquet, 75007 Paris
          </LI>
          <LI>
            <strong>SIREN / RCS :</strong> 522 756 113 — RCS Paris
          </LI>
          <LI>
            <strong>TVA intracommunautaire :</strong> FR93522756113
          </LI>
          <LI>
            <strong>Contact :</strong> <Mail address="contact@aicoute.fr" />
          </LI>
        </UL>
      </Section>

      <Section title="2. Produits et services">
        <P>
          Aicoute est un service de compagnon conversationnel par téléphone : à la demande d'un aidant,
          une intelligence artificielle appelle régulièrement un proche, échange avec lui et adresse à
          l'aidant un compte-rendu de l'appel.
        </P>
        <P>
          Le service est commercialisé sous forme de <strong>packs de minutes prépayées</strong>, sans
          engagement ni reconduction automatique. Chaque pack ouvre un crédit de minutes de
          conversation, décompté à l'usage (chaque appel est arrondi à la minute supérieure). Les
          caractéristiques essentielles, le volume de minutes et le prix de chaque pack sont présentés
          sur la page Tarifs du site au moment de la commande.
        </P>
      </Section>

      <Section title="3. Prix">
        <P>
          Les prix sont indiqués en euros, toutes taxes comprises (TTC). Oaventure se réserve le droit
          de modifier ses prix à tout moment ; le pack est facturé sur la base du tarif en vigueur au
          moment de la validation de la commande. Les éventuels frais liés au moyen de paiement sont
          pris en charge par le vendeur, sauf mention contraire affichée avant le paiement.
        </P>
      </Section>

      <Section title="4. Commande">
        <P>
          La commande est passée en ligne depuis le site. Le client sélectionne un pack, vérifie le
          détail de sa commande puis procède au paiement. La vente est réputée conclue à la
          confirmation du paiement. Un récapitulatif de la commande est adressé par courriel.
        </P>
        <P>
          Le client peut commander en étant connecté à son espace personnel (le crédit est alors
          rattaché directement à son compte) ou en tant qu'invité (un <strong>code de minutes</strong>{' '}
          lui est alors transmis par courriel, à activer ensuite dans son espace personnel pour créditer
          son compte). Le code est strictement personnel, à usage unique, et ne peut être ni revendu ni
          échangé contre des espèces.
        </P>
      </Section>

      <Section title="5. Paiement">
        <P>
          Le paiement s'effectue en ligne, de manière sécurisée, par carte bancaire via notre
          prestataire de paiement <strong>Stripe</strong>. Oaventure n'a accès à aucune donnée bancaire
          du client, celles-ci étant traitées directement par Stripe. La commande n'est validée
          qu'après confirmation effective du paiement.
        </P>
      </Section>

      <Section title="6. Mise à disposition du service">
        <P>
          Le crédit de minutes est mis à disposition dès la confirmation du paiement (ou, pour un achat
          par code, dès l'activation du code dans l'espace personnel). Les minutes acquises{' '}
          <strong>n'ont pas de durée de validité</strong> : elles restent utilisables jusqu'à leur
          consommation complète.
        </P>
        <P>
          Le service constitue une présence de convivialité et de veille bienveillante ; il ne saurait
          se substituer à un dispositif d'urgence, à un suivi médical ou à une téléassistance. Oaventure
          met en œuvre les moyens raisonnables pour assurer la disponibilité du service, sans garantie
          d'absence totale d'interruption.
        </P>
      </Section>

      <Section title="7. Droit de rétractation">
        <P>
          Conformément aux articles L.221-18 et suivants du Code de la consommation, le consommateur
          dispose en principe d'un délai de quatorze (14) jours pour exercer son droit de rétractation
          d'un contrat conclu à distance, sans avoir à motiver sa décision.
        </P>
        <P>
          Toutefois, en validant sa commande, le client{' '}
          <strong>
            demande expressément l'exécution immédiate du service avant la fin du délai de
            rétractation et reconnaît que ce droit s'éteint
          </strong>{' '}
          dès lors que le service a été pleinement exécuté, c'est-à-dire dès la première minute de
          conversation consommée (article L.221-28, 1° du Code de la consommation).
        </P>
        <P>
          Tant qu'aucune minute n'a été consommée, le client peut exercer son droit de rétractation
          dans le délai de 14 jours en nous écrivant à <Mail address="contact@aicoute.fr" /> ; il est
          alors intégralement remboursé sous quatorze (14) jours, par le même moyen de paiement que
          celui utilisé pour la commande.
        </P>
      </Section>

      <Section title="8. Garanties légales">
        <P>
          Indépendamment de toute garantie commerciale, le client consommateur bénéficie de la garantie
          légale de conformité (articles L.217-3 et suivants du Code de la consommation) et de la
          garantie relative aux défauts de la chose vendue (articles 1641 et suivants du Code civil). En
          cas de service non conforme à ce qui était annoncé, le client peut nous contacter afin d'obtenir
          sa mise en conformité ou, à défaut, un remboursement.
        </P>
      </Section>

      <Section title="9. Responsabilité">
        <P>
          La responsabilité d'Oaventure ne saurait être engagée en cas d'inexécution ou de mauvaise
          exécution du contrat imputable au client, au fait imprévisible et insurmontable d'un tiers, ou
          à un cas de force majeure. De même, Oaventure ne saurait être tenue responsable des
          dysfonctionnements liés au réseau téléphonique, à la connexion Internet ou aux équipements du
          client ou du proche appelé.
        </P>
      </Section>

      <Section title="10. Données personnelles">
        <P>
          Les données personnelles collectées dans le cadre de la commande et de l'exécution du service
          sont traitées conformément à notre politique de protection des données (RGPD), qui détaille
          les finalités, les bases légales, les durées de conservation, les sous-traitants et les
          modalités d'exercice de vos droits.
        </P>
      </Section>

      <Section title="11. Réclamations et service client">
        <P>
          Pour toute question ou réclamation relative à une commande, le client peut contacter le
          service client à l'adresse <Mail address="contact@aicoute.fr" />. Nous nous engageons à
          apporter une réponse dans les meilleurs délais.
        </P>
      </Section>

      <Section title="12. Médiation de la consommation">
        <P>
          Conformément aux articles L.611-1 et suivants du Code de la consommation, le consommateur a le
          droit de recourir gratuitement à un médiateur de la consommation en vue de la résolution
          amiable d'un litige qui l'opposerait au vendeur, après avoir tenté au préalable de le résoudre
          par une réclamation écrite. Les coordonnées du médiateur compétent seront communiquées dans
          les présentes conditions dès leur désignation.
        </P>
        <P>
          Le consommateur peut également recourir à la plateforme européenne de règlement en ligne des
          litiges, accessible à l'adresse{' '}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-terracotta-dark font-medium link-underline"
          >
            ec.europa.eu/consumers/odr
          </a>
          .
        </P>
      </Section>

      <Section title="13. Droit applicable et litiges">
        <P>
          Les présentes CGV sont soumises au droit français. En cas de litige, et à défaut de résolution
          amiable, les tribunaux français seront seuls compétents dans les conditions prévues par la loi.
        </P>
      </Section>

      <Section title="14. Modification des CGV">
        <P>
          Oaventure peut faire évoluer les présentes CGV. Les conditions applicables à une commande sont
          celles en vigueur à la date de cette commande. La date de dernière mise à jour figure en haut
          de cette page.
        </P>
      </Section>
    </LegalLayout>
  )
}
