// Page pilier : /conseils/rompre-isolement-personne-agee
import { ConseilsLayout, Lead, Section, P, UL, LI, A, Hr, ConseilsCTA } from '@/marketing/conseils/ConseilsLayout'

export function RompreIsolementPage() {
  return (
    <ConseilsLayout
      title="Rompre l'isolement d'une personne âgée : les solutions | Aicoute"
      description="Visites, associations, aide à domicile, téléassistance, appels réguliers… Le guide des solutions concrètes pour rompre l'isolement d'un parent âgé et garder le lien."
      canonical="https://www.aicoute.fr/conseils/rompre-isolement-personne-agee"
      h1="Rompre l'isolement d'une personne âgée : les solutions qui existent vraiment"
    >
      <Lead>
        Quand un parent vieillit seul, on se sent souvent démuni. On voudrait l'aider, sans toujours
        savoir par où commencer ni à qui s'adresser. Bonne nouvelle : les solutions existent, elles
        sont nombreuses, et la plupart se combinent. Ce guide les passe en revue honnêtement — celles
        qui reposent sur le lien humain, celles du quotidien, celles qui sécurisent, et celles qui
        maintiennent le contact à distance.
      </Lead>

      <Section title="L'isolement des aînés, une réalité qui s'aggrave">
        <P>
          Avant les solutions, un constat. Selon le 3ᵉ Baromètre « Solitude et isolement » des Petits
          Frères des Pauvres (réalisé avec CSA Research et publié en septembre 2025), 750 000 personnes
          âgées vivent aujourd'hui en France en situation de « mort sociale », c'est-à-dire sans presque
          aucun contact humain. Elles étaient 300 000 en 2017 et 530 000 en 2021 : le phénomène ne
          recule pas, il s'accélère.
        </P>
        <P>
          Ces chiffres ne sont pas là pour faire peur, mais pour rappeler une chose simple : si votre
          parent souffre de solitude, vous n'êtes pas en train de surréagir. C'est un enjeu réel, et il
          se traite.
        </P>
      </Section>

      <Section title="Les solutions qui reposent sur le lien humain">
        <P>Rien ne remplace une présence humaine. C'est par là qu'il faut commencer.</P>
        <UL>
          <LI>
            <strong>Les visites régulières</strong>, les vôtres comme celles d'autres proches, voisins
            ou amis. La régularité compte plus que la durée.
          </LI>
          <LI>
            <strong>Les associations de lien social.</strong> Les Petits Frères des Pauvres organisent
            visites et accompagnements ; le dispositif Voisin-Âge met en relation des aînés et des
            voisins bienveillants. D'autres réseaux locaux existent selon les villes.
          </LI>
          <LI>
            <strong>Les clubs des aînés et activités collectives</strong> (municipalité, maisons des
            seniors, ateliers), quand votre parent est encore mobile et ouvert aux rencontres.
          </LI>
        </UL>
      </Section>

      <Section title="Les solutions du quotidien">
        <P>
          Certaines aides créent du lien sans en avoir l'air, parce qu'elles amènent une présence
          régulière à domicile.
        </P>
        <UL>
          <LI>
            <strong>L'aide à domicile (SAAD)</strong> : au-delà du ménage ou des repas, c'est un visage
            familier qui passe et qui veille.
          </LI>
          <LI>
            <strong>Le portage de repas</strong>, qui assure à la fois une bonne alimentation et un
            passage quotidien.
          </LI>
          <LI>
            <strong>L'accueil de jour</strong>, pour rompre la solitude quelques heures par semaine
            dans un cadre adapté.
          </LI>
        </UL>
      </Section>

      <Section title="Les solutions qui sécurisent">
        <UL>
          <LI>
            <strong>La téléassistance</strong> permet à votre parent d'alerter en cas de chute ou
            d'urgence. C'est souvent indispensable — mais gardez en tête que la téléassistance signale
            ce qui va mal ; elle ne dit pas si votre parent va bien au quotidien, ni s'il souffre de
            solitude.
          </LI>
        </UL>
      </Section>

      <Section title="Garder le lien, même à distance">
        <P>
          Quand on vit loin, le défi est double : maintenir le contact et savoir comment va son parent
          entre deux visites. Des appels réguliers restent le meilleur outil — encore faut-il pouvoir
          les tenir.
        </P>
        <P>
          C'est précisément la situation que nous accompagnons chez Aicoute : des appels téléphoniques
          réguliers passés à votre parent (et qu'il peut désormais passer lui-même quand l'envie de
          parler vient), suivis d'un compte-rendu qui vous tient informé. Disons-le franchement :
          Aicoute est un compagnon téléphonique, pas un être humain, et ne remplace ni vos appels, ni
          vos visites, ni la chaleur d'une famille. Sa place est sur les jours creux, ceux où personne
          ne passe. Une présence de plus, jamais une présence à la place.
        </P>
      </Section>

      <ConseilsCTA />

      <Section title="Comment en parler à votre parent sans le braquer">
        <P>
          Beaucoup d'aînés refusent l'aide par fierté ou par peur de « déranger ». Quelques principes
          aident : présenter chaque solution comme un confort et non comme un constat de dépendance,
          avancer par petites touches plutôt que tout proposer d'un coup, et impliquer votre parent
          dans le choix. Le but n'est pas de décider à sa place, mais de lui ouvrir des portes.
        </P>
      </Section>

      <Hr />

      <Section title="Pour aller plus loin selon votre situation">
        <UL>
          <LI>
            <A href="/conseils/parent-age-seul-vivre-loin">
              Votre parent vit seul et vous vivez loin →
            </A>
          </LI>
          <LI>
            <A href="/conseils/aider-parent-veuf-isolement">
              Aider un parent qui vient de perdre son conjoint →
            </A>
          </LI>
          <LI>
            <A href="/conseils/culpabilite-ne-pas-appeler-parents">
              « Je culpabilise de ne pas appeler assez mes parents » →
            </A>
          </LI>
        </UL>
      </Section>
    </ConseilsLayout>
  )
}
