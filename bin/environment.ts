import {config} from "dotenv";
import * as process from "process";

config();

export interface Environment {
    STAGE: string,
    REGION: string,
    ACCOUNT: string,
}

const environment = {
    STAGE: process.env.STAGE || 'dev',
    REGION: process.env.REGION || 'eu-west-1',
    ACCOUNT: process.env.ACCOUNT || '',
}

export default environment;
