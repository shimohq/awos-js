export interface IGetObjectResponse {
  content: string;
  meta: Map<string, string>;
  headers: any;
}

export interface IGetBufferedObjectResponse {
  content: Buffer;
  meta: Map<string, string>;
  headers: any;
}

export interface IListObjectOptions {
  prefix?: string;
  marker?: string;
  delimiter?: string;
  maxKeys?: number;
}

export interface ISignatureUrlOptions {
  method?: string;
  expires?: number;
}

// 目前仅支持少量常用 Header
// AWS S3 https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
// Ali OSS https://www.npmjs.com/package/ali-oss#putname-file-options
export interface IPutObjectHeaders {
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
}

export interface IAWOS {
  get(key: string, metaKeys: string[]): Promise<IGetObjectResponse | null>;
  getAsBuffer(
    key: string,
    metaKeys: string[]
  ): Promise<IGetBufferedObjectResponse | null>;
  put(
    key: string,
    data: string | Buffer,
    meta?: Map<string, any>,
    contentType?: string,
    headers?: IPutObjectHeaders
  ): Promise<void>;
  del(key: string): Promise<void>;
  head(key: string): Promise<Map<string, string> | null>;
  listObject(key: string, options?: IListObjectOptions): Promise<string[]>;
  signatureUrl(
    key: string,
    options?: ISignatureUrlOptions
  ): Promise<string | null>;
}
