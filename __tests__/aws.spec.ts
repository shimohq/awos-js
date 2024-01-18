import * as http from 'http';
import * as url from 'url';

import AWS from '../src/aws';
import { IGetObjectResponse } from '../src/types';
const _ = require('lodash');

const prefix = 'test-awos-multi';
const client = new AWS({
  accessKeyID: process.env.AWS_ID!,
  accessKeySecret: process.env.AWS_SECRET!,
  bucket: process.env.AWS_BUCKET!,
  endpoint: process.env.ENDPOINT!,
  s3ForcePathStyle: true,
  prefix,
});
const key = 'test-awos';
const subDir = "multi"
const keys = _.times(10, (i: number) => `${subDir}/${i}/${i}`);
const content = 'hello, awos-js';
const contentType = 'image/jpeg';

it('should put() works fine', async () => {
  const meta = new Map<string, any>();
  meta.set('length', content.length);

  await client.put(key, content, {
    meta,
    contentType: contentType,
  });
});

it('should put() works fine', async () => {
  const key = 'test-awos-with-headers';
  const cacheControl = 'public, no-cache';
  const contentDisposition =
    'test_awos_filename.txt; filename="test_awos_filename.txt"; filename*=utf-8\'\'test_awos_filename.txt';
  const contentEncoding = 'identity';

  const meta = new Map<string, any>();
  meta.set('length', content.length);

  await client.put(key, content, {
    meta,
    contentType: 'text/plain',
    headers: {
      cacheControl,
      contentDisposition,
      contentEncoding,
    },
  });

  const signUrl = await client.signatureUrl(key);
  const parsedUrl = url.parse(signUrl!);
  const resHeaders = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
        port: parsedUrl.port,
      },
      (response) => {
        resolve(response.headers);
      }
    );
    req.end();
  });

  expect(resHeaders).toHaveProperty('cache-control');
  expect(resHeaders).toHaveProperty('content-disposition');
  expect(resHeaders).toHaveProperty('content-encoding');

  await client.del(key);
});

it('should copy() works fine', async () => {
  const copy = `${key}-copy`;
  const meta = new Map<string, any>();
  meta.set('length', content.length);

  await client.put(key, content, {
    meta,
    contentType: contentType,
  });
  await client.copy(copy, key, { meta, contentType: contentType });
  const s = await client.get(copy, ['length']);
  expect(s!.content).toEqual(content);
  expect(Number(s!.meta.get('length'))).toEqual(content.length);
  await client.del(copy);
});

it('should get() works fine', async () => {
  const res = (await client.get(key, ['length'])) as IGetObjectResponse;
  expect(res.content).toEqual(content);
  expect(res.meta.get('length')).toEqual(String(content.length));
  expect(res.headers['content-type']).toEqual(contentType);

  const res1 = await client.get(key + 'abc', ['length']);
  expect(res1).toEqual(null);
});

it('should head() works fine', async () => {
  const res = await client.head(key);
  expect(res!.get('length')).toEqual(String(content.length));
});

it('should listObject() works fine', async () => {
  const res = await client.listObject(key, {
    prefix: 'test',
    maxKeys: 5,
  });

  expect(res.length).toBeGreaterThanOrEqual(1);
  expect(res.length).toBeLessThanOrEqual(5);

  const notExistPrefixRes = await client.listObject(key, {
    prefix: 'test-aaaabbbbccccc',
    maxKeys: 5,
  });
  expect(notExistPrefixRes.length).toBe(0);
});

it('should listObjectV2() works fine', async () => {
  const res = await client.listObjectV2(key, {
    prefix: 'test',
    maxKeys: 5,
  });

  expect(res.length).toBeGreaterThanOrEqual(1);
  expect(res.length).toBeLessThanOrEqual(5);

  const notExistPrefixRes = await client.listObjectV2(key, {
    prefix: 'test-aaaabbbbccccc',
    maxKeys: 5,
  });
  expect(notExistPrefixRes.length).toBe(0);
});

it('should signatureUrl() works fine', async () => {
  const res = await client.signatureUrl(key);

  expect(res).toContain(
    `${process.env.ENDPOINT}/${process.env.AWS_BUCKET}/${key}`
  );
});

it('should delMulti() works fine', async () => {
  await Promise.all(
    keys.slice(0, 5).map((key) =>
      client.put(key, content, {
        contentType: contentType,
      })
    )
  );
  const r = await client.delMulti(keys);
  expect(r).toEqual([]);
});

it('should listDetails() works fine', async () => {
  await Promise.all(
    keys.map((key) =>
      client.put(key, content, {
        contentType: contentType,
      })
    )
  );
  {
    const res = await client.listDetails(key, {
      prefix: `${subDir}/`,
      delimiter: '/',
      maxKeys: 6,
    });
    expect(res.objects.length === 0);
    expect(res.prefixes.length === 6);
    expect(res.isTruncated).toBe(true);
    const res2 = await client.listDetails(key, {
      prefix: `${subDir}/`,
      delimiter: '/',
      marker: res.nextMarker,
      maxKeys: 6,
    });
    expect(res2.objects.length === 0);
    expect(res2.prefixes.length === 4);
    expect(res2.isTruncated).toBe(false);
  }
  {
    const res = await client.listDetails(key, {
      prefix: `${subDir}/`,
      maxKeys: 6,
    });
    expect(res.objects.length === 6);
    expect(res.prefixes.length === 0);
    expect(res.isTruncated).toBe(true);
    const res2 = await client.listDetails(key, {
      prefix: `${subDir}/`,
      marker: res.nextMarker,
      maxKeys: 6,
    });
    expect(res2.objects.length === 4);
    expect(res2.prefixes.length === 0);
    expect(res2.isTruncated).toBe(false);
  }
}, 10000);

it('should listDetailsV2() works fine', async () => {
  await Promise.all(
    keys.map((key) =>
      client.put(key, content, {
        contentType: contentType,
      })
    )
  );
  {
    const res = await client.listDetailsV2(key, {
      prefix: `${subDir}/`,
      delimiter: '/',
      maxKeys: 6,
    });
    expect(res.objects.length === 0);
    expect(res.prefix.length === 6);
    expect(res.isTruncated).toBe(true);
    const res2 = await client.listDetailsV2(key, {
      prefix: `${subDir}/`,
      delimiter: '/',
      continuationToken: res.nextContinuationToken,
      maxKeys: 6,
    });
    expect(res2.objects.length === 0);
    expect(res2.prefix.length === 4);
    expect(res2.isTruncated).toBe(false);
  }
  {
    const res = await client.listDetailsV2(key, {
      prefix: `${subDir}/`,
      maxKeys: 6,
    });
    expect(res.objects.length === 6);
    expect(res.prefix.length === 0);
    expect(res.isTruncated).toBe(true);
    const res2 = await client.listDetailsV2(key, {
      prefix: `${subDir}/`,
      continuationToken: res.nextContinuationToken,
      maxKeys: 6,
    });
    expect(res2.objects.length === 4);
    expect(res2.prefix.length === 0);
    expect(res2.isTruncated).toBe(false);
  }
}, 10000);

afterAll(async () => {
  await client.del(key);
  await client.delMulti(keys);
});
