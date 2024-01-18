import AWOS, { IOptions } from './awos';
import {
  IGetObjectResponse,
  IGetBufferedObjectResponse,
  IListObjectOptions,
  ISignatureUrlOptions,
} from './types';
import OSSClient, { IOSSOptions } from './oss';
import AWSClient, { IAWSOptions } from './aws';
import { AbstractClient } from './client';

const assert = require('assert');

export function build(options: IOptions): AbstractClient {
  const { prefix } = options;

  switch (options.type) {
    case 'oss':
      assert(options.ossOptions, 'ossOptions is required when type is "oss"');
      return new OSSClient({
        ...options.ossOptions!,
        prefix,
      });
    case 'aws':
      assert(options.awsOptions, 'awsOptions is required when type is "aws"');
      return new AWSClient({
        ...options.awsOptions!,
        prefix,
      });
    default:
      throw Error('invalid options!');
  }
}

export {
  AWOS,
  IOptions,
  IGetObjectResponse,
  IGetBufferedObjectResponse,
  IListObjectOptions,
  IOSSOptions,
  IAWSOptions,
  ISignatureUrlOptions,
};
