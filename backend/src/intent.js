'use strict';

const INTENTS = {
  SITE_NAVIGATION: 'site_navigation',
  COURSE_RECOMMENDATION: 'course_recommendation',
  SECTION_EXPLAINER: 'section_explainer',
  PROGRESS_COMPLETION: 'progress_completion',
  GLOSSARY_POLICY: 'glossary_policy',
  OTHER: 'other',
};

function classifyIntent(text) {
  const q = (text || '').toLowerCase();
  const asksForCourseContents = (
    /(what|which|show|list|tell me).*(activities|activity|modules|module|lessons|lesson|topics|content|contents|covered|inside|include|included)/.test(q) &&
    /(course|programme|program|onboarding|induction|section|week|unit)/.test(q)
  ) || /(what('s| is)? in (the )?.*(course|programme|program|onboarding|section|week|unit))/.test(q);

  if (/where|find|navigate|menu|click|location|page|tab|settings/.test(q)) {
    return INTENTS.SITE_NAVIGATION;
  }
  if (
    /what does .* mean|define|definition|glossary|term mean|policy|policies|rule|rules|late submission|submission rule/.test(q)
  ) {
    return INTENTS.GLOSSARY_POLICY;
  }
  if (
    /what do i have left|what.*left|progress|completion|complete|completed|marked complete|mark complete|not complete|why.*complete/.test(q)
  ) {
    return INTENTS.PROGRESS_COMPLETION;
  }
  if (asksForCourseContents) {
    return INTENTS.SECTION_EXPLAINER;
  }
  if (/recommend|next course|what next|path|learning plan|study next|onboard|onboarding|induction|starter course|new starter/.test(q)) {
    return INTENTS.COURSE_RECOMMENDATION;
  }
  if (/explain|summari[sz]e|what does this mean|section|lesson/.test(q)) {
    return INTENTS.SECTION_EXPLAINER;
  }
  return INTENTS.OTHER;
}

module.exports = {
  INTENTS,
  classifyIntent,
};
