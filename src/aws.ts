import AWS = require('aws-sdk');
import {
  IGetObjectResponse,
  IListObjectOptions,
  IListObjectV2Options,
  ISignatureUrlOptions,
  IGetBufferedObjectResponse,
  IPutObjectOptions,
  IListObjectOutput,
  IListObjectV2Output,
  ICopyObjectOptions,
  IHeadOptions,
  ICommonClientOptions,
} from './types';
import * as _ from 'lodash';
import { AbstractClient } from './client';

const assert = require('assert');
const retry = require('async-retry');

const STANDARD_HEADERS_KEYMAP = {
  ContentType: 'content-type',
  ContentLength: 'content-length',
  AcceptRanges: 'accept-ranges',
  ETag: 'etag',
  LastModified: 'last-modified',
};

export interface IAWSOptions extends ICommonClientOptions {
  s3ForcePathStyle?: boolean;
  region?: string;
  prefix?: string;
  signatureVersion?: string;
}

const DefaultSignatureVersion = 'v4';

export default class AWSClient extends AbstractClient {
  private client: AWS.S3;

  constructor(options: IAWSOptions) {
    super(options);

    const awsClientOptions: AWS.S3.Types.ClientConfiguration = {
      accessKeyId: options.accessKeyID,
      secretAccessKey: options.accessKeySecret,
      signatureVersion: options.signatureVersion || DefaultSignatureVersion,
    };
    const s3ForcePathStyle = !!options.s3ForcePathStyle;
    if (s3ForcePathStyle) {
      // minio
      assert(
        options.endpoint,
        'options.endpoint is required when options.s3ForcePathStyle = true'
      );
      awsClientOptions.endpoint = options.endpoint;
      awsClientOptions.region = options.region || 'cn-north-1';
      awsClientOptions.s3ForcePathStyle = true;
    } else {
      // aws s3
      assert(
        options.region,
        'options.region is required when options.s3ForcePathStyle = false'
      );
      awsClientOptions.region = options.region;
      if (options.endpoint) {
        awsClientOptions.endpoint = options.endpoint;
      }
    }
    this.client = new AWS.S3(awsClientOptions);
  }

  protected async _get(
    key: string,
    metaKeys: string[]
  ): Promise<IGetObjectResponse | null> {
    const r = await this.getWithMetadata(key, metaKeys);

    return r && r.content != null
      ? {
          ...r,
          content: r.content.toString(),
        }
      : null;
  }

  protected async _getAsBuffer(
    key: string,
    metaKeys: string[]
  ): Promise<IGetBufferedObjectResponse | null> {
    const r = await this.getWithMetadata(key, metaKeys);

    return r && r.content != null
      ? {
          ...r,
        }
      : null;
  }

  protected async _put(
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
        await new Promise<void>((resolve, reject) => {
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

  protected async _copy(
    key: string,
    source: string,
    options?: ICopyObjectOptions
  ): Promise<void> {
    const bucket = this.getBucketName(key);
    const sourceBucket = this.getBucketName(source);
    const defaultOptions: ICopyObjectOptions = {};
    const _options = options || defaultOptions;
    const defaultMeta: Map<string, any> = new Map<string, any>();
    const _meta = _options!.meta || defaultMeta;

    const metaData = {};
    for (const [k, v] of _meta) {
      metaData[k] = String(v);
    }

    const params: AWS.S3.Types.CopyObjectRequest = {
      CopySource: `${sourceBucket}/${source}`,
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
        await new Promise<void>((resolve, reject) => {
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

  protected async _del(key: string): Promise<void> {
    const bucket = this.getBucketName(key);
    const params = {
      Bucket: bucket,
      Key: key,
    };

    await new Promise<void>((resolve, reject) => {
      this.client.deleteObject(params, err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  protected async _delMulti(keys: string[]): Promise<string[]> {
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

  protected async _head(
    key: string,
    options?: IHeadOptions
  ): Promise<Map<string, string> | null> {
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
        if (options && options.withStandardHeaders) {
          for (const k of Object.keys(STANDARD_HEADERS_KEYMAP)) {
            if (STANDARD_HEADERS_KEYMAP[k] === 'last-modified') {
              meta.set(
                STANDARD_HEADERS_KEYMAP[k],
                String(new Date(data[k]).getTime())
              );
              continue;
            }
            meta.set(STANDARD_HEADERS_KEYMAP[k], String(data[k]));
          }
        }
        resolve(meta);
      });
    });
  }

  protected async _listObject(
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

    const result: any[] = await new Promise<any>((resolve, reject) => {
      this.client.listObjects(paramsList, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data.Contents);
      });
    });

    return result.map(o => o.Key);
  }

  protected async _listObjectV2(
    key: string,
    options?: IListObjectV2Options
  ): Promise<string[]> {
    const bucket = this.getBucketName(key);
    const paramsList: any = {
      Bucket: bucket,
    };

    if (options) {
      if (options.prefix) {
        paramsList.Prefix = options.prefix;
      }
      if (options.continuationToken) {
        paramsList.ContinuationToken = options.continuationToken;
      }
      if (options.maxKeys) {
        paramsList.MaxKeys = options.maxKeys;
      }
    }

    const result: any[] = await new Promise<any>((resolve, reject) => {
      this.client.listObjects(paramsList, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data.Contents);
      });
    });

    return result.map(o => o.Key);
  }

  protected async _listDetails(
    key: string,
    options?: IListObjectOptions
  ): Promise<IListObjectOutput> {
    const bucket = this.getBucketName(key);
    const paramsList: AWS.S3.Types.ListObjectsRequest = {
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

  protected async _listDetailsV2(
    key: string,
    options?: IListObjectV2Options
  ): Promise<IListObjectV2Output> {
    const bucket = this.getBucketName(key);
    const paramsList: AWS.S3.Types.ListObjectsV2Request = {
      Bucket: bucket,
    };

    if (options) {
      if (options.prefix) {
        paramsList.Prefix = options.prefix;
      }
      if (options.delimiter) {
        paramsList.Delimiter = options.delimiter;
      }
      if (options.continuationToken) {
        paramsList.ContinuationToken = options.continuationToken;
      }
      if (options.maxKeys) {
        paramsList.MaxKeys = options.maxKeys;
      }
    }

    const result = await new Promise<IListObjectV2Output>((resolve, reject) => {
      this.client.listObjectsV2(paramsList, (err, data) => {
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
          prefix: data.CommonPrefixes
            ? data.CommonPrefixes.map(p => p.Prefix!).filter(p => p != null)
            : [],
          nextContinuationToken: data.NextContinuationToken,
        };
        return resolve(result);
      });
    });

    return result;
  }

  protected async _signatureUrl(
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

  private async getWithMetadata(
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
