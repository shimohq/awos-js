AWOS-JS: Wrapper For Aliyun OSS And Amazon S3
====

![npm](https://img.shields.io/npm/v/awos-js)

awos for golang:  https://github.com/shimohq/awos

## feat

- same usage and methods for aws & oss, pretty convenient!
- add retry strategy
- avoid 404 status code:
    - `get(key: string, metaKeys?: string[]): Promise<IGetObjectResponse | null>` will return null when object not exist
    - `head(key: string): Promise<Map<string, string> | null>` will null when object not exist

## installing

```
npm i awos-js --save
```

## how to use

```javascript
// for typescript
import AWOS from 'awos-js'

// for js
const AWOS = require('awos-js')
```

### for Aliyun OSS

```javascript
const client = new AWOS.Client({
  type: 'oss',
  ossOptions: {
    accessKeyId: 'accessKeyId',
    accessKeySecret: 'accessKeySecret',
    bucket: 'bucket',
    endpoint: 'endpoint',
  }
})
```

### for Amazon S3(minio)

```javascript
const client = new AWOS.Client({
  type: 'aws',
  awsOptions: {
    accessKeyId: 'accessKeyId',
    secretAccessKey: 'secretAccessKey',
    bucket: 'bucket',
    // when use minio, S3ForcePathStyle must be set true
    // when use aws, endpoint is unnecessary and region must be set
    region: "region",
    endpoint: 'endpoint',
    s3ForcePathStyle: true,
  }
})
```

the available operation：

```javascript
get(key: string, metaKeys?: string[]): Promise<IGetObjectResponse | null>;
getAsBuffer(key: string, metaKeys: string[]): Promise<IGetBufferedObjectResponse | null>;
put(key: string, data: string | Buffer, options?: IPutObjectOptions): Promise<void>;
del(key: string): Promise<void>;
head(key: string): Promise<Map<string, string> | null>;
listObject(key: string, options?: IListObjectOptions): Promise<string[]>;
signatureUrl(key: string, options?: ISignatureUrlOptions): Promise<string | null>;
```

### Change Log

- v2.0.0 / 2020-06-18
  - Breaking
    - conbine parameters `meta`,`contentType`,`headers` of `AWOS.put` into `options`
  - add `headers` option support for `put` method

- v1.0.4 / 2019-12-26
  - support buffer in get and put operation

- v1.0.3 / 2019-03-28
  - put() support contentType params

- v1.0.2 / 2019-03-26
  - support signatureUrl() operation

- v1.0.1 / 2019-03-19
  - bug fix: oss listObject() should return [] when options.prefix not exist in the bucket; oss listObject() maxKeys not working



