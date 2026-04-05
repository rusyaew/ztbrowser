import { describe, expect, it } from 'vitest';

import {
  findReleaseByPcrTuple,
  findReleaseByRealization,
  normalizeFactsDb,
  releaseToLegacyProjection,
} from '../../../facts-node/factsDb.js';

describe('factsDb', () => {
  it('normalizes legacy Nitro rows into a v2 release record', () => {
    const db = normalizeFactsDb([
      {
        workload_id: 'legacy-workload',
        repo_url: 'https://github.com/example/demo-service',
        project_repo_url: 'https://github.com/rusyaew/ztbrowser',
        oci_image_digest: 'sha256:abc123',
        pcr0: '11'.repeat(48),
        pcr1: '22'.repeat(48),
        pcr2: '33'.repeat(48),
        pcr8: '44'.repeat(48),
        release_tag: 'v0.1.0',
      },
    ]);

    expect(db.schema_version).toBe(2);
    expect(db.releases).toHaveLength(1);
    expect(db.releases[0].accepted_realizations[0]).toEqual({
      platform: 'aws_nitro_eif',
      identity: {
        type: 'eif_pcr_set',
        value: {
          pcr0: '11'.repeat(48),
          pcr1: '22'.repeat(48),
          pcr2: '33'.repeat(48),
          pcr8: '44'.repeat(48),
        },
      },
    });
  });

  it('matches a release by normalized realization identity and preserves the legacy workload projection', () => {
    const imageDigest = `sha256:${'12'.repeat(32)}`;
    const db = normalizeFactsDb({
      schema_version: 2,
      releases: [
        {
          service: 'ztinfra-enclaveproducedhtml',
          release_id: 'v0.1.3',
          repo_url: 'https://github.com/rusyaew/ztinfra-enclaveproducedhtml',
          project_repo_url: 'https://github.com/rusyaew/ztbrowser',
          release_url: 'https://example.test/releases/v0.1.3',
          source_image_digest: imageDigest,
          legacy_workload_id: 'ztbrowser-aws-nitro',
          canonical: true,
          accepted_realizations: [
            {
              platform: 'aws_nitro_eif',
              identity: {
                type: 'eif_pcr_set',
                value: {
                  pcr0: '11'.repeat(48),
                  pcr1: '22'.repeat(48),
                  pcr2: '33'.repeat(48),
                  pcr8: null,
                },
              },
            },
            {
              platform: 'aws_coco_snp',
              identity: {
                type: 'coco_image_initdata',
                value: {
                  image_digest: imageDigest,
                  initdata_hash: 'ab'.repeat(32),
                },
              },
            },
          ],
        },
      ],
    });

    const cocoMatch = findReleaseByRealization(db, {
      platform: 'aws_coco_snp',
      identity: {
        type: 'coco_image_initdata',
        value: {
          initdata_hash: 'AB'.repeat(32),
          image_digest: imageDigest.toUpperCase(),
        },
      },
    });

    expect(cocoMatch?.release.release_id).toBe('v0.1.3');
    expect(releaseToLegacyProjection(cocoMatch.release, cocoMatch.realization)).toMatchObject({
      workload_id: 'ztbrowser-aws-nitro',
      repo_url: 'https://github.com/rusyaew/ztinfra-enclaveproducedhtml',
      oci_image_digest: imageDigest,
      release_tag: 'v0.1.3',
    });

    const nitroMatch = findReleaseByPcrTuple(db, {
      pcr0: '11'.repeat(48),
      pcr1: '22'.repeat(48),
      pcr2: '33'.repeat(48),
      pcr8: null,
    });
    expect(nitroMatch?.release.release_id).toBe('v0.1.3');
  });
});
