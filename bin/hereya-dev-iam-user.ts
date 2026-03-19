#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { HereyaDevIamUserStack } from '../lib/hereya-dev-iam-user-stack';

const app = new cdk.App();
new HereyaDevIamUserStack(app, process.env.STACK_NAME!, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
