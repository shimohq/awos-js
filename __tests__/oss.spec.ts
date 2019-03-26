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
});

it('should put() workers fine', async () => {
  const meta = new Map<string, any>();
  meta.set('length', this.content.length);

  await this.oss.put(this.key, this.content, meta);
});

it('should get() workes fine', async () => {
  const res = await this.oss.get(this.key, ['length']);
  expect(res.content).toEqual(this.content);
  expect(res.meta.get('length')).toEqual(String(this.content.length));

  const res1 = await this.oss.get(this.key + 'abc', ['length']);
  expect(res1).toEqual(null);
});

it('should head() workes fine', async () => {
  const res = await this.oss.head(this.key);
  expect(res.get('length')).toEqual(String(this.content.length));
});

it('should listObject() workes fine', async () => {
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

it('should signatureUrl() workes fine', async () => {
  const res = await this.oss.signatureUrl(this.key);
  expect(res).toContain(process.env.ENDPOINT);
});

afterAll(async () => {
  await this.oss.del(this.key);
});
