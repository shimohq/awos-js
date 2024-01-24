import * as http from 'http';
import * as url from 'url';
const _ = require('lodash');
import { build } from '../src/index';

const prefix = 'test-awos';
const oss = build({
  storageType: 'oss',
  accessKeyID: process.env.OSS_ID!,
  accessKeySecret: process.env.OSS_SECRET!,
  bucket: process.env.OSS_BUCKET!,
  endpoint: process.env.ENDPOINT!,
  prefix,
});
const key = 'test-awos';
const multiSubDir = 'multi';
const keys = _.times(10, (i: number) => `${multiSubDir}/${i}/${i}`);
const content = 'hello, awos-js';
const contentType = 'image/jpeg';

it('should put() works fine', async () => {
  const meta = new Map<string, any>();
  meta.set('length', content.length);

  await oss.put(key, content, {
    meta,
    contentType: contentType,
  });
});

it('should copy() works fine', async () => {
  const copy = `${key}-copy`;
  const meta = new Map<string, any>();
  meta.set('length', content.length);

  await oss.put(key, content, {
    meta,
    contentType: contentType,
  });
  await oss.copy(copy, key, { meta, contentType: contentType });
  const s = await oss.get(copy, ['length']);
  expect(s.content).toEqual(content);
  expect(Number(s.meta.get('length'))).toEqual(content.length);
  await oss.del(copy);
});

it('should put() with headers ok', async () => {
  const key = 'test-awos-with-headers';
  const cacheControl = 'public, no-cache';
  const contentDisposition =
    'test_awos_filename.txt; filename="test_awos_filename.txt"; filename*=utf-8\'\'test_awos_filename.txt';
  const contentEncoding = 'identity';

  const meta = new Map<string, any>();
  meta.set('length', content.length);

  await oss.put(key, content, {
    meta,
    contentType: 'text/plain',
    headers: {
      cacheControl,
      contentDisposition,
      contentEncoding,
    },
  });

  const signUrl = await oss.signatureUrl(key);
  const parsedUrl = url.parse(signUrl);
  const resHeaders = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
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

  await oss.del(key);
});

it('should get() works fine', async () => {
  const res = await oss.get(key, ['length']);
  expect(res.content).toEqual(content);
  expect(res.meta.get('length')).toEqual(String(content.length));
  expect(res.headers['content-type']).toEqual(contentType);

  const res1 = await oss.get(key + 'abc', ['length']);
  expect(res1).toEqual(null);
});

it('should head() works fine', async () => {
  const res = await oss.head(key);
  expect(res.get('length')).toEqual(String(content.length));
});

it('should listObject() works fine', async () => {
  const res = await oss.listObject(key, {
    prefix: 'test',
    maxKeys: 5,
  });

  expect(res.length).toBeGreaterThanOrEqual(1);
  expect(res.length).toBeLessThanOrEqual(5);

  const notExistPrefixRes = await oss.listObject(key, {
    prefix: 'test-aaaabbbbccccc',
    maxKeys: 5,
  });
  expect(notExistPrefixRes.length).toBe(0);
});

it('should listObjectV2() works fine', async () => {
  const res = await oss.listObjectV2(key, {
    prefix: 'test',
    maxKeys: 5,
  });

  expect(res.length).toBeGreaterThanOrEqual(1);
  expect(res.length).toBeLessThanOrEqual(5);

  const notExistPrefixRes = await oss.listObjectV2(key, {
    prefix: 'test-aaaabbbbccccc',
    maxKeys: 5,
  });
  expect(notExistPrefixRes.length).toBe(0);
});

it('should signatureUrl() works fine', async () => {
  const res = await oss.signatureUrl(key);
  let protocol = 'http://';
  if (!process.env.ENDPOINT.includes(protocol)) {
    protocol = 'https://';
  }
  const suffix = process.env.ENDPOINT.substr(protocol.length);

  expect(res).toContain(
    `${protocol}${process.env.OSS_BUCKET}.${suffix}/${key}`
  );
});

it.only('should delMulti() works fine', async () => {
  await Promise.all(
    keys.slice(0, 5).map((key) =>
      oss.put(key, content, {
        contentType: contentType,
      })
    )
  );
  const r = await oss.delMulti(keys);
  expect(r).toEqual([]);
});

it.only('should listDetails() works fine', async () => {
  await Promise.all(
    keys.map((key) =>
      oss.put(key, content, {
        contentType: contentType,
      })
    )
  );
  {
    const res = await oss.listDetails(keys[0], {
      prefix: `${multiSubDir}/`,
      delimiter: '/',
      maxKeys: 6,
    });
    expect(res.objects.length === 0);
    expect(res.prefixes.length === 6);
    console.log(res.objects);
    expect(res.isTruncated).toBe(true);
    const res2 = await oss.listDetails(keys[0], {
      prefix: `${multiSubDir}/`,
      delimiter: '/',
      marker: res.nextMarker,
      maxKeys: 6,
    });
    console.log(res2.objects);
    expect(res2.objects.length === 0);
    expect(res2.prefixes.length === 4);
    expect(res2.isTruncated).toBe(false);
  }
  {
    const res = await oss.listDetails(keys[0], {
      prefix: `${multiSubDir}/`,
      maxKeys: 6,
    });
    expect(res.objects.length === 6);
    expect(res.prefixes.length === 0);
    expect(res.isTruncated).toBe(true);
    const res2 = await oss.listDetails(keys[0], {
      prefix: `${multiSubDir}/`,
      marker: res.nextMarker,
      maxKeys: 6,
    });
    console.log(res2.objects);
    expect(res2.objects.length === 4);
    expect(res2.prefixes.length === 0);
    expect(res2.isTruncated).toBe(false);
  }
  await oss.delMulti(keys);
});

it.only('should listDetailsV2() works fine', async () => {
  await Promise.all(
    keys.map((key) =>
      oss.put(key, content, {
        contentType: contentType,
      })
    )
  );

  {
    const res = await oss.listDetailsV2(keys[0], {
      prefix: `${multiSubDir}/`,
      delimiter: '/',
      maxKeys: 6,
    });
    console.log(res);
    expect(res.objects.length === 0);
    expect(res.prefix.length === 6);
    expect(res.isTruncated).toBe(true);
    const res2 = await oss.listDetailsV2(keys[0], {
      prefix: `${multiSubDir}/`,
      delimiter: '/',
      continuationToken: res.nextContinuationToken,
      maxKeys: 6,
    });
    console.log(res2);
    expect(res2.objects.length === 0);
    expect(res2.prefix.length === 4);
    expect(res2.isTruncated).toBe(false);
  }
  {
    const res = await oss.listDetailsV2(keys[0], {
      prefix: `${multiSubDir}/`,
      maxKeys: 6,
    });
    expect(res.objects.length === 6);
    expect(res.prefix.length === 0);
    expect(res.isTruncated).toBe(true);
    const res2 = await oss.listDetailsV2(keys[0], {
      prefix: `${multiSubDir}/`,
      continuationToken: res.nextContinuationToken,
      maxKeys: 6,
    });
    expect(res2.objects.length === 4);
    expect(res2.prefix.length === 0);
    expect(res2.isTruncated).toBe(false);
  }
  await oss.delMulti(keys);
});

afterAll(async () => {
  await oss.del(key);
});
