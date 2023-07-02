export default class Log {
    private static get timestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    static debug(message: string) {
        console.debug(`${this.timestamp} [DEBUG]: ${message}`);
    }

    static info(message: string) {
        console.log(`${this.timestamp} [INFO]: ${message}`);
    }

    static warn(message: string) {
        console.warn(`${this.timestamp} [WARN]: ${message}`);
    }

    static error(message: string, error?: Error | unknown) {
        console.error(`${this.timestamp} [ERROR]: ${message}`, error);
    }
}
