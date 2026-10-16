import { useEffect } from 'react';
import { PROJECT } from '@/trace/data/content';
import { Hero } from '@/trace/sections/home/Hero';
import { WhyItMatters } from '@/trace/sections/home/WhyItMatters';
import { HowItWorksSection } from '@/trace/sections/home/HowItWorksSection';
import { CanAndCannot } from '@/trace/sections/home/CanAndCannot';
import { Limits } from '@/trace/sections/home/Limits';
import { FinalCta } from '@/trace/sections/home/FinalCta';

/**
 * Home.
 *
 * The problem first, then how the thing works, then what a result does and
 * does not mean, then the limits. The technology turns up third, not first,
 * which is the one structural decision that stops this reading as a product
 * pitch.
 */
export function TraceHome() {
  useEffect(() => {
    document.title = `PARUPINTAS · ${PROJECT.subtitle}`;
  }, []);

  return (
    <>
      <Hero />
      <WhyItMatters />
      <HowItWorksSection />
      <CanAndCannot />
      <Limits />
      <FinalCta />
    </>
  );
}
