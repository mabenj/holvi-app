import chalk from "chalk";

export enum LogColor {
    RED = "red",
    GREEN = "green",
    YELLOW = "yellow",
    BLUE = "blue",
    MAGENTA = "magenta",
    CYAN = "cyan"
}

export default class Log {
    constructor(
        private readonly name: string,
        private readonly color?: LogColor
    ) {}

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
            `${this.timestamp} ${chalk.blue(
                "[DEBUG]"
            )} ${this.getName()}: ${message}`
        );
    }

    info(message: string) {
        console.log(
            `${this.timestamp} ${chalk.green(
                "[INFO]"
            )} ${this.getName()}: ${message}`
        );
    }

    warn(message: string) {
        console.warn(
            `${this.timestamp} ${chalk.yellow(
                "[WARN]"
            )} ${this.getName()}: ${message}`
        );
    }

    error(message: string, error?: Error | unknown) {
        console.error(
            `${this.timestamp} ${chalk.red(
                "[ERROR]"
            )} ${this.getName()}: ${message}`,
            error
        );
    }

    private getName() {
        if (!this.color) {
            return `[${this.name}]`;
        }
        return chalk[this.color](`[${this.name}]`);
    }
}
