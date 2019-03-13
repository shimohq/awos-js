AWOS-JS: Wrapper For OSS And AWS(MINIO)
====

[![](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)](https://github.com/shimohq/awos-js)

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

### for oss

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

### for aws(minio)

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
put(key: string, data: string, meta?: Map<string, any>): Promise<void>;
del(key: string): Promise<void>;
head(key: string): Promise<Map<string, string> | null>;
listObject(key: string, options?: IListObjectOptions): Promise<string[]>;
```





