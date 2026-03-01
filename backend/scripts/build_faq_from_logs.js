#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = {
    input: '',
    output: path.resolve(process.cwd(), 'backend/data/faq_corpus.json'),
    minCount: 2,
    maxDocs: 200,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--input' && argv[i + 1]) {
      args.input = argv[++i];
    } else if (a === '--output' && argv[i + 1]) {
      args.output = argv[++i];
    } else if (a === '--min-count' && argv[i + 1]) {
      args.minCount = Math.max(1, Number(argv[++i]) || 2);
    } else if (a === '--max-docs' && argv[i + 1]) {
      args.maxDocs = Math.max(1, Number(argv[++i]) || 200);
    }
  }
  return args;
}

function readInput(inputPath) {
  if (!inputPath || inputPath === '-') {
    return fs.readFileSync(0, 'utf8');
  }
  return fs.readFileSync(path.resolve(process.cwd(), inputPath), 'utf8');
}

function parseLogJsonLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const start = line.indexOf('{');
    const end = line.lastIndexOf('}');
    if (start < 0 || end <= start) {
      continue;
    }
    const candidate = line.slice(start, end + 1);
    try {
      const obj = JSON.parse(candidate);
      if (obj && obj.query_hash && obj.query_canonical) {
        out.push(obj);
      }
    } catch (_err) {
      // Ignore non-JSON lines.
    }
  }
  return out;
}

function titleCase(s) {
  return String(s || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

function buildFaqDocs(records, { minCount, maxDocs }) {
  const grouped = new Map();
  for (const r of records) {
    const key = String(r.query_hash || '').trim();
    if (!key) {
      continue;
    }
    if (!grouped.has(key)) {
      grouped.set(key, {
        count: 0,
        queryCanonical: String(r.query_canonical || '').trim(),
        queryAnon: String(r.query_text_anon || '').trim(),
        intentCounts: new Map(),
        topCitationTitle: String(r.top_citation_title || '').trim(),
        topCitationUrl: String(r.top_citation_url || '').trim(),
        answerPreview: String(r.answer_preview_anon || '').trim(),
      });
    }
    const row = grouped.get(key);
    row.count += 1;
    const intent = String(r.intent || 'other');
    row.intentCounts.set(intent, (row.intentCounts.get(intent) || 0) + 1);
    if (!row.topCitationUrl && r.top_citation_url) {
      row.topCitationUrl = String(r.top_citation_url);
    }
    if (!row.topCitationTitle && r.top_citation_title) {
      row.topCitationTitle = String(r.top_citation_title);
    }
    if (!row.answerPreview && r.answer_preview_anon) {
      row.answerPreview = String(r.answer_preview_anon);
    }
  }

  const docs = [...grouped.entries()]
    .map(([hash, row]) => ({ hash, ...row }))
    .filter((r) => r.count >= minCount && r.queryCanonical)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxDocs)
    .map((r) => {
      const topIntent = [...r.intentCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      const intent = topIntent ? topIntent[0] : 'other';
      const canonicalQuestion = titleCase(r.queryAnon || r.queryCanonical);
      const sourceTitle = r.topCitationTitle || 'NovaLXP Help';
      const url = r.topCitationUrl || '/my/';
      const answerHint = r.answerPreview || `See ${sourceTitle} for the current answer.`;
      return {
        source_id: `faq_${r.hash}`,
        title: `FAQ: ${canonicalQuestion}`,
        url,
        snippet: `Frequently asked (${r.count}x). Q: ${canonicalQuestion}. A: ${answerHint}`,
        tags: ['faq', 'recurring_question', intent],
      };
    });

  return docs;
}

function main() {
  const args = parseArgs(process.argv);
  const raw = readInput(args.input);
  const records = parseLogJsonLines(raw);
  const docs = buildFaqDocs(records, args);
  const outDir = path.dirname(path.resolve(process.cwd(), args.output));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.resolve(process.cwd(), args.output), JSON.stringify(docs, null, 2));
  process.stdout.write(`FAQ corpus generated: ${args.output} (docs: ${docs.length}, records: ${records.length})\n`);
}

main();
