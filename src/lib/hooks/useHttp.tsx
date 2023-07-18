import { useState } from "react";

interface HttpResponse<T> {
    data?: T;
    error?: unknown;
    statusCode?: number;
}

export function useHttp() {
    const [isLoading, setIsLoading] = useState(false);

    const httpGet = <T,>(url: string, headers?: Record<string, any>) => {
        return request<T>({
            url,
            method: "GET",
            headers
        });
    };

    const httpPost = <T,>(
        url: string,
        payload?: any,
        headers?: Record<string, any>
    ) => {
        return request<T>({
            url,
            method: "POST",
            payload,
            headers
        });
    };

    const httpPut = <T,>(
        url: string,
        payload?: any,
        headers?: Record<string, any>
    ) => {
        return request<T>({
            url,
            method: "PUT",
            payload,
            headers
        });
    };

    const httpDelete = <T,>(url: string, headers?: Record<string, any>) => {
        return request<T>({
            url,
            method: "DELETE",
            headers
        });
    };

    const request = async <T,>(options: {
        url: string;
        method: "GET" | "POST" | "PUT" | "DELETE";
        payload?: any;
        headers?: Record<string, any>;
    }): Promise<HttpResponse<T>> => {
        setIsLoading(true);
        let res: Response | undefined;
        try {
            res = await fetch(options.url, {
                method: options.method,
                body: options.payload
                    ? JSON.stringify(options.payload)
                    : undefined,
                headers: options.headers
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
        delete: httpDelete,
        isLoading: isLoading
    };
}
