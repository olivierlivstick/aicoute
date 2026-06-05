import { LegalLayout, Section, P, UL, LI, Mail } from '@/marketing/legal/LegalLayout'

export function RGPDPage() {
  return (
    <LegalLayout
      title="Protection des données (RGPD)"
      updated="5 juin 2026"
      intro={
        <P>
          Aicoute accorde une grande importance à la protection des données personnelles. Cette
          politique décrit quelles données sont traitées, pourquoi, sur quelle base légale, avec
          quels prestataires, et comment exercer vos droits, conformément au Règlement général sur
          la protection des données (RGPD) et à la loi « Informatique et Libertés ».
        </P>
      }
    >
      <Section title="1. Responsable de traitement">
        <P>
          Le service Aicoute est édité par la société Oaventure (EURL), qui agit en qualité de{' '}
          <strong>responsable de traitement</strong> des données traitées dans le cadre du service
          (cf. mentions légales).
        </P>
        <P>
          L'aidant qui souscrit au service renseigne des informations concernant un proche (le
          bénéficiaire) et configure les appels. Il lui appartient d'informer ce proche et de
          recueillir son accord préalable (voir « Personnes concernées et consentement » ci-dessous).
        </P>
        <P>
          Pour toute question relative à vos données, vous pouvez nous écrire à{' '}
          <Mail address="contact@aicoute.fr" />.
        </P>
      </Section>

      <Section title="2. Données traitées">
        <P>
          <strong>Visiteurs du site</strong>
        </P>
        <UL>
          <LI>
            Données de connexion techniques nécessaires au fonctionnement du site et mesure
            d'audience anonyme (sans cookie ni identification personnelle).
          </LI>
        </UL>
        <P>
          <strong>Aidant (titulaire du compte)</strong>
        </P>
        <UL>
          <LI>Identité et coordonnées : nom, prénom, e-mail, numéro de téléphone, fuseau horaire.</LI>
          <LI>Données de gestion du compte et de la relation commerciale (abonnement, facturation).</LI>
        </UL>
        <P>
          <strong>Bénéficiaire (la personne appelée, renseignée par l'aidant)</strong>
        </P>
        <UL>
          <LI>Identité : nom, prénom et numéro de téléphone sur lequel les appels sont passés.</LI>
          <LI>
            Éléments de personnalisation des conversations : histoire de vie, centres d'intérêt,
            goûts, préférences, fournis par l'aidant pour rendre les échanges chaleureux et
            pertinents.
          </LI>
          <LI>
            Contenu des échanges : transcription textuelle des appels, résumés, mémoire des sujets
            d'un appel à l'autre.
          </LI>
          <LI>
            <strong>Points d'attention (« signaux faibles ») :</strong> éléments relevés au fil des
            conversations qui peuvent concerner la santé, l'humeur, le moral, la mémoire ou
            l'autonomie de la personne. Ces informations constituent, le cas échéant, des{' '}
            <strong>données sensibles au sens de l'article 9 du RGPD</strong>.
          </LI>
          <LI>Métadonnées techniques d'appel : horodatage, durée, statut.</LI>
        </UL>
        <P>
          <strong>Enregistrement audio :</strong> la voix est traitée en temps réel pour permettre
          la conversation. L'enregistrement audio brut n'est pas conservé : seule la transcription
          textuelle est mémorisée (cf. durées de conservation).
        </P>
      </Section>

      <Section title="3. Finalités et bases légales">
        <UL>
          <LI>
            <strong>Fournir le service</strong> (passer les appels, tenir une conversation,
            produire les comptes-rendus) : exécution du contrat conclu avec l'aidant.
          </LI>
          <LI>
            <strong>Traiter les données de santé éventuelles</strong> figurant dans les points
            d'attention : <strong>consentement explicite</strong> de la personne concernée (article
            9.2.a du RGPD). La personne est informée qu'elle parle à une intelligence artificielle
            mandatée par son proche et peut refuser ou interrompre les appels à tout moment.
          </LI>
          <LI>
            <strong>Gérer les comptes et l'authentification</strong> : exécution du contrat.
          </LI>
          <LI>
            <strong>Répondre aux demandes de contact et de démonstration</strong> : mesures
            précontractuelles prises à votre demande et intérêt légitime à développer notre
            activité.
          </LI>
          <LI>
            <strong>Assurer la sécurité et le bon fonctionnement</strong> du service : intérêt
            légitime et obligations légales.
          </LI>
        </UL>
      </Section>

      <Section title="4. Sous-traitants et destinataires">
        <P>
          Les données ne sont jamais vendues. Elles sont accessibles aux personnels habilités de
          l'éditeur et aux prestataires techniques (sous-traitants) strictement nécessaires au
          service :
        </P>
        <UL>
          <LI>
            <strong>Supabase, Inc.</strong> — base de données, authentification et stockage (région :
            Union européenne).
          </LI>
          <LI>
            <strong>Render, Inc.</strong> — exécution du service de conversation vocale temps réel
            (région : Francfort, UE).
          </LI>
          <LI>
            <strong>Twilio Inc.</strong> — acheminement des appels téléphoniques (États-Unis).
          </LI>
          <LI>
            <strong>OpenAI</strong> — modèle vocal temps réel utilisé pour conduire la conversation
            (États-Unis). Les contenus transmis via l'API ne sont pas utilisés pour entraîner les
            modèles.
          </LI>
          <LI>
            <strong>Google</strong> — modèle vocal « Gemini Live » utilisé comme alternative pour
            conduire la conversation, selon le moteur choisi (États-Unis).
          </LI>
          <LI>
            <strong>Resend</strong> — envoi des e-mails transactionnels : comptes-rendus d'appel et
            alertes (États-Unis).
          </LI>
          <LI>
            <strong>Netlify, Inc.</strong> — hébergement du site et de l'application (États-Unis).
          </LI>
        </UL>
        <P>
          Les comptes-rendus d'appel sont adressés à l'aidant et, s'il les a désignés, aux proches
          qu'il a lui-même renseignés comme destinataires.
        </P>
      </Section>

      <Section title="5. Transferts de données hors de l'Union européenne">
        <P>
          Les données sont hébergées et stockées dans l'Union européenne (base de données Supabase
          en UE ; traitement vocal exécuté à Francfort). Certains prestataires techniques sont
          toutefois des sociétés établies aux États-Unis (OpenAI et Google pour les modèles
          vocaux, Twilio pour la téléphonie, Resend pour l'envoi des e-mails, Netlify pour
          l'hébergement du site).
        </P>
        <P>
          Les transferts qui en résultent sont encadrés par les garanties appropriées prévues par
          le RGPD, notamment les <strong>clauses contractuelles types</strong> de la Commission
          européenne et, le cas échéant, l'adhésion au <strong>Data Privacy Framework</strong>,
          complétées par des mesures techniques et organisationnelles.
        </P>
      </Section>

      <Section title="6. Durées de conservation">
        <UL>
          <LI>
            <strong>Compte aidant et profil du bénéficiaire :</strong> pendant toute la durée de
            l'abonnement, puis suppression ou anonymisation dans un délai de 12 mois après la fin de
            la relation.
          </LI>
          <LI>
            <strong>Transcriptions et comptes-rendus d'appels :</strong> 12 mois glissants, le temps
            utile à la continuité de la conversation.
          </LI>
          <LI>
            <strong>Enregistrement audio brut :</strong> non conservé (supprimé dans les 24 heures).
          </LI>
          <LI>
            <strong>Demandes de démonstration / prospects :</strong> 3 ans à compter du dernier
            contact.
          </LI>
          <LI>
            <strong>Journaux techniques :</strong> 12 mois maximum.
          </LI>
        </UL>
      </Section>

      <Section title="7. Sécurité">
        <P>
          L'éditeur met en œuvre des mesures techniques et organisationnelles appropriées pour
          protéger les données : chiffrement des échanges (HTTPS), cloisonnement des données par
          compte, contrôle des accès et authentification, hébergement chez des prestataires
          reconnus.
        </P>
      </Section>

      <Section title="8. Personnes concernées et consentement">
        <P>
          Les bénéficiaires sont des personnes majeures, parfois âgées, isolées ou vulnérables. La
          mise en place des appels suppose que la personne en soit informée et y consente.
        </P>
        <UL>
          <LI>
            L'aidant s'engage à informer le bénéficiaire et à recueillir son accord avant la mise en
            place des appels.
          </LI>
          <LI>
            L'intelligence artificielle se présente comme telle dès le premier appel : la personne
            sait qu'elle parle à une IA mandatée par son proche.
          </LI>
          <LI>
            La personne peut refuser un appel ou demander l'arrêt des appels à tout moment ; les
            appels suivants sont alors immédiatement suspendus.
          </LI>
        </UL>
      </Section>

      <Section title="9. Cookies">
        <P>
          Le site et l'application n'utilisent <strong>aucun cookie de mesure d'audience, de
          traçage ou de publicité</strong>. La fréquentation du site est mesurée au moyen d'une
          solution respectueuse de la vie privée (Umami), sans cookie. Seuls des cookies strictement
          nécessaires au fonctionnement (maintien de la session d'authentification) sont utilisés ;
          conformément à la réglementation, ils ne nécessitent pas de consentement préalable.
        </P>
      </Section>

      <Section title="10. Vos droits">
        <P>
          Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de
          limitation, d'opposition et de portabilité de vos données, ainsi que du droit de définir
          des directives relatives à leur sort après votre décès. Vous pouvez également retirer à
          tout moment votre consentement au traitement des données de santé.
        </P>
        <P>
          Pour exercer ces droits, écrivez à <Mail address="contact@aicoute.fr" />. Lorsque votre
          demande concerne les données d'un bénéficiaire, l'aidant qui gère le compte peut également
          consulter, corriger ou supprimer ces données directement depuis son espace personnel.
        </P>
        <P>
          Vous pouvez également introduire une réclamation auprès de la Commission nationale de
          l'informatique et des libertés (CNIL) : www.cnil.fr.
        </P>
      </Section>

      <Section title="11. Modifications">
        <P>
          La présente politique peut être mise à jour pour refléter les évolutions du service ou de
          la réglementation. La date de dernière mise à jour figure en haut de cette page.
        </P>
      </Section>
    </LegalLayout>
  )
}
