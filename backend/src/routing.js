'use strict';

const { INTENTS } = require('./intent');

const DEFAULT_MODELS = {
  site_navigation: 'amazon.nova-lite-v1:0',
  course_recommendation: 'amazon.nova-pro-v1:0',
  section_explainer: 'amazon.nova-pro-v1:0',
  other: 'amazon.nova-lite-v1:0',
};

function routeModel(intent) {
  return DEFAULT_MODELS[intent] || DEFAULT_MODELS[INTENTS.OTHER];
}

module.exports = {
  routeModel,
};
