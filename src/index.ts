import OSSClient from './oss';
import AWSClient from './aws';
import { AbstractClient } from './client';
import { ICommonClientOptions } from './types';

export interface IClientOptions extends ICommonClientOptions {
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

export * from './types';
export * from './aws';
