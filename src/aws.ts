import AWS = require('aws-sdk');
import {
  IAWOS,
  IGetObjectResponse,
  IListObjectOptions,
  ISignatureUrlOptions,
  IGetBufferedObjectResponse,
  IPutObjectOptions,
  IListObjectOutput,
  ICopyObjectOptions,
} from './types';
import * as _ from 'lodash';

const assert = require('assert');
const retry = require('async-retry');

export interface IAWSOptions {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
  shards?: string[];
  s3ForcePathStyle?: boolean;
  region?: string;
  [key: string]: any;
}

export default class AWSClient implements IAWOS {
  private client: AWS.S3;
  private shardsBucket: Map<string, string> = new Map();
  private bucket: string;

  constructor(options: IAWSOptions) {
    const s3ForcePathStyle = !!options.s3ForcePathStyle;

    ['accessKeyId', 'secretAccessKey', 'bucket'].forEach(key => {
      assert(options[key], `options.${key} required`);
    });

    // use minio
    if (s3ForcePathStyle) {
      assert(
        options.endpoint,
        'options.endpoint is required when options.s3ForcePathStyle = true'
      );
      this.client = new AWS.S3({
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        endpoint: options.endpoint,
        region: options.region || 'cn-north-1',
        s3ForcePathStyle,
      });
    }
    // use aws s3
    else {
      assert(
        options.region,
        'options.region is required when options.s3ForcePathStyle = false'
      );
      const s3Options: any = {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        region: options.region,
      };
      if (options.endpoint) {
        s3Options.endpoint = options.endpoint;
      }
      this.client = new AWS.S3(s3Options);
    }

    this.bucket = options.bucket;
    if (Array.isArray(options.shards) && options.shards.length > 0) {
      options.shards.forEach((letters: string) => {
        this.shardsBucket.set(
          letters,
          `${options.bucket}-${letters.toLowerCase()}`
        );
      });
    }
  }

  public async get(
    key: string,
    metaKeys: string[]
  ): Promise<IGetObjectResponse | null> {
    const r = await this._get(key, metaKeys);

    return r && r.content != null
      ? {
          ...r,
          content: r.content.toString(),
        }
      : null;
  }

  public async getAsBuffer(
    key: string,
    metaKeys: string[]
  ): Promise<IGetBufferedObjectResponse | null> {
    const r = await this._get(key, metaKeys);

    return r && r.content != null
      ? {
          ...r,
        }
      : null;
  }

  public async put(
    key: string,
    data: string | Buffer,
    options?: IPutObjectOptions
  ): Promise<void> {
    const bucket = this.getBucketName(key);

    const defaultOptions: IPutObjectOptions = {};
    const _options = options || defaultOptions;
    const defaultMeta: Map<string, any> = new Map<string, any>();
    const _meta = _options!.meta || defaultMeta;

    const metaData = {};
    for (const [k, v] of _meta) {
      metaData[k] = String(v);
    }

    const params: AWS.S3.Types.PutObjectRequest = {
      Body: data,
      Bucket: bucket,
      Key: key,
      Metadata: metaData,
      ContentType: _options.contentType || 'text/plain',
    };

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
    const _headers = _options.headers || {};
    if (_headers.cacheControl) {
      params.CacheControl = _headers.cacheControl;
    }
    if (_headers.contentDisposition) {
      params.ContentDisposition = _headers.contentDisposition;
    }
    if (_headers.contentEncoding) {
      params.ContentEncoding = _headers.contentEncoding;
    }

    await retry(
      async () => {
        await new Promise((resolve, reject) => {
          this.client.putObject(params, err => {
            if (err) {
              return reject(err);
            }
            resolve();
          });
        });
      },
      {
        retries: 3,
        maxTimeout: 2000,
      }
    );
  }

  public async copy(
    key: string,
    source: string,
    options?: ICopyObjectOptions
  ): Promise<void> {
    const bucket = this.getBucketName(key);
    const defaultOptions: ICopyObjectOptions = {};
    const _options = options || defaultOptions;
    const defaultMeta: Map<string, any> = new Map<string, any>();
    const _meta = _options!.meta || defaultMeta;

    const metaData = {};
    for (const [k, v] of _meta) {
      metaData[k] = String(v);
    }

    const params: AWS.S3.Types.CopyObjectRequest = {
      CopySource: `${bucket}/${source}`,
      Bucket: bucket,
      Key: key,
      Metadata: metaData,
      ContentType: _options.contentType || 'text/plain',
      MetadataDirective: _.isEmpty(metaData) ? 'COPY' : 'REPLACE',
    };

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
    const _headers = _options.headers || {};
    if (_headers.cacheControl) {
      params.CacheControl = _headers.cacheControl;
    }
    if (_headers.contentDisposition) {
      params.ContentDisposition = _headers.contentDisposition;
    }
    if (_headers.contentEncoding) {
      params.ContentEncoding = _headers.contentEncoding;
    }

    await retry(
      async () => {
        await new Promise((resolve, reject) => {
          this.client.copyObject(params, err => {
            if (err) {
              return reject(err);
            }
            resolve();
          });
        });
      },
      {
        retries: 3,
        maxTimeout: 2000,
      }
    );
  }

  public async del(key: string): Promise<void> {
    const bucket = this.getBucketName(key);
    const params = {
      Bucket: bucket,
      Key: key,
    };

    await new Promise((resolve, reject) => {
      this.client.deleteObject(params, err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  public async delMulti(keys: string[]): Promise<string[]> {
    const bucket = this.getBucketName(keys[0]);
    const params = {
      Bucket: bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: true,
      },
    };
    return new Promise<string[]>((resolve, reject) => {
      this.client.deleteObjects(params, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            res.Errors ? res.Errors.map(e => e.Key!).filter(k => k != null) : []
          );
        }
      });
    });
  }

  public async head(key: string): Promise<Map<string, string> | null> {
    const bucket = this.getBucketName(key);
    const params = {
      Bucket: bucket,
      Key: key,
    };

    return new Promise((resolve, reject) => {
      this.client.headObject(params, (err, data) => {
        if (err) {
          if (err.statusCode === 404) {
            return resolve(null);
          }
          return reject(err);
        }

        const meta = new Map<string, string>();
        if (data.Metadata) {
          const metaData = data.Metadata;
          Object.keys(data.Metadata).forEach((k: string) => {
            meta.set(k, metaData[k]);
          });
        }
        resolve(meta);
      });
    });
  }

  public async listObject(
    key: string,
    options?: IListObjectOptions
  ): Promise<string[]> {
    const bucket = this.getBucketName(key);
    const paramsList: any = {
      Bucket: bucket,
    };

    if (options) {
      if (options.prefix) {
        paramsList.Prefix = options.prefix;
      }
      if (options.marker) {
        paramsList.Marker = options.marker;
      }
      if (options.maxKeys) {
        paramsList.MaxKeys = options.maxKeys;
      }
    }

    const result: any[] = await new Promise((resolve, reject) => {
      this.client.listObjects(paramsList, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data.Contents);
      });
    });

    return result.map(o => o.Key);
  }

  public async listDetails(
    key: string,
    options?: IListObjectOptions
  ): Promise<IListObjectOutput> {
    const bucket = this.getBucketName(key);
    const paramsList: any = {
      Bucket: bucket,
    };

    if (options) {
      if (options.prefix) {
        paramsList.Prefix = options.prefix;
      }
      if (options.delimiter) {
        paramsList.Delimiter = options.delimiter;
      }
      if (options.marker) {
        paramsList.Marker = options.marker;
      }
      if (options.maxKeys) {
        paramsList.MaxKeys = options.maxKeys;
      }
    }

    const result = await new Promise<IListObjectOutput>((resolve, reject) => {
      this.client.listObjects(paramsList, (err, data) => {
        if (err) {
          return reject(err);
        }
        const result = {
          isTruncated: data.IsTruncated || false,
          objects: data.Contents
            ? data.Contents.map(o => ({
                key: o.Key,
                etag: o.ETag,
                lastModified: o.LastModified,
                size: o.Size,
              }))
            : [],
          prefixes: data.CommonPrefixes
            ? data.CommonPrefixes.map(p => p.Prefix!).filter(p => p != null)
            : [],
          nextMarker: data.NextMarker,
        };
        return resolve(result);
      });
    });

    return result;
  }

  public async signatureUrl(
    key: string,
    _options?: ISignatureUrlOptions
  ): Promise<string | null> {
    const bucket = this.getBucketName(key);
    const params: any = {
      Bucket: bucket,
      Key: key,
    };
    let operation = 'getObject';

    if (_options) {
      if (_options.method === 'PUT') {
        operation = 'putObject';
      }
      if (_options.expires) {
        params.Expires = _options.expires;
      }
    }

    const res: string = await new Promise((resolve, reject) => {
      this.client.getSignedUrl(operation, params, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
    return res;
  }

  private getBucketName(key: string): string {
    if (this.shardsBucket.size === 0) {
      return this.bucket;
    }

    for (const [k, v] of this.shardsBucket) {
      if (k.indexOf(key.slice(-1).toLowerCase()) >= 0) {
        return v;
      }
    }

    throw Error('key not exist in shards bucket!');
  }

  private async _get(
    key: string,
    metaKeys: string[]
  ): Promise<{
    content: Buffer;
    meta: Map<string, string>;
    headers: any;
  } | null> {
    const bucket = this.getBucketName(key);
    const params = {
      Bucket: bucket,
      Key: key,
    };

    return new Promise((resolve, reject) => {
      this.client.getObject(params, (err, data) => {
        if (err) {
          if (err.statusCode === 404) {
            return resolve(null);
          }
          return reject(err);
        }

        const awsResult = data;

        if (!awsResult) {
          return resolve(null);
        }

        const meta = new Map<string, string>();
        metaKeys.forEach((k: string) => {
          if (awsResult.Metadata && awsResult.Metadata[k]) {
            meta.set(k, awsResult.Metadata[k]);
          }
        });
        const headers = {
          'content-type': awsResult.ContentType,
          etag: awsResult.ETag,
          'content-length': awsResult.ContentLength,
        };

        resolve({
          content: awsResult.Body as Buffer,
          meta,
          headers,
        });
      });
    });
  }
}
