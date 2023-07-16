import Database from "@/db/Database";
import { IronSession } from "iron-session";
import Cryptography from "../common/cryptography";
import Log from "../common/log";
import { UserDto } from "../interfaces/user-dto";

interface RegisterUserResult {
    usernameError?: string;
    passwordError?: string;
    user?: UserDto;
}

export default class AuthService {
    static async registerUser(
        username: string,
        password: string
    ): Promise<RegisterUserResult> {
        const db = await Database.getInstance();
        const existing = await db.models.User.findOne({
            where: { username: username },
            raw: true
        });
        if (existing) {
            return {
                usernameError: "Username already exists"
            };
        }

        const { salt, hash } = await Cryptography.getSaltAndHash(password);
        const transaction = await db.transaction();
        try {
            const user = await db.models.User.create(
                {
                    username,
                    hash,
                    salt
                },
                { transaction }
            );
            await transaction.commit();
            return {
                user: {
                    id: user.id,
                    username: user.username
                }
            };
        } catch (error) {
            Log.error("Error registering user", error);
            transaction.rollback();
            throw error;
        }
    }

    static async loginUser(
        username: string,
        password: string
    ): Promise<UserDto | null> {
        const db = await Database.getInstance();
        const user = await db.models.User.findOne({
            where: { username },
            raw: true
        });
        if (!user) {
            return null;
        }
        const correctPwd = await Cryptography.matches(
            user.hash,
            user.salt,
            password
        );
        if (!correctPwd) {
            return null;
        }

        return {
            id: user.id,
            username: user.username
        };
    }

    static async validateUser(session: IronSession): Promise<UserDto | null> {
        if (!session) {
            return null;
        }
        if (!session.user) {
            session.destroy();
            return null;
        }

        const db = await Database.getInstance();
        const user = await db.models.User.findOne({
            where: { id: session.user.id, requireSignIn: false },
            raw: true
        });
        if (!user) {
            session.destroy();
            return null;
        }

        return {
            id: user.id,
            username: user.username
        };
    }
}
