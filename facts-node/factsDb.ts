export type LegacyFactsRow = {
  workload_id: string;
  repo_url: string;
  project_repo_url?: string;
  oci_image_digest: string;
  pcr0: string;
  pcr1: string;
  pcr2: string;
  pcr8?: string | null;
  release_tag?: string;
  release_url?: string;
  canonical?: boolean;
  notes?: string;
  [key: string]: unknown;
};

export type IdentityValue = Record<string, unknown>;

export type AcceptedRealization = {
  platform: string;
  identity: {
    type: string;
    value: IdentityValue;
  };
  assets?: Record<string, string>;
};

export type ReleaseRecord = {
  service: string;
  release_id: string;
  repo_url: string;
  project_repo_url?: string;
  release_url?: string;
  source_image_digest?: string;
  legacy_workload_id?: string;
  canonical?: boolean;
  notes?: string;
  accepted_realizations: AcceptedRealization[];
  legacy_projection?: LegacyFactsRow;
};

export type FactsDbV2 = {
  schema_version: number;
  releases: ReleaseRecord[];
};

export function normalizeHex(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/^0x/i, '').toLowerCase();
  if (normalized.length === 0 || /^0+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortObject(nested)]),
  );
}

export function normalizeIdentityValue(value: IdentityValue): IdentityValue {
  const normalized = sortObject(value) as IdentityValue;
  const result: IdentityValue = {};
  for (const [key, nested] of Object.entries(normalized)) {
    if (typeof nested === 'string') {
      result[key] = nested.startsWith('sha256:') ? nested.toLowerCase() : normalizeHex(nested) ?? nested;
    } else {
      result[key] = nested;
    }
  }
  return result;
}

function releaseFromLegacyRow(row: LegacyFactsRow): ReleaseRecord {
  return {
    service: row.repo_url?.split('/').at(-1) || row.workload_id,
    release_id: row.release_tag || row.workload_id,
    repo_url: row.repo_url,
    project_repo_url: row.project_repo_url,
    release_url: row.release_url,
    source_image_digest: row.oci_image_digest,
    legacy_workload_id: row.workload_id,
    canonical: Boolean(row.canonical),
    notes: row.notes,
    accepted_realizations: [
      {
        platform: 'aws_nitro_eif',
        identity: {
          type: 'eif_pcr_set',
          value: {
            pcr0: normalizeHex(row.pcr0),
            pcr1: normalizeHex(row.pcr1),
            pcr2: normalizeHex(row.pcr2),
            pcr8: normalizeHex(row.pcr8 ?? null),
          },
        },
      },
    ],
    legacy_projection: row,
  };
}

export function normalizeFactsDb(raw: unknown): FactsDbV2 {
  if (Array.isArray(raw)) {
    return {
      schema_version: 2,
      releases: raw.map((row) => releaseFromLegacyRow(row as LegacyFactsRow)),
    };
  }

  if (raw && typeof raw === 'object') {
    const object = raw as { schema_version?: number; releases?: unknown };
    if (!Array.isArray(object.releases)) {
      throw new Error('Facts DB object must contain a releases array');
    }
    return {
      schema_version: Number(object.schema_version ?? 2),
      releases: object.releases as ReleaseRecord[],
    };
  }

  throw new Error('Facts DB must be an array of legacy rows or a v2 object');
}

export function releaseToLegacyProjection(release: ReleaseRecord, realization?: AcceptedRealization | null): LegacyFactsRow {
  const nitroRealization = realization?.platform === 'aws_nitro_eif'
    ? realization
    : release.accepted_realizations.find((entry) => entry.platform === 'aws_nitro_eif' && entry.identity.type === 'eif_pcr_set');
  const nitroIdentity = nitroRealization?.identity?.value ?? {};
  return {
    workload_id: release.legacy_workload_id || `${release.service}-legacy`,
    repo_url: release.repo_url,
    project_repo_url: release.project_repo_url,
    oci_image_digest: release.source_image_digest || '',
    pcr0: typeof nitroIdentity.pcr0 === 'string' ? nitroIdentity.pcr0 : '',
    pcr1: typeof nitroIdentity.pcr1 === 'string' ? nitroIdentity.pcr1 : '',
    pcr2: typeof nitroIdentity.pcr2 === 'string' ? nitroIdentity.pcr2 : '',
    pcr8: typeof nitroIdentity.pcr8 === 'string' ? nitroIdentity.pcr8 : null,
    release_tag: release.release_id,
    release_url: release.release_url,
    canonical: Boolean(release.canonical),
    notes: release.notes,
  };
}

export function findReleaseByPcrTuple(db: FactsDbV2, query: { pcr0?: string; pcr1?: string; pcr2?: string; pcr8?: string | null }) {
  for (const release of db.releases) {
    for (const realization of release.accepted_realizations) {
      if (realization.platform !== 'aws_nitro_eif' || realization.identity.type !== 'eif_pcr_set') {
        continue;
      }
      const value = realization.identity.value;
      if (
        normalizeHex(value.pcr0 as string | undefined) === normalizeHex(query.pcr0) &&
        normalizeHex(value.pcr1 as string | undefined) === normalizeHex(query.pcr1) &&
        normalizeHex(value.pcr2 as string | undefined) === normalizeHex(query.pcr2) &&
        normalizeHex((value.pcr8 as string | null | undefined) ?? null) === normalizeHex(query.pcr8 ?? null)
      ) {
        return { release, realization };
      }
    }
  }
  return null;
}

export function findReleaseByRealization(db: FactsDbV2, query: { platform?: string; identity?: { type?: string; value?: IdentityValue } }) {
  if (typeof query.platform !== 'string' || !query.identity || typeof query.identity.type !== 'string' || !query.identity.value || typeof query.identity.value !== 'object') {
    return null;
  }
  const normalizedQuery = normalizeIdentityValue(query.identity.value);
  for (const release of db.releases) {
    for (const realization of release.accepted_realizations) {
      if (realization.platform !== query.platform || realization.identity.type !== query.identity.type) {
        continue;
      }
      const normalizedExisting = normalizeIdentityValue(realization.identity.value);
      if (JSON.stringify(normalizedExisting) === JSON.stringify(normalizedQuery)) {
        return { release, realization };
      }
    }
  }
  return null;
}

export function listLegacyWorkloads(db: FactsDbV2): LegacyFactsRow[] {
  return db.releases.map((release) => releaseToLegacyProjection(release));
}
