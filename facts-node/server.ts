import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type FactsRow = {
  workload_id: string;
  repo_url: string;
  oci_image_digest: string;
  pcr0: string;
  pcr1: string;
  pcr2: string;
  pcr8: string | null;
  nitro_cli_version?: string;
  build_timestamp?: string;
  last_updated?: string;
  notes?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.FACTS_DB_PATH ?? path.join(__dirname, 'facts-db.json');
const port = Number(process.env.PORT ?? '7777');

function normalizeHex(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return value.replace(/^0x/i, '').toLowerCase();
}

function loadFacts(): FactsRow[] {
  const raw = fs.readFileSync(dbPath, 'utf8');
  const parsed = JSON.parse(raw) as FactsRow[];
  return parsed;
}

function pcrTupleMatches(row: FactsRow, query: { pcr0?: string; pcr1?: string; pcr2?: string; pcr8?: string | null }): boolean {
  return (
    normalizeHex(row.pcr0) === normalizeHex(query.pcr0) &&
    normalizeHex(row.pcr1) === normalizeHex(query.pcr1) &&
    normalizeHex(row.pcr2) === normalizeHex(query.pcr2) &&
    normalizeHex(row.pcr8) === normalizeHex(query.pcr8 ?? null)
  );
}

const app = express();
app.use(express.json());
app.use(cors({ origin: true }));

app.get('/api/v1/workloads/:workload_id', (req, res) => {
  const rows = loadFacts();
  const row = rows.find((item) => item.workload_id === req.params.workload_id);
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(row);
});

app.get('/api/v1/workloads', (req, res) => {
  const rows = loadFacts();
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

  const rows = loadFacts();
  const match = rows.find((row) => pcrTupleMatches(row, { pcr0, pcr1, pcr2, pcr8: typeof pcr8 === 'string' ? pcr8 : null }));

  if (!match) {
    res.json({ matched: false });
    return;
  }

  res.json({ matched: true, workload: match });
});

app.get('/', (_req, res) => {
  const rows = loadFacts();
  const bodyRows = rows
    .map((row) => {
      const cells = [
        row.workload_id,
        `<a href="${row.repo_url}" target="_blank" rel="noreferrer">${row.repo_url}</a>`,
        row.oci_image_digest,
        row.pcr0,
        row.pcr1,
        row.pcr2,
        row.pcr8 ?? '',
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
    table { border-collapse: collapse; min-width: 1500px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; position: sticky; top: 0; }
    td:nth-child(n+3) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <h1>ZTBrowser Facts Node</h1>
  <p>Public mapping of workload source to EIF PCR facts.</p>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>workload_id</th>
          <th>repo_url</th>
          <th>oci_image_digest</th>
          <th>PCR0</th>
          <th>PCR1</th>
          <th>PCR2</th>
          <th>PCR8</th>
          <th>last_updated</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
</body>
</html>`);
});

app.listen(port, () => {
  console.log(`Facts node listening on http://localhost:${port} using ${dbPath}`);
});
