import { useState } from "react";

interface HttpResponse<T> {
    data?: T;
    error?: unknown;
    statusCode?: number;
}

interface RequestOptions {
    payload?: any;
    headers?: Record<string, any>;
    queryParams?: Record<string, string>;
}

export function useHttp() {
    const [isLoading, setIsLoading] = useState(false);

    const httpGet = <T extends any = any>(
        url: string,
        options?: Omit<RequestOptions, "payload">
    ) => {
        return request<T>({ url, method: "GET", options });
    };

    const httpPost = <T extends any = any>(
        url: string,
        options?: RequestOptions
    ) => {
        return request<T>({ url, method: "POST", options });
    };

    const httpPut = <T extends any = any>(
        url: string,
        options?: RequestOptions
    ) => {
        return request<T>({ url, method: "PUT", options });
    };

    const httpPatch = <T extends any = any>(
        url: string,
        options?: RequestOptions
    ) => {
        return request<T>({ url, method: "PATCH", options });
    };

    const httpDelete = <T extends any = any>(
        url: string,
        options?: RequestOptions
    ) => {
        return request<T>({ url, method: "DELETE", options });
    };

    const request = async <T extends any = any>(params: {
        url: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        options?: RequestOptions;
    }): Promise<HttpResponse<T>> => {
        const { url, method, options } = params;

        setIsLoading(true);
        let res: Response | undefined;
        try {
            res = await fetch(buildUrl(url, options?.queryParams), {
                method: method,
                body: options?.payload
                    ? JSON.stringify(options.payload)
                    : undefined,
                headers: options?.headers
            });
            const data = await res.json();
            return {
                data: data,
                statusCode: res.status,
                error: "error" in data ? data.error : undefined
            };
        } catch (error) {
            return { error: error, statusCode: res?.status };
        } finally {
            setIsLoading(false);
        }
    };

    return {
        get: httpGet,
        post: httpPost,
        put: httpPut,
        patch: httpPatch,
        delete: httpDelete,
        isLoading: isLoading
    };
}

function buildUrl(url: string, queryParams?: Record<string, string>) {
    if (!queryParams) {
        return url;
    }

    const paramList: string[] = [];
    Object.keys(queryParams).forEach((key) => {
        const value = queryParams[key];
        if (!value) {
            return;
        }
        paramList.push(`${key}=${encodeURIComponent(value)}`);
    });

    if (url.at(-1) !== "?" && paramList.length > 0) {
        url += "?";
    }

    return url + paramList.join("&");
}
