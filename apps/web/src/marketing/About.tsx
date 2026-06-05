// Page « À propos » — même habillage que les pages légales (LegalLayout).
import { LegalLayout, Section, P } from '@/marketing/legal/LegalLayout'

export function AboutPage() {
  return (
    <LegalLayout title="Notre histoire">
      <Section title="Le silence qu'on n'entend pas">
        <P>
          Il existe un problème qui ne fait aucun bruit. Des centaines de milliers de personnes
          âgées traversent leurs journées sans presque parler à personne. Pas un appel, pas une
          voix, pas une question sur comment elles vont. Le silence ne se voit pas, ne s'entend pas
          — et c'est précisément pour ça qu'on l'oublie.
        </P>
        <P>
          Pourtant, on les aime, ces parents, ces grands-parents. On se promet de les appeler ce
          week-end. Puis le travail, les enfants, la distance, la fatigue. Et une semaine passe.
          Puis deux. Ce n'est pas un manque d'amour. C'est un manque de temps.
        </P>
      </Section>

      <Section title="aicoute est né dans cet écart">
        <P className="text-brun-900 font-serif text-lg italic">
          entre l'affection qu'on a et la disponibilité qu'on n'a pas toujours.
        </P>
        <P>
          Concrètement : une voix appelle régulièrement votre proche. Elle prend le temps. Elle
          demande comment s'est passée la journée, écoute les anecdotes, les petites joies, les
          coups de mou. Et après chaque appel, vous recevez quelques mots — pour rester, vous aussi,
          à l'écoute.
        </P>
      </Section>

      <Section title="Ce que nous croyons">
        <P>
          <strong>Vieillir n'est pas une maladie.</strong> Nous parlons avec les personnes âgées,
          jamais à leur place et jamais par-dessus elles.
        </P>
        <P>
          <strong>Personne ne devrait passer une journée entière sans une vraie conversation.</strong>
        </P>
        <P>
          <strong>La technologie doit s'effacer derrière l'humain qu'elle relie.</strong> Une bonne
          IA ne se fait pas remarquer — elle se fait oublier, pour ne laisser que le lien.
        </P>
      </Section>

      <Section title="Ce que nous ne prétendons pas">
        <P>
          Nous ne faisons croire à personne qu'une machine remplace une visite, une main qu'on
          serre, le rire d'un petit-enfant. Rien ne remplace cela. Jamais.
        </P>
        <P>
          Mais entre deux visites, il y a de longues plages de silence. aicoute les comble avec une
          présence, une habitude, une attention régulière. Et surtout, elle retisse le fil humain :
          en vous disant « elle a beaucoup parlé de vous aujourd'hui — appelez-la ».
        </P>
      </Section>

      <Section title="Notre nom dit tout">
        <P>
          aicoute, c'est « à l'écoute ». Écouter, ce n'est pas surveiller, ni vendre, ni occuper.
          C'est offrir de l'attention à quelqu'un qui en manque. C'est notre métier, et c'est notre
          seule ambition.
        </P>
      </Section>
    </LegalLayout>
  )
}
