import chalk from "chalk";

export default class Log {
    constructor(private readonly name: string) {}

    private get timestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    debug(message: string) {
        console.debug(
            `${this.timestamp} ${chalk.blue("[DEBUG]")} [${
                this.name
            }]: ${message}`
        );
    }

    info(message: string) {
        console.log(
            `${this.timestamp} ${chalk.green("[INFO]")} [${
                this.name
            }]: ${message}`
        );
    }

    warn(message: string) {
        console.warn(
            `${this.timestamp} ${chalk.yellow("[WARN]")} [${
                this.name
            }]: ${message}`
        );
    }

    error(message: string, error?: Error | unknown) {
        console.error(
            `${this.timestamp} ${chalk.red("[ERROR]")} [${
                this.name
            }]: ${message}`,
            error
        );
    }
}
