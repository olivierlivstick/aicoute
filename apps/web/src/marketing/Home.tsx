// Composition : Homepage MODECT (site vitrine public)
import { Header } from '@/marketing/components/Header'
import { Hero } from '@/marketing/components/Hero'
import { Stats } from '@/marketing/components/Stats'
import { Steps } from '@/marketing/components/Steps'
import { Benefits } from '@/marketing/components/Benefits'
import { EmailExample } from '@/marketing/components/EmailExample'
import { Security } from '@/marketing/components/Security'
import { Pricing } from '@/marketing/components/Pricing'
import { Experts } from '@/marketing/components/Experts'
import { FAQ } from '@/marketing/components/FAQ'
import { FinalCTA } from '@/marketing/components/FinalCTA'
import { Footer } from '@/marketing/components/Footer'

export function Home() {
  return (
    <div>
      <Header />
      <main>
        <Hero />
        <Stats />
        <Steps />
        <Benefits />
        <EmailExample />
        <Security />
        <Pricing />
        <Experts />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
