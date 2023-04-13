import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import {CfnApi, CfnIntegration, CfnRoute, CfnStage, CfnDeployment, CfnAuthorizer} from "aws-cdk-lib/aws-apigatewayv2";
import {PolicyDocument, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import { Aws, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {Environment} from "../bin/environment";

export interface WebsocketApiProps {
    readonly apiName: string;
    readonly apiDescription: string;
    readonly stageName: string;
    readonly connectHandler: IFunction;
    readonly disconnectHandler: IFunction;
    readonly connectionsTable: ITable;
    readonly authorizationHandler: IFunction;
    readonly defaultHandler?: IFunction;
}

export class WebsocketApi extends Construct {
    readonly props: WebsocketApiProps;
    readonly api: CfnApi;
    readonly deployment: CfnDeployment;

    constructor(parent: Stack, name: string, props: WebsocketApiProps, envs: Environment) {
        super(parent, name);
        this.props = props;

        this.api = new CfnApi(this, 'CompletionsWebSocketApi', {
            name: props.apiName,
            description: props.apiDescription,
            protocolType: "WEBSOCKET",
            routeSelectionExpression: "$request.body.action"
        });

        this.deployment = new CfnDeployment(this, "WebsocketDeployment", {
            apiId: this.api.ref,
        });

        new CfnStage(this, "WebsocketStage", {
            stageName: props.stageName,
            apiId: this.api.ref,
            deploymentId: this.deployment.ref,
        });

        const role = new Role(this, 'AuthorisedRole', {
            roleName: 'authorised-role',
            assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
            inlinePolicies: {
                allowLambdaInvocation: PolicyDocument.fromJson({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Action: ['lambda:InvokeFunction', 'lambda:InvokeAsync'],
                            Resource: `arn:aws:lambda:${envs.REGION}:${envs.ACCOUNT}:function:*`,
                        },
                    ],
                }),
            },
        });

        const authorizer = new CfnAuthorizer(this, 'WorkspaceAuthoriser', {
            name: 'workspace-authoriser',
            apiId: this.api.ref,
            authorizerType: 'REQUEST',
            identitySource: ['route.request.querystring.auth'],
            authorizerUri: `arn:aws:apigateway:${envs.REGION}:lambda:path/2015-03-31/functions/${this.props.authorizationHandler.functionArn}/invocations`,
            authorizerCredentialsArn: role.roleArn,
        });
        this.addLambdaIntegration(props.connectHandler, "$connect", "ConnectionRoute", false,"CUSTOM",  authorizer);

        props.connectionsTable.grantWriteData(props.connectHandler);
        props.connectionsTable.grantWriteData(props.disconnectHandler);

        this.addLambdaIntegration(props.disconnectHandler, "$disconnect", "DisconnectRoute");

        if(props.defaultHandler) {
            props.connectionsTable.grantWriteData(props.defaultHandler);
            this.addLambdaIntegration(props.defaultHandler, "$default", "DefaultRoute");
        }
    }

    addLambdaIntegration(handler: IFunction, routeKey: string, operationName: string, apiKeyRequired?: boolean, authorizationType?: string, authorizer?: CfnAuthorizer) {
        const integration = new CfnIntegration(this, `${operationName}Integration`, {
            apiId: this.api.ref,
            integrationType: "AWS_PROXY",
            integrationUri: `arn:aws:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${handler.functionArn}/invocations`,
        });

        handler.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com', {
            conditions: {
                "ArnLike": {
                    "aws:SourceArn": `arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${this.api.ref}/*/*`
                }
            }
        }));

        this.deployment.addDependency(new CfnRoute(this, `${operationName}RouteWebsocketDemo`, {
            apiId: this.api.ref,
            routeKey,
            apiKeyRequired,
            authorizationType: authorizationType || "NONE",
            operationName,
            target: `integrations/${integration.ref}`,
            authorizerId: authorizer?.attrAuthorizerId,
        }));
    }
}
