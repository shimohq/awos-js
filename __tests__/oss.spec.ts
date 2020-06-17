import * as http from 'http';
import * as url from 'url';

import OSS from '../src/oss';

beforeAll(() => {
  this.oss = new OSS({
    accessKeyId: process.env.OSS_ID,
    accessKeySecret: process.env.OSS_SECRET,
    bucket: process.env.OSS_BUCKET,
    endpoint: process.env.ENDPOINT,
  });

  this.key = 'test-awos';
  this.content = 'hello, awos-js';
  this.contentType = 'image/jpeg';
});

it('should put() works fine', async () => {
  const meta = new Map<string, any>();
  meta.set('length', this.content.length);

  await this.oss.put(this.key, this.content, {
    meta,
    contentType: this.contentType,
  });
});

it('should put() with headers ok', async () => {
  const key = 'test-awos-with-headers';
  const cacheControl = 'public, no-cache';
  const contentDisposition =
    'test_awos_filename.txt; filename="test_awos_filename.txt"; filename*=utf-8\'\'test_awos_filename.txt';
  const contentEncoding = 'identity';

  const meta = new Map<string, any>();
  meta.set('length', this.content.length);

  await this.oss.put(key, this.content, {
    meta,
    contentType: 'text/plain',
    headers: {
      cacheControl,
      contentDisposition,
      contentEncoding,
    },
  });

  const signUrl = await this.oss.signatureUrl(key);
  const parsedUrl = url.parse(signUrl);
  const resHeaders = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
      },
      response => {
        resolve(response.headers);
      }
    );
    req.end();
  });

  expect(resHeaders).toHaveProperty('cache-control');
  expect(resHeaders).toHaveProperty('content-disposition');
  expect(resHeaders).toHaveProperty('content-encoding');

  await this.oss.del(key);
});

it('should get() works fine', async () => {
  const res = await this.oss.get(this.key, ['length']);
  expect(res.content).toEqual(this.content);
  expect(res.meta.get('length')).toEqual(String(this.content.length));
  expect(res.headers['content-type']).toEqual(this.contentType);

  const res1 = await this.oss.get(this.key + 'abc', ['length']);
  expect(res1).toEqual(null);
});

it('should head() works fine', async () => {
  const res = await this.oss.head(this.key);
  expect(res.get('length')).toEqual(String(this.content.length));
});

it('should listObject() works fine', async () => {
  const res = await this.oss.listObject(this.key, {
    prefix: 'test',
    maxKeys: 5,
  });

  expect(res.length).toBeGreaterThanOrEqual(1);
  expect(res.length).toBeLessThanOrEqual(5);

  const notExistPrefixRes = await this.oss.listObject(this.key, {
    prefix: 'test-aaaabbbbccccc',
    maxKeys: 5,
  });
  expect(notExistPrefixRes.length).toBe(0);
});

it('should signatureUrl() works fine', async () => {
  const res = await this.oss.signatureUrl(this.key);
  let protocol = 'http://';
  if (!process.env.ENDPOINT.includes(protocol)) {
    protocol = 'https://';
  }
  const suffix = process.env.ENDPOINT.substr(protocol.length);

  expect(res).toContain(
    `${protocol}${process.env.OSS_BUCKET}.${suffix}/${this.key}`
  );
});

afterAll(async () => {
  await this.oss.del(this.key);
});
