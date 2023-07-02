import Database from "@/db/Database";
import Cryptography from "@/lib/common/cryptography";
import Log from "@/lib/common/log";
import { isValidPassword, isValidUsername } from "@/lib/common/utilities";
import { User } from "@/lib/interfaces/user";
import { IronSession } from "iron-session";

interface RegisterUserResult {
    usernameError?: string;
    passwordError?: string;
    user?: User;
}

export default class AuthService {
    static async registerUser(
        username: string,
        password: string
    ): Promise<RegisterUserResult> {
        const usernameValid = isValidUsername(username);
        const passwordValid = isValidPassword(password);
        if (!usernameValid || !passwordValid) {
            return {
                usernameError: usernameValid ? undefined : "Invalid username",
                passwordError: passwordValid ? undefined : "Invalid password"
            };
        }

        const existing = await Database.sql(
            "SELECT username FROM users WHERE username = $1 LIMIT 1",
            [username]
        );
        if (existing.length > 0) {
            return {
                usernameError: "Username already exists"
            };
        }

        const { salt, hash } = await Cryptography.getSaltAndHash(password);
        return Database.sqlOne(
            "INSERT INTO users(username, password_hash, password_salt) values($1, $2, $3) RETURNING id, username, created_at, updated_at",
            [username, hash, salt]
        )
            .then((data) => {
                return {
                    user: {
                        id: data.id,
                        username: data.username,
                        createdAt: data.created_at,
                        updatedAt: data.updated_at
                    }
                };
            })
            .catch((error) => {
                Log.error(`Error creating user '${username}'`, error);
                throw new Error(`Error creating user '${username}'`);
            });
    }

    static async loginUser(
        username: string,
        password: string
    ): Promise<User | null> {
        const user = await Database.sqlOne(
            "SELECT id, username, password_hash, password_salt, created_at, updated_at from users WHERE username = $1",
            [username]
        );
        if (!user) {
            return null;
        }

        const correctPwd = await Cryptography.matches(
            user.password_hash,
            user.password_salt,
            password
        );
        if (correctPwd) {
            return {
                id: user.id,
                username: user.username,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            };
        }

        return null;
    }

    static async validateUser(session: IronSession): Promise<User | null> {
        if (!session) {
            return null;
        }
        if (!session.user) {
            await session.destroy();
            return null;
        }

        const user = await Database.sqlOne(
            "SELECT id, username, created_at, updated_at from users WHERE id = $1",
            [session.user.id]
        );
        if (!user) {
            await session.destroy();
            return null;
        }
        if (user.require_sign_in) {
            // TODO: add require_sign_in column at some point
            await session.destroy();
            return null;
        }

        return {
            id: user.id,
            username: user.username,
            createdAt: user.created_at,
            updatedAt: user.updated_at
        };
    }
}
