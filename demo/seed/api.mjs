// A signed-in User's view of the running demo, through the same public HTTP
// API the app's client uses

export class ApiError extends Error {
    constructor(method, path, status, body) {
        super(
            `${method} ${path} answered ${status}${
                body?.error ? ` (${body.error})` : ""
            }`
        );
        this.status = status;
        this.body = body;
    }
}

export class Api {
    /** @param {string} baseUrl @param {string} username @param {string} cookie */
    constructor(baseUrl, username, cookie) {
        this.baseUrl = baseUrl;
        this.username = username;
        this.cookie = cookie;
    }

    /** Creates the User and returns their session */
    static signUp(baseUrl, username, password) {
        return Api.#authenticate(baseUrl, "/api/auth/signup", {
            username,
            password,
            confirmPassword: password
        });
    }

    static logIn(baseUrl, username, password) {
        return Api.#authenticate(baseUrl, "/api/auth/login", {
            username,
            password
        });
    }

    static async #authenticate(baseUrl, path, credentials) {
        const res = await fetch(new URL(path, baseUrl), {
            method: "POST",
            body: JSON.stringify(credentials)
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new ApiError("POST", path, res.status, body);
        }
        const cookie = res.headers
            .getSetCookie()
            .map((header) => header.split(";")[0])
            .join("; ");
        if (!cookie) {
            throw new Error(`POST ${path} set no session cookie`);
        }
        return new Api(baseUrl, credentials.username, cookie);
    }

    /** GETs JSON, throwing an ApiError unless the answer is a success */
    async get(path, query = {}) {
        const res = await this.request("GET", withQuery(path, query));
        return this.#json("GET", path, res);
    }

    /**
     * Sends JSON the way the client does: as plain text, since the routes
     * parse the raw body themselves
     */
    async send(method, path, body) {
        const res = await this.request(method, path, {
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        return this.#json(method, path, res);
    }

    /** A raw request, for checks that care about the status or the content */
    request(method, path, init = {}) {
        return fetch(new URL(path, this.baseUrl), {
            ...init,
            method,
            headers: { ...init.headers, cookie: this.cookie },
            redirect: "manual"
        });
    }

    async #json(method, path, res) {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new ApiError(method, path, res.status, body);
        }
        return body;
    }

    /** Creates a collection and returns its id */
    async createCollection({ name, description = "", tags = [] }) {
        const { id } = await this.send("POST", "/api/collections", {
            name,
            description,
            tags
        });
        return id;
    }

    /**
     * Uploads files into a collection as one multipart request, the way the
     * client sends them: each part's field name is the file's last-modified
     * time in epoch milliseconds. Returns the uploaded files.
     *
     * @param {{ name: string, mimeType: string, content: Buffer, lastModified: Date }[]} files
     */
    async upload(collectionId, files) {
        const form = new FormData();
        for (const file of files) {
            form.append(
                String(file.lastModified.getTime()),
                new Blob([file.content], { type: file.mimeType }),
                file.name
            );
        }
        const path = `/api/collections/${collectionId}/files/upload`;
        const res = await this.request("POST", path, { body: form });
        const body = await this.#json("POST", path, res);
        if (body.errors?.length) {
            throw new Error(`Upload into ${collectionId} failed: ${body.errors.join("; ")}`);
        }
        return body.files;
    }

    /** Every item of a paged list, following its cursor to the end */
    async all(path, key, query = {}) {
        const items = [];
        let cursor;
        do {
            const page = await this.get(path, { ...query, cursor });
            items.push(...page[key]);
            cursor = page.nextCursor ?? undefined;
        } while (cursor);
        return items;
    }
}

function withQuery(path, query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        for (const item of [value].flat()) {
            if (item !== undefined && item !== null) {
                params.append(key, String(item));
            }
        }
    }
    const search = params.toString();
    return search ? `${path}?${search}` : path;
}
