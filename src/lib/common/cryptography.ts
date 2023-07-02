import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export default class Cryptography{
    static async getSaltAndHash(secret: string){
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const saltedHash = await bcrypt.hash(secret, salt);
        return {salt, hash: saltedHash}
    }

    static async matches(hash: string, salt: string, secret: string){
        const saltedHash = await bcrypt.hash(secret, salt);
        return saltedHash === hash
    }
}