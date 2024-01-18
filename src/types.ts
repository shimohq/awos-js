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

export interface IListObjectV2Options {
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ISignatureUrlOptions {
  method?: string;
  expires?: number;
}

export interface IPutObjectOptions {
  meta?: Map<string, any>;
  contentType?: string;
  headers?: IPutObjectHeaders;
}

// 目前仅支持少量常用 Header
// AWS S3 https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
// Ali OSS https://www.npmjs.com/package/ali-oss#putname-file-options
export interface IPutObjectHeaders {
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
}

export interface ICopyObjectOptions {
  meta?: Map<string, any>;
  contentType?: string;
  headers?: IPutObjectHeaders;
}

export interface IListObjectOutput {
  isTruncated: boolean;
  objects: Array<{
    key?: string;
    etag?: string;
    lastModified?: Date;
    size?: number;
  }>;
  prefixes: string[];
  nextMarker?: string;
}
export interface IListObjectV2Output {
  isTruncated: boolean;
  objects: Array<{
    key?: string;
    etag?: string;
    lastModified?: Date;
    size?: number;
  }>;
  nextContinuationToken?: string;
  prefix: string[];
}

export interface IHeadOptions {
  withStandardHeaders: boolean;
}
