export default class PseudoProgress {
    private readonly intervalFreq = 100;

    private progress = 0;
    private intervalId: NodeJS.Timer | null = null;
    private time = 0;

    constructor(
        private readonly timeConstantMs: number,
        private readonly onProgress: (progress: number) => void
    ) {}

    start() {
        this.time = 0;
        this.intervalId = setInterval(
            this.onInterval.bind(this),
            this.intervalFreq
        );
    }

    end() {
        this.stop();
        this.progress = 1;
        this.onProgress(this.progress);
    }

    private stop() {
        this.intervalId && clearInterval(this.intervalId);
        this.intervalId = null;
    }

    private onInterval() {
        this.time += this.intervalFreq;
        this.progress = 1 - Math.exp((-1 * this.time) / this.timeConstantMs);
        this.onProgress(this.progress);
    }
}
