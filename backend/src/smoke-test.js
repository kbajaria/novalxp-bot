'use strict';

const { handler } = require('./handler');

async function run() {
  const event = {
    body: JSON.stringify({
      request_id: 'req-001',
      tenant_id: 'novalxp',
      user: { id: 'u-123', role: 'student', locale: 'en-GB' },
      context: { course_id: '101', section_id: '2' },
      query: { text: 'Can you recommend what to study next?' },
      options: { max_output_tokens: 400, require_citations: true, allow_model_fallback: true },
    }),
  };

  const res = await handler(event);
  console.log(res.statusCode);
  console.log(res.body);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
