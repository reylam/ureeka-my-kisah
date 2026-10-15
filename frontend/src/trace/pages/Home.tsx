import { useEffect } from 'react';
import { Hero } from '@/trace/sections/home/Hero';
import { ClinicalContext } from '@/trace/sections/home/ClinicalContext';
import { ResearchQuestions } from '@/trace/sections/home/ResearchQuestions';
import { PipelineSection } from '@/trace/sections/home/PipelineSection';
import { EvidencePreview } from '@/trace/sections/home/EvidencePreview';
import { Limitations } from '@/trace/sections/home/Limitations';
import { FinalCta } from '@/trace/sections/home/FinalCta';

/**
 * Home.
 *
 * Problem first, then the questions, then the system, then the evidence, then
 * the limitations. The technology appears third, not first, which is the one
 * structural decision that separates a research site from a product page.
 */
export function TraceHome() {
  useEffect(() => {
    document.title = 'PULMO-TRACE · AI-assisted TB screening research';
  }, []);

  return (
    <>
      <Hero />
      <ClinicalContext />
      <ResearchQuestions />
      <PipelineSection />
      <EvidencePreview />
      <Limitations />
      <FinalCta />
    </>
  );
}
