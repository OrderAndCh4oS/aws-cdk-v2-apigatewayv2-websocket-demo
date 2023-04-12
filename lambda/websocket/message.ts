import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    console.log('event', JSON.stringify(event));
    console.log('context', JSON.stringify(context));
    console.log('process.env', JSON.stringify(process.env));

    const domain = event.requestContext.domainName;
    const stage = event.requestContext.stage;
    const ConnectionId = event.requestContext.connectionId!;
    const callbackUrl = `https://${domain}/${stage}`;

    const client = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });
    const Data = Buffer.from(JSON.stringify({message: 'here'})).toString();

    const requestParams = {
        ConnectionId,
        Data,
    };

    // Note: Data type is expected to be Uint8Array, we're passing a string instead
    // @ts-ignore
    const command = new PostToConnectionCommand(requestParams);

    try {
        await client.send(command);
    } catch (error) {
        console.log(error);
    }

    return {
        statusCode: 200,
        body: 'Success'
    };
};
