export interface IGetObjectResponse {
  content: string;
  meta: Map<string, string>;
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
  put(key: string, data: string, meta: Map<string, any>): Promise<void>;
  del(key: string): Promise<void>;
  head(key: string): Promise<Map<string, string> | null>;
  listObject(key: string, options?: IListObjectOptions): Promise<string[]>;
  signatureUrl(
    key: string,
    options?: ISignatureUrlOptions
  ): Promise<string | null>;
}
