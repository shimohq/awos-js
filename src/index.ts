import OSSClient from './oss';
import AWSClient, { IAWSOptions } from './aws';
import { AbstractClient } from './client';

export interface IClientOptions extends IAWSOptions {
  storageType: 'oss' | 'aws';
}

export function build(options: IClientOptions): AbstractClient {
  const { storageType, ...commonOptions } = options;

  switch (storageType) {
    case 'oss':
      return new OSSClient(commonOptions);
    case 'aws':
      return new AWSClient(commonOptions);
    default:
      throw Error('invalid options!');
  }
}

export type Client = AbstractClient;
export * from './types';
export * from './aws';
