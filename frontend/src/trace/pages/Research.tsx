import { useEffect } from 'react';
import { Overview } from '@/trace/sections/research/Overview';
import { Questions } from '@/trace/sections/research/Questions';
import { Dataset } from '@/trace/sections/research/Dataset';
import { Methodology } from '@/trace/sections/research/Methodology';
import { EvaluationFramework } from '@/trace/sections/research/EvaluationFramework';
import { Results } from '@/trace/sections/research/Results';
import { ErrorAnalysis } from '@/trace/sections/research/ErrorAnalysis';
import { Explainability } from '@/trace/sections/research/Explainability';
import { Generalization } from '@/trace/sections/research/Generalization';
import { Conclusion } from '@/trace/sections/research/Conclusion';

/**
 * Research.
 *
 * Long-form, in the order a study is reported: what we set out to do, what we
 * asked, what data would answer it, how it would be built, how it would be
 * measured, what came out, where it fails, what it can be trusted to
 * generalise to, and what can be concluded. The structure follows the
 * TRIPOD+AI reporting guideline closely enough that a reader familiar with it
 * can find the section they want.
 */
export function TraceResearch() {
  useEffect(() => {
    document.title = 'Research · PULMO-TRACE';
  }, []);

  return (
    <>
      <Overview />
      <Questions />
      <Dataset />
      <Methodology />
      <EvaluationFramework />
      <Results />
      <ErrorAnalysis />
      <Explainability />
      <Generalization />
      <Conclusion />
    </>
  );
}
