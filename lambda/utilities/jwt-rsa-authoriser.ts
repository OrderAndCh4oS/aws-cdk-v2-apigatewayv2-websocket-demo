import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import util from 'util';

if (!process.env.AUDIENCE) throw new Error('Missing AUDIENCE');
if (!process.env.ISSUER) throw new Error('Missing ISSUER');
if (!process.env.AWS_REGION) throw new Error('Missing AWS_REGION');

const JWKS_URI = `${process.env.ISSUER}.well-known/jwks.json`

const getPolicyDocument = (effect: any, resource: any) => {
    return {
        Version: '2012-10-17',
        Statement: [{
            Action: 'execute-api:Invoke',
            Effect: effect,
            Resource: resource,
        }]
    };
}

const getToken = (event: any) => {
    if (!event.type || event.type !== 'REQUEST') {
        throw new Error('Expected "event.type" parameter to have value "REQUEST"');
    }

    const tokenString = event.queryStringParameters?.auth;
    if (!tokenString) {
        throw new Error('Expected "event.queryStringParameters.auth" parameter to be set');
    }

    return tokenString;
}

const jwtOptions = {
    audience: process.env.AUDIENCE,
    issuer: process.env.ISSUER
};

const client = jwksClient({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    jwksUri: JWKS_URI
});

const authenticate = (event: any) => {
    console.log(event);
    const token = getToken(event);

    const decoded = jwt.decode(token, {complete: true});
    if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new Error('invalid token');
    }

    const getSigningKey = util.promisify(client.getSigningKey);
    return getSigningKey(decoded.header.kid)
        .then((key: any) => {
            const signingKey = key?.publicKey || key?.rsaPublicKey;
            return jwt.verify(token, signingKey, jwtOptions);
        })
        .then((decoded: any) => ({
            principalId: decoded.sub,
            policyDocument: getPolicyDocument('Allow', '*'),
            context: {scope: decoded.scope}
        }));
}

export default authenticate
