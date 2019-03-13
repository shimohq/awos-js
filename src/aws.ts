import AWS = require('aws-sdk');
import { IAWOS, IGetObjectResponse, IListObjectOptions } from './types';
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
      this.client = new AWS.S3({
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        region: options.region,
      });
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

        resolve({
          content: awsResult.Body ? awsResult.Body.toString() : '',
          meta,
        });
      });
    });
  }

  public async put(
    key: string,
    data: string,
    meta: Map<string, any>
  ): Promise<void> {
    const bucket = this.getBucketName(key);

    const metaData = {};
    for (const [k, v] of meta) {
      metaData[k] = String(v);
    }

    const params = {
      Body: data,
      Bucket: bucket,
      Key: key,
      Metadata: metaData,
      ContentType: 'text/plain',
    };

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

  private getBucketName(key: string): string {
    if (this.shardsBucket.size === 0) {
      return this.bucket;
    }

    for (const [k, v] of this.shardsBucket) {
      if (k.indexOf(key.slice(-1)) >= 0) {
        return v;
      }
    }

    throw Error('key not exist in shards bucket!');
  }
}
