// Composition : Homepage MODECT (site vitrine public)
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { Stats } from '@/components/Stats'
import { Steps } from '@/components/Steps'
import { Benefits } from '@/components/Benefits'
import { EmailExample } from '@/components/EmailExample'
import { Security } from '@/components/Security'
import { Pricing } from '@/components/Pricing'
import { Experts } from '@/components/Experts'
import { FAQ } from '@/components/FAQ'
import { FinalCTA } from '@/components/FinalCTA'
import { Footer } from '@/components/Footer'

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
