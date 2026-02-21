'use strict';

const INTENTS = {
  SITE_NAVIGATION: 'site_navigation',
  COURSE_RECOMMENDATION: 'course_recommendation',
  SECTION_EXPLAINER: 'section_explainer',
  OTHER: 'other',
};

function classifyIntent(text) {
  const q = (text || '').toLowerCase();

  if (/where|find|navigate|menu|click|location|page|tab|settings/.test(q)) {
    return INTENTS.SITE_NAVIGATION;
  }
  if (/recommend|next course|what next|path|learning plan|study next/.test(q)) {
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
