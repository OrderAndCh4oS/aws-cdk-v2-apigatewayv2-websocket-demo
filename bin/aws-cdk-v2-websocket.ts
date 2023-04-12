#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsCdkV2WebsocketStack } from '../lib/aws-cdk-v2-websocket-stack';
import environment from "./environment";
const env = {account: environment.ACCOUNT, region: environment.REGION};

const app = new cdk.App();
new AwsCdkV2WebsocketStack(
    app,
    'AwsCdkV2WebsocketStack',
    {env},
    environment
);
