'use strict';

const { makeError } = require('./errors');

function mapBedrockError(err) {
  const name = err && err.name ? err.name : 'Error';
  const message = err && err.message ? err.message : 'Bedrock invocation failed';

  if (name === 'AccessDeniedException' || name === 'ValidationException') {
    return makeError('MODEL_ACCESS_DENIED', message, true);
  }
  if (name === 'ThrottlingException' || name === 'ServiceUnavailableException') {
    return makeError('TIMEOUT', message, true);
  }
  return makeError('INTERNAL_ERROR', message, false);
}

function extractText(output) {
  const content = output && output.message && Array.isArray(output.message.content)
    ? output.message.content
    : [];
  const textBlocks = content
    .filter((part) => part && typeof part.text === 'string')
    .map((part) => part.text.trim())
    .filter(Boolean);
  return textBlocks.join('\n');
}

async function converseWithBedrock({ region, modelId, userText, citations, maxTokens, temperature }) {
  let BedrockRuntimeClient;
  let ConverseCommand;

  try {
    ({ BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime'));
  } catch (_err) {
    throw makeError(
      'INTERNAL_ERROR',
      'Missing dependency @aws-sdk/client-bedrock-runtime. Install it to enable USE_BEDROCK=true.',
      false
    );
  }

  const systemPrompt = [
    'You are the NovaLXP learning assistant.',
    'Answer using the provided context only when the question needs catalog or course details.',
    'If context is insufficient, ask one concise clarifying question.',
    'Cite only the provided source titles in plain text.',
  ].join(' ');

  const contextBlock = citations.length
    ? citations
      .map((c, idx) => `${idx + 1}. [${c.title}] ${c.snippet}`)
      .join('\n')
    : 'No context retrieved.';

  const prompt = `User question: ${userText}\n\nRetrieved context:\n${contextBlock}`;

  const client = new BedrockRuntimeClient({ region });
  const command = new ConverseCommand({
    modelId,
    system: [{ text: systemPrompt }],
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: {
      maxTokens,
      temperature,
    },
  });

  try {
    const result = await client.send(command);
    const text = extractText(result.output);
    return {
      text: text || 'I could not generate a response.',
      usage: result.usage || {},
    };
  } catch (err) {
    throw mapBedrockError(err);
  }
}

module.exports = {
  converseWithBedrock,
};
