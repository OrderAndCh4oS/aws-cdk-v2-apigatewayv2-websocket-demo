import * as cdk from 'aws-cdk-lib';
import {Aws, CfnOutput} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {AttributeType, Table} from "aws-cdk-lib/aws-dynamodb";
import {WebsocketApi} from "./websocket-api";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {NodejsFunction, NodejsFunctionProps} from "aws-cdk-lib/aws-lambda-nodejs";
import {Effect, PolicyStatement} from "aws-cdk-lib/aws-iam";
import {Environment} from "../bin/environment";
import {Runtime} from "aws-cdk-lib/aws-lambda";

export class AwsCdkV2WebsocketStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: cdk.StackProps, private envs: Environment) {
        super(scope, id, props);
        this.addWebsocket(envs);
    }

    private addWebsocket(envs: Environment) {
        const connectionsTable = new Table(this, 'ConnectionsTableWebsocketDemo', {
            partitionKey: {name: 'connectionId', type: AttributeType.STRING},
            readCapacity: 2,
            writeCapacity: 1,
            timeToLiveAttribute: "ttl"
        });

        const commonHandlerProps: NodejsFunctionProps = {
            bundling: {minify: true, sourceMap: true, target: 'es2019'},
            runtime: Runtime.NODEJS_18_X,
            logRetention: RetentionDays.THREE_DAYS
        };

        const connectHandler = new NodejsFunction(this, 'ConnectHandlerWebsocketDemo', {
            ...commonHandlerProps,
            entry: 'lambda/websocket/connect.ts',
            environment: {
                CONNECTIONS_TBL: connectionsTable.tableName
            }
        });

        const defaultHandler = new NodejsFunction(this, 'DefaultHandlerWebsocketDemo', {
            ...commonHandlerProps,
            entry: 'lambda/websocket/default.ts',
            environment: {
                CONNECTIONS_TBL: connectionsTable.tableName
            }
        });

        const disconnectHandler = new NodejsFunction(this, 'DisconnectHandlerWebsocketDemo', {
            ...commonHandlerProps,
            entry: 'lambda/websocket/disconnect.ts',
            environment: {
                CONNECTIONS_TBL: connectionsTable.tableName
            }
        });

        const websocketApi = new WebsocketApi(this, "MessageWebsocketApiWebsocketDemo", {
            apiName: "messages-api",
            apiDescription: "Web Socket API for Completions",
            stageName: envs.STAGE,
            connectHandler,
            disconnectHandler,
            defaultHandler,
            connectionsTable
        });

        const CONNECTION_URL = `https://${websocketApi.api.ref}.execute-api.${Aws.REGION}.amazonaws.com/${envs.STAGE}`;

        const messageHandler = new NodejsFunction(this, 'CompletionHandlerWebsocketDemo', {
            ...commonHandlerProps,
            entry: 'lambda/websocket/message.ts',
            environment: {
                CONNECTION_TBL: connectionsTable.tableName,
                CONNECTION_URL: CONNECTION_URL
            },
        });

        websocketApi.addLambdaIntegration(messageHandler, 'message', 'CompletionsRoute')

        const managementApiPolicyStatement = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["execute-api:ManageConnections"],
            resources: [`arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${websocketApi.api.ref}/*`]
        })
        defaultHandler.addToRolePolicy(managementApiPolicyStatement);
        messageHandler.addToRolePolicy(managementApiPolicyStatement);

        new CfnOutput(this, 'WebsocketConnectionUrl', {value: CONNECTION_URL});

        const websocketApiUrl = `${websocketApi.api.attrApiEndpoint}/${envs.STAGE}`
        new CfnOutput(this, "WebsocketUrl", {
            value: websocketApiUrl
        });
    }
}
