import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  type FactsDbV2,
  type LegacyFactsRow,
  findReleaseByPcrTuple,
  findReleaseByRealization,
  listLegacyWorkloads,
  normalizeFactsDb,
  releaseToLegacyProjection,
} from './factsDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.FACTS_DB_PATH ?? path.join(__dirname, 'facts-db.json');
const port = Number(process.env.PORT ?? '7777');

function loadFacts(): FactsDbV2 {
  const raw = fs.readFileSync(dbPath, 'utf8');
  return normalizeFactsDb(JSON.parse(raw));
}

export function createApp(loadFactsImpl: () => FactsDbV2 = loadFacts) {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: true }));

  app.get('/api/v1/workloads/:workload_id', (req, res) => {
    const workloads = listLegacyWorkloads(loadFactsImpl());
    const workload = workloads.find((item) => item.workload_id === req.params.workload_id);
    if (!workload) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(workload);
  });

  app.get('/api/v1/workloads', (req, res) => {
    const rows = listLegacyWorkloads(loadFactsImpl());
    const repoFilter = typeof req.query.repo_url === 'string' ? req.query.repo_url : null;
    const filtered = repoFilter ? rows.filter((row) => row.repo_url === repoFilter) : rows;
    res.json({ workloads: filtered });
  });

  app.post('/api/v1/lookup-by-pcr', (req, res) => {
    const { pcr0, pcr1, pcr2, pcr8 } = req.body ?? {};
    if (typeof pcr0 !== 'string' || typeof pcr1 !== 'string' || typeof pcr2 !== 'string') {
      res.status(400).json({ matched: false, reason: 'invalid_payload' });
      return;
    }

    const match = findReleaseByPcrTuple(loadFactsImpl(), { pcr0, pcr1, pcr2, pcr8: typeof pcr8 === 'string' ? pcr8 : null });

    if (!match) {
      res.json({ matched: false });
      return;
    }

    res.json({
      matched: true,
      release: match.release,
      realization: match.realization,
      workload: releaseToLegacyProjection(match.release, match.realization),
    });
  });

  app.post('/api/v1/lookup-by-realization', (req, res) => {
    const { platform, identity } = req.body ?? {};
    if (typeof platform !== 'string' || !identity || typeof identity !== 'object') {
      res.status(400).json({ matched: false, reason: 'invalid_payload' });
      return;
    }

    const match = findReleaseByRealization(loadFactsImpl(), req.body ?? {});
    if (!match) {
      res.json({ matched: false });
      return;
    }

    res.json({
      matched: true,
      release: match.release,
      realization: match.realization,
      workload: releaseToLegacyProjection(match.release, match.realization),
    });
  });

  app.get('/', (_req, res) => {
    const rows = listLegacyWorkloads(loadFactsImpl());
    const bodyRows = rows
      .map((row) => {
        const cells = [
          row.workload_id,
          String(Boolean(row.canonical)),
          `<a href="${row.repo_url}" target="_blank" rel="noreferrer">${row.repo_url}</a>`,
          row.project_repo_url ? `<a href="${row.project_repo_url}" target="_blank" rel="noreferrer">${row.project_repo_url}</a>` : '',
          row.release_tag ?? '',
          row.commit_sha ?? '',
          row.oci_image_digest,
          row.eif_sha256 ?? '',
          row.describe_eif_sha256 ?? '',
          row.pcr0,
          row.pcr1,
          row.pcr2,
          row.pcr8 ?? '',
          row.release_url ? `<a href="${row.release_url}" target="_blank" rel="noreferrer">release</a>` : '',
          row.last_updated ?? ''
        ]
          .map((value) => `<td>${value}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ZTBrowser Facts Node</title>
  <style>
    body { font-family: sans-serif; margin: 16px; }
    .table-wrap { overflow: auto; border: 1px solid #ddd; max-height: 75vh; }
    table { border-collapse: collapse; min-width: 2600px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; position: sticky; top: 0; }
    td:nth-child(n+5) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <h1>ZTBrowser Facts Node</h1>
  <p>Public mapping of release realizations to workload provenance and legacy Nitro facts.</p>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>workload_id</th>
          <th>canonical</th>
          <th>repo_url</th>
          <th>project_repo_url</th>
          <th>release_tag</th>
          <th>commit_sha</th>
          <th>oci_image_digest</th>
          <th>eif_sha256</th>
          <th>describe_eif_sha256</th>
          <th>PCR0</th>
          <th>PCR1</th>
          <th>PCR2</th>
          <th>PCR8</th>
          <th>release_url</th>
          <th>last_updated</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
</body>
</html>`);
  });

  return app;
}

const entryHref = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryHref && import.meta.url === entryHref) {
  createApp().listen(port, () => {
    console.log(`Facts node listening on http://localhost:${port} using ${dbPath}`);
  });
}
