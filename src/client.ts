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
} from './types';

function normalizeKeyPrefix(prefix: string): string {
  if (prefix.startsWith('/')) {
    return prefix.slice(1);
  }
  return prefix;
}

export interface IAbstractClientOptions {
  bucket: string;
  shards?: string[];
  prefix?: string;
}

export abstract class AbstractClient {
  protected prefix: string;
  protected buckets: string[];
  protected shards?: string[];

  constructor(options: IAbstractClientOptions) {
    const { bucket, prefix, shards } = options;
    this.shards = shards;
    this.buckets = shards ? shards.map((s) => `${bucket}-${s}`) : [bucket];
    this.prefix = prefix ? normalizeKeyPrefix(prefix) : '';
  }

  public get(
    key: string,
    metaKeys: string[] = []
  ): Promise<IGetObjectResponse | null> {
    return this._get(this.getActualKey(key), metaKeys);
  }

  public getAsBuffer(
    key: string,
    metaKeys: string[] = []
  ): Promise<IGetBufferedObjectResponse | null> {
    return this._getAsBuffer(this.getActualKey(key), metaKeys);
  }

  public put(
    key: string,
    data: string | Buffer,
    options?: IPutObjectOptions
  ): Promise<void> {
    return this._put(this.getActualKey(key), data, options);
  }

  public copy(
    source: string,
    key: string,
    options?: ICopyObjectOptions
  ): Promise<void> {
    return this._copy(
      this.getActualKey(source),
      this.getActualKey(key),
      options
    );
  }

  public del(key: string): Promise<void> {
    return this._del(this.getActualKey(key));
  }

  public delMulti(keys: string[]): Promise<string[]> {
    return this._delMulti(keys.map((k) => this.getActualKey(k)));
  }

  public head(
    key: string,
    options?: IHeadOptions
  ): Promise<Map<string, string> | null> {
    return this._head(this.getActualKey(key), options);
  }

  public listObject(
    key: string,
    options?: IListObjectOptions
  ): Promise<string[]> {
    const _prefix = options?.prefix;
    const prefix = _prefix && this.getActualKey(_prefix);
    return this._listObject(this.getActualKey(key), { ...options, prefix });
  }

  public listObjectV2(
    key: string,
    options?: IListObjectV2Options
  ): Promise<string[]> {
    const _prefix = options?.prefix;
    const prefix = _prefix && this.getActualKey(_prefix);
    return this._listObjectV2(this.getActualKey(key), { ...options, prefix });
  }

  public listDetails(
    key: string,
    options?: IListObjectOptions
  ): Promise<IListObjectOutput> {
    const _prefix = options?.prefix;
    const prefix = _prefix && this.getActualKey(_prefix);
    return this._listDetails(this.getActualKey(key), { ...options, prefix });
  }

  public listDetailsV2(
    key: string,
    options?: IListObjectV2Options
  ): Promise<IListObjectV2Output> {
    const _prefix = options?.prefix;
    const prefix = _prefix ? this.getActualKey(_prefix) : undefined;
    return this._listDetailsV2(this.getActualKey(key), { ...options, prefix });
  }

  public signatureUrl(
    key: string,
    options?: ISignatureUrlOptions
  ): Promise<string | null> {
    return this._signatureUrl(this.getActualKey(key), options);
  }

  /**
   * Converts logic key to actual key
   *
   * Example With Prefix:
   * ```javascript
   * assert(this.prefix === 'sub_dir')
   * assert(this.getActualKey('my_object') === 'sub_dir/my_object')
   * ```
   *
   * Example Without Prefix:
   * ```javascript
   * assert(this.prefix === '')
   * assert(this.getActualKey('my_object') === 'my_object')
   * ```
   *
   * @param logicKey the key in bussiness logic
   * @returns {string} the key to access actually
   */
  protected getActualKey(logicKey: string): string {
    if (this.prefix) {
      return `${this.prefix}/${logicKey}`;
    }
    return logicKey;
  }

  protected getBucketName(key: string): string {
    if (!this.shards) {
      return this.buckets[0];
    }
    const keySuffix = key.slice(-1).toLowerCase();
    const shardIndex = this.shards.findIndex((s) => s.indexOf(keySuffix) > -1);
    if (!shardIndex) {
      throw Error('key not exist in shards bucket!');
    }
    const bucket = this.buckets[shardIndex];
    if (!bucket) {
      throw Error('key not exist in shards bucket!');
    }
    return bucket;
  }

  protected abstract _get(
    key: string,
    metaKeys: string[]
  ): Promise<IGetObjectResponse | null>;

  protected abstract _getAsBuffer(
    key: string,
    metaKeys: string[]
  ): Promise<IGetBufferedObjectResponse | null>;

  protected abstract _put(
    key: string,
    data: string | Buffer,
    options?: IPutObjectOptions
  ): Promise<void>;

  protected abstract _copy(
    source: string,
    key: string,
    options?: ICopyObjectOptions
  ): Promise<void>;

  protected abstract _del(key: string): Promise<void>;

  protected abstract _delMulti(keys: string[]): Promise<string[]>;

  protected abstract _head(
    key: string,
    options?: IHeadOptions
  ): Promise<Map<string, string> | null>;

  protected abstract _listObject(
    key: string,
    options?: IListObjectOptions
  ): Promise<string[]>;

  protected abstract _listObjectV2(
    key: string,
    options?: IListObjectV2Options
  ): Promise<string[]>;

  protected abstract _listDetails(
    key: string,
    options?: IListObjectOptions
  ): Promise<IListObjectOutput>;

  protected abstract _listDetailsV2(
    key: string,
    options?: IListObjectV2Options
  ): Promise<IListObjectV2Output>;

  protected abstract _signatureUrl(
    key: string,
    options?: ISignatureUrlOptions
  ): Promise<string | null>;
}
