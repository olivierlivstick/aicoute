// Composition : Homepage MODECT (site vitrine public)
import { useEffect } from 'react'
import { Header } from '@/marketing/components/Header'
import { Hero } from '@/marketing/components/Hero'
import { Stats } from '@/marketing/components/Stats'
import { Steps } from '@/marketing/components/Steps'
import { Demo } from '@/marketing/components/Demo'
import { Benefits } from '@/marketing/components/Benefits'
import { EmailExample } from '@/marketing/components/EmailExample'
import { Security } from '@/marketing/components/Security'
import { Pricing } from '@/marketing/components/Pricing'
import { Experts } from '@/marketing/components/Experts'
import { FAQ } from '@/marketing/components/FAQ'
import { Contact } from '@/marketing/components/Contact'
import { FinalCTA } from '@/marketing/components/FinalCTA'
import { Footer } from '@/marketing/components/Footer'

export function Home() {
  // Arrivée sur la home via une ancre (ex. /#tarifs depuis une sous-page) : le
  // scroll natif tombe à côté car il se déclenche avant la fin de l'hydratation
  // et du chargement des images (le hero décale la mise en page). On scrolle donc
  // nous-mêmes vers la section après le 1er rendu, puis on re-corrige au `load`
  // (images posées). Effet client-only → sans impact sur le prérendu/l'hydratation.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const scrollToTarget = () => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ block: 'start' })
    }
    const raf = requestAnimationFrame(scrollToTarget)
    window.addEventListener('load', scrollToTarget)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('load', scrollToTarget)
    }
  }, [])

  return (
    <div>
      <Header />
      <main>
        <Hero />
        <Stats />
        <Steps />
        <Demo />
        <Benefits />
        <EmailExample />
        <Security />
        <Pricing />
        <Experts />
        <FAQ />
        <Contact />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
