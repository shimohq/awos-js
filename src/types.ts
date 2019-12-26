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
    contentType?: string
  ): Promise<void>;
  del(key: string): Promise<void>;
  head(key: string): Promise<Map<string, string> | null>;
  listObject(key: string, options?: IListObjectOptions): Promise<string[]>;
  signatureUrl(
    key: string,
    options?: ISignatureUrlOptions
  ): Promise<string | null>;
}
