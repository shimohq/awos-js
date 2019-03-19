import AWS from '../src/aws';

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
  this.content = 'hello, awos-js';
});

it('should put() workers fine', async () => {
  const meta = new Map<string, any>();
  meta.set('length', this.content.length);

  await this.aws.put(this.key, this.content, meta);
});

it('should get() workes fine', async () => {
  const res = await this.aws.get(this.key, ['length']);
  expect(res.content).toEqual(this.content);
  expect(res.meta.get('length')).toEqual(String(this.content.length));

  const res1 = await this.aws.get(this.key + 'abc', ['length']);
  expect(res1).toEqual(null);
});

it('should head() workes fine', async () => {
  const res = await this.aws.head(this.key);
  expect(res.get('length')).toEqual(String(this.content.length));
});

it('should listObject() workes fine', async () => {
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

afterAll(async () => {
  await this.aws.del(this.key);
});
