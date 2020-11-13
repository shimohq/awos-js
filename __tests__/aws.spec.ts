import * as http from 'http';
import * as url from 'url';

import AWS from '../src/aws';
const _ = require('lodash');

beforeAll(() => {
  // test with minio
  this.aws = new AWS({
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET,
    bucket: process.env.AWS_BUCKET,
    endpoint: process.env.ENDPOINT,
    s3ForcePathStyle: true,
  });

  this.key = 'test-awos';
  this.prefix = 'test-awos-multi'
  this.keys = _.times(10, (i: number) => `${this.prefix}/${i}/${i}`)
  this.content = 'hello, awos-js';
  this.contentType = 'image/jpeg';
});

it('should put() works fine', async () => {
  const meta = new Map<string, any>();
  meta.set('length', this.content.length);

  await this.aws.put(this.key, this.content, {
    meta,
    contentType: this.contentType,
  });
});

it('should put() works fine', async () => {
  const key = 'test-awos-with-headers';
  const cacheControl = 'public, no-cache';
  const contentDisposition =
    'test_awos_filename.txt; filename="test_awos_filename.txt"; filename*=utf-8\'\'test_awos_filename.txt';
  const contentEncoding = 'identity';

  const meta = new Map<string, any>();
  meta.set('length', this.content.length);

  await this.aws.put(key, this.content, {
    meta,
    contentType: 'text/plain',
    headers: {
      cacheControl,
      contentDisposition,
      contentEncoding,
    },
  });

  const signUrl = await this.aws.signatureUrl(key);
  const parsedUrl = url.parse(signUrl);
  const resHeaders = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
        port: parsedUrl.port,
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

  await this.aws.del(key);
});

it('should copy() works fine', async () => {
  const copy = `${this.key}-copy`
  const meta = new Map<string, any>();
  meta.set('length', this.content.length);

  await this.aws.put(this.key, this.content, {
    meta,
    contentType: this.contentType,
  });
  await this.aws.copy(copy, this.key, { meta, contentType: this.contentType });
  const s = await this.aws.get(copy, ['length'])
  expect(s.content).toEqual(this.content)
  expect(Number(s.meta.get('length'))).toEqual(this.content.length)
  await this.aws.del(copy)
});

it('should get() works fine', async () => {
  const res = await this.aws.get(this.key, ['length']);
  expect(res.content).toEqual(this.content);
  expect(res.meta.get('length')).toEqual(String(this.content.length));
  expect(res.headers['content-type']).toEqual(this.contentType);

  const res1 = await this.aws.get(this.key + 'abc', ['length']);
  expect(res1).toEqual(null);
});

it('should head() works fine', async () => {
  const res = await this.aws.head(this.key);
  expect(res.get('length')).toEqual(String(this.content.length));
});

it('should listObject() works fine', async () => {
  const res = await this.aws.listObject(this.key, {
    prefix: 'test',
    maxKeys: 5,
  });

  expect(res.length).toBeGreaterThanOrEqual(1);
  expect(res.length).toBeLessThanOrEqual(5);

  const notExistPrefixRes = await this.aws.listObject(this.key, {
    prefix: 'test-aaaabbbbccccc',
    maxKeys: 5,
  });
  expect(notExistPrefixRes.length).toBe(0);
});

it('should signatureUrl() works fine', async () => {
  const res = await this.aws.signatureUrl(this.key);

  expect(res).toContain(
    `${process.env.ENDPOINT}/${process.env.AWS_BUCKET}/${this.key}`
  );
});

it('should delMulti() works fine', async () => {
  const keys = this.keys
  await Promise.all(keys.slice(0, 5).map(key => this.aws.put(key, this.content, {
    contentType: this.contentType,
  })))
  const r = await this.aws.delMulti(keys)
  expect(r).toEqual([])
});

it('should listDetails() works fine', async () => {
  const keys = this.keys
  await Promise.all(keys.map(key => this.aws.put(key, this.content, {
    contentType: this.contentType,
  })))
  {
    const res = await this.aws.listDetails(this.key, { prefix: `${this.prefix}/`, delimiter: '/', maxKeys: 6 })
    expect(res.objects.length === 0)
    expect(res.prefixes.length === 6)
    expect(res.isTruncated).toBe(true)
    const res2 = await this.aws.listDetails(this.key, { prefix: `${this.prefix}/`, delimiter: '/', marker: res.nextMarker, maxKeys: 6 })
    expect(res2.objects.length === 0)
    expect(res2.prefixes.length === 4)
    expect(res2.isTruncated).toBe(false)
  }
  {
    const res = await this.aws.listDetails(this.key, { prefix: `${this.prefix}/`, maxKeys: 6 })
    expect(res.objects.length === 6)
    expect(res.prefixes.length === 0)
    expect(res.isTruncated).toBe(true)
    const res2 = await this.aws.listDetails(this.key, { prefix: `${this.prefix}/`, marker: res.nextMarker, maxKeys: 6 })
    expect(res2.objects.length === 4)
    expect(res2.prefixes.length === 0)
    expect(res2.isTruncated).toBe(false)
  }
}, 10000);

afterAll(async () => {
  await this.aws.del(this.key);
  await this.aws.delMulti(this.keys)
});
