'use strict';

const { INTENTS } = require('./intent');
const { config } = require('./config');

function routeModel(intent) {
  return config.modelByIntent[intent] || config.modelByIntent[INTENTS.OTHER];
}

module.exports = {
  routeModel,
};
