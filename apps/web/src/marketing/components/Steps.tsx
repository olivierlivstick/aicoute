// SECTION 3 — Comment ça marche (3 étapes)
import { Icon } from '@/marketing/components/icons'

export function Steps() {
  const steps = [
    {
      num: '01',
      Icon: Icon.UserPlus,
      title: 'Vous créez le profil de votre proche',
      text:
        "En quelques minutes, vous renseignez son prénom, son âge, ses centres d'intérêt, ses sujets de prédilection. Plus le contexte est riche, plus la conversation sera personnelle.",
    },
    {
      num: '02',
      Icon: Icon.Phone,
      title: 'Aicoute appelle — et reste joignable',
      text:
        "Une à plusieurs fois par semaine, à l'heure que vous avez définie, votre proche reçoit un appel chaleureux. Et entre deux rendez-vous, s'il a simplement envie de parler, il peut appeler Aicoute lui-même. Une voix douce, attentive, qui se souvient de la dernière conversation.",
    },
    {
      num: '03',
      Icon: Icon.Mail,
      title: 'Vous recevez un résumé par email',
      text:
        "Après chaque appel, un compte-rendu sensible vous arrive : humeur générale, sujets abordés, points d'attention éventuels, et la transcription complète si vous le souhaitez.",
    },
  ]

  return (
    <section id="comment" className="bg-creme-sable py-20 md:py-28">
      <div className="max-w-container mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-[0.18em] text-terracotta-dark mb-5">
            Le parcours
          </p>
          <h2 className="font-serif font-normal text-3xl md:text-4xl text-brun-900 leading-[1.15] text-balance">
            Trois étapes pour préserver le lien.
          </h2>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-12 md:gap-10 relative">
          {/* fil reliant les 3 étapes en desktop */}
          <div
            className="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-px bg-creme-sable"
            style={{ background: 'repeating-linear-gradient(to right, #C75D3A33 0 6px, transparent 6px 12px)' }}
            aria-hidden="true"
          />

          {steps.map(({ num, Icon: StepIcon, title, text }) => (
            <div key={num} className="relative">
              <div className="bg-creme rounded-full w-16 h-16 flex items-center justify-center text-terracotta border border-creme-sable relative z-10">
                <StepIcon size={26} />
              </div>
              <p className="mt-6 font-serif text-2xl text-ocre">{num}</p>
              <h3 className="mt-2 font-sans text-xl font-medium text-brun-900 text-balance">
                {title}
              </h3>
              <p className="mt-3 text-brun-700 leading-relaxed text-pretty">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
