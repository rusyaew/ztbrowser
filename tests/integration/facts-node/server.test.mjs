import {afterEach, describe, expect, it} from 'vitest';
import {createServer} from 'node:http';
import {createApp} from '../../../facts-node/server.js';

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('server did not bind to a TCP port'));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}

const db = {
  schema_version: 2,
  releases: [
    {
      service: 'ztinfra-enclaveproducedhtml',
      release_id: 'v0.2.0',
      repo_url: 'https://github.com/rusyaew/ztinfra-enclaveproducedhtml',
      project_repo_url: 'https://github.com/rusyaew/ztbrowser',
      release_url: 'https://github.com/rusyaew/ztinfra-enclaveproducedhtml/releases/tag/v0.2.0',
      source_image_digest: 'sha256:abcd',
      legacy_workload_id: 'ztbrowser-aws-nitro',
      canonical: true,
      accepted_realizations: [
        {
          platform: 'aws_nitro_eif',
          identity: {
            type: 'eif_pcr_set',
            value: {pcr0: 'aa', pcr1: 'bb', pcr2: 'cc', pcr8: 'dd'},
          },
        },
        {
          platform: 'aws_coco_snp',
          identity: {
            type: 'coco_image_initdata',
            value: {image_digest: 'sha256:abcd', initdata_hash: 'ee'},
          },
        },
      ],
      legacy_projection: {
        workload_id: 'ztbrowser-aws-nitro',
        repo_url: 'https://github.com/rusyaew/ztinfra-enclaveproducedhtml',
        project_repo_url: 'https://github.com/rusyaew/ztbrowser',
        oci_image_digest: 'sha256:abcd',
        pcr0: 'aa',
        pcr1: 'bb',
        pcr2: 'cc',
        pcr8: 'dd',
        release_tag: 'v0.2.0',
        release_url: 'https://github.com/rusyaew/ztinfra-enclaveproducedhtml/releases/tag/v0.2.0',
        canonical: true,
        notes: 'test row',
      },
    },
  ],
};

const closers = [];

afterEach(async () => {
  while (closers.length > 0) {
    const close = closers.pop();
    if (close) {
      await close();
    }
  }
});

describe('facts-node server', () => {
  it('matches lookup-by-realization and returns legacy projection compatibility fields', async () => {
    const server = await listen(createApp(() => db));
    closers.push(server.close);

    const response = await fetch(`${server.baseUrl}/api/v1/lookup-by-realization`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        platform: 'aws_coco_snp',
        identity: {
          type: 'coco_image_initdata',
          value: {image_digest: 'sha256:abcd', initdata_hash: 'ee'},
        },
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.matched).toBe(true);
    expect(body.release.release_id).toBe('v0.2.0');
    expect(body.realization.platform).toBe('aws_coco_snp');
    expect(body.workload.workload_id).toBe('ztbrowser-aws-nitro');
  });

  it('rejects invalid lookup-by-realization payloads', async () => {
    const server = await listen(createApp(() => db));
    closers.push(server.close);

    const response = await fetch(`${server.baseUrl}/api/v1/lookup-by-realization`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({platform: 'aws_coco_snp'}),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({matched: false, reason: 'invalid_payload'});
  });
});
