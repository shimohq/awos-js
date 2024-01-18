import { AbstractClient } from './client';
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
import { defaults } from 'lodash';

const OSS = require('ali-oss');
const retry = require('async-retry');

const STANDARD_HEADERS = [
  'content-type',
  'content-length',
  'accept-ranges',
  'etag',
  'last-modified',
];

export default class OSSClient extends AbstractClient {
  private clients: Map<string, typeof OSS> = new Map(); // <bucketName, AliOSSClient>
  private OSS_META_PREFIX = 'x-oss-meta-';

  constructor(options: ICommonClientOptions) {
    super(options);
    this.buckets.forEach(bucket => {
      this.clients.set(
        bucket,
        new OSS({
          accessKeyId: options.accessKeyID,
          accessKeySecret: options.accessKeySecret,
          endpoint: options.endpoint,
          bucket,
        })
      );
    });
  }

  protected async _get(
    key: string,
    metaKeys: string[]
  ): Promise<IGetObjectResponse | null> {
    const r = await this._getAsBuffer(key, metaKeys);
    return r
      ? {
          ...r,
          content: r.content.toString(),
        }
      : r;
  }

  protected async _getAsBuffer(
    key: string,
    metaKeys: string[]
  ): Promise<IGetBufferedObjectResponse | null> {
    const client = this.getClient(key);

    try {
      const res = await client.get(key);

      if (res.res.status !== 200) {
        throw Error(`get oss object error, res:${JSON.stringify(res)}`);
      }

      if (res.content) {
        const headers = res.res.headers;
        const meta = new Map<string, string>();
        metaKeys.forEach((k: string) => {
          if (headers[this.OSS_META_PREFIX + k]) {
            meta.set(k, headers[this.OSS_META_PREFIX + k]);
          }
        });

        return {
          content: res.content as Buffer,
          meta,
          headers,
        };
      } else {
        return null;
      }
    } catch (e) {
      if (e.status === 404) {
        return null;
      }
      throw e;
    }
  }

  protected async _put(
    key: string,
    data: string | Buffer,
    options?: IPutObjectOptions
  ): Promise<void> {
    const buffer =
      typeof data === 'string' ? Buffer.from(data) : (data as Buffer);
    const client = this.getClient(key);
    const defaultOptions: IPutObjectOptions = {};
    const _options = options || defaultOptions;
    const defaultMeta: Map<string, any> = new Map<string, any>();
    const _meta = _options!.meta || defaultMeta;

    const ossMeta = {};
    for (const [k, v] of _meta) {
      ossMeta[k] = v;
    }
    const opts: any = {
      meta: ossMeta,
    };

    opts.mime = _options.contentType || 'text/plain';

    const _headers = _options.headers || {};

    if (Object.keys(_headers).length > 0) {
      opts.headers = opts.headers || {};

      // https://www.npmjs.com/package/ali-oss#putname-file-options
      if (_headers.cacheControl) {
        opts.headers['Cache-Control'] = _headers.cacheControl;
      }
      if (_headers.contentDisposition) {
        opts.headers['Content-Disposition'] = _headers.contentDisposition;
      }
      if (_headers.contentEncoding) {
        opts.headers['Content-Encoding'] = _headers.contentEncoding;
      }
    }

    await retry(
      async () => {
        await client.put(key, buffer, opts);
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
    const client = this.getClient(key);
    const sourceBucket = this.getBucketName(source);
    const defaultOptions: ICopyObjectOptions = {};
    const _options = options || defaultOptions;
    const defaultMeta: Map<string, any> = new Map<string, any>();
    const _meta = _options!.meta || defaultMeta;

    const ossMeta = {};
    for (const [k, v] of _meta) {
      ossMeta[k] = v;
    }
    const opts: any = {
      meta: ossMeta,
    };

    opts.mime = _options.contentType || 'text/plain';

    const _headers = _options.headers || {};

    if (Object.keys(_headers).length > 0) {
      opts.headers = opts.headers || {};

      // https://www.npmjs.com/package/ali-oss#putname-file-options
      if (_headers.cacheControl) {
        opts.headers['Cache-Control'] = _headers.cacheControl;
      }
      if (_headers.contentDisposition) {
        opts.headers['Content-Disposition'] = _headers.contentDisposition;
      }
      if (_headers.contentEncoding) {
        opts.headers['Content-Encoding'] = _headers.contentEncoding;
      }
    }

    await retry(
      async () => {
        await client.copy(key, source, sourceBucket, opts);
      },
      {
        retries: 3,
        maxTimeout: 2000,
      }
    );
  }

  protected async _del(key: string): Promise<void> {
    const client = this.getClient(key);
    await client.delete(key);
  }

  protected async _delMulti(keys: string[]): Promise<string[]> {
    const client = this.getClient(keys[0]);
    const r = await client.deleteMulti(keys, { quiet: true });
    return r.deleted ? r.deleted.map(d => d.Key) : [];
  }

  protected async _head(
    key: string,
    options?: IHeadOptions
  ): Promise<Map<string, string> | null> {
    const client = this.getClient(key);

    try {
      const res = await client.head(key);

      if (res.status === 304) {
        return null;
      } else if (res.status === 200) {
        const meta = new Map<string, string>();
        if (res.meta) {
          Object.keys(res.meta).forEach((k: string) => {
            meta.set(k, res.meta[k]);
          });
        }
        if (options && options.withStandardHeaders) {
          for (const k of STANDARD_HEADERS) {
            if (k === 'last-modified') {
              meta.set(k, String(new Date(res.res.headers[k]).getTime()));
              continue;
            }
            meta.set(k, res.res.headers[k]);
          }
        }
        return meta;
      }

      throw Error(`head oss object error, res:${JSON.stringify(res)}`);
    } catch (e) {
      if (e.status === 404) {
        return null;
      }
      throw e;
    }
  }

  protected async _listObject(
    key: string,
    options?: IListObjectOptions
  ): Promise<string[]> {
    const client = this.getClient(key);

    const query = defaults({}, options);
    if (options && options.maxKeys) {
      query['max-keys'] = options.maxKeys;
    }
    const res = await client.list(query);

    if (res.res.status !== 200) {
      throw Error(`list oss objects error, res:${JSON.stringify(res)}`);
    }

    return res.objects ? res.objects.map((o: any) => o.name) : [];
  }

  protected async _listObjectV2(
    key: string,
    options?: IListObjectV2Options
  ): Promise<string[]> {
    const client = this.getClient(key);

    const query = defaults({}, options);
    if (options) {
      if (options.maxKeys) {
        query['max-keys'] = options.maxKeys;
      }
      if (options.prefix) {
        query.prefix = options.prefix;
      }
      if (options.continuationToken) {
        query['continuation-token'] = options.continuationToken;
      }
    }
    const res = await client.listV2(query);

    if (res.res.status !== 200) {
      throw Error(`list oss objects error, res:${JSON.stringify(res)}`);
    }

    return res.objects ? res.objects.map((o: any) => o.name) : [];
  }

  protected async _listDetails(
    key: string,
    options?: IListObjectOptions
  ): Promise<IListObjectOutput> {
    const client = this.getClient(key);

    const query = defaults({}, options);
    if (options && options.maxKeys) {
      query['max-keys'] = options.maxKeys;
    }
    const res = await client.list(query);

    if (res.res.status !== 200) {
      throw Error(`list oss objects error, res:${JSON.stringify(res)}`);
    }

    return {
      isTruncated: res.isTruncated,
      objects: res.objects
        ? res.objects.map(o => ({
            key: o.name,
            lastModified: o.lastModified,
            etag: o.etag,
            size: o.size,
          }))
        : [],
      prefixes: res.prefixes || [],
      nextMarker: res.nextMarker,
    };
  }

  protected async _listDetailsV2(
    key: string,
    options?: IListObjectV2Options
  ): Promise<IListObjectV2Output> {
    const client = this.getClient(key);

    const query = defaults({}, options);

    if (options) {
      if (options.maxKeys) {
        query['max-keys'] = options.maxKeys;
      }
      if (options.prefix) {
        query.prefix = options.prefix;
      }
      if (options.continuationToken) {
        query['continuation-token'] = options.continuationToken;
      }
    }

    const res = await client.list(query);

    if (res.res.status !== 200) {
      throw Error(`list oss objects error, res:${JSON.stringify(res)}`);
    }

    return {
      isTruncated: res.isTruncated,
      objects: res.objects
        ? res.objects.map(o => ({
            key: o.name,
            lastModified: o.lastModified,
            etag: o.etag,
            size: o.size,
          }))
        : [],
      prefix: res.prefix || [],
      nextContinuationToken: res.nextContinuationToken,
    };
  }

  protected async _signatureUrl(
    key: string,
    _options?: ISignatureUrlOptions
  ): Promise<string | null> {
    const client = this.getClient(key);
    const options = defaults({}, _options);
    return client.signatureUrl(key, options);
  }

  private getClient(key: string): any {
    const bucket = this.getBucketName(key);
    const client = this.clients.get(bucket);
    if (!client) {
      throw Error('key not exist in shards bucket!');
    }
    return client;
  }
}
