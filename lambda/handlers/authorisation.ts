import authenticate from '../utilities/jwt-rsa-authoriser';

export const handler = async (event: any, context: any, callback: any) => {
    let data;
    try {
        data = await authenticate(event);
    } catch (err) {
        console.log('UNAUTHORISED', err);
        return context.fail('Unauthorized');
    }

    console.log('AUTHORISED', data);
    return data;
};
