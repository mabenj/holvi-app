import Log from "../common/log";
import { getErrorMessage } from "../common/utilities";

const PROGRESS_SAVE_INTERVAL_MS = 1_000;

/** A queued job, as the runner needs to see it */
export interface QueuedJob {
    id: string;
}

/** What one kind of job (Backup or Restore) plugs into a runner */
export interface JobRunnerOptions<Job extends QueuedJob, Dependencies> {
    /** Names the kind of job in log messages, e.g. "backup" */
    kind: string;
    logger: Log;
    /** The file system a job uses unless the service that queued it injected replacements */
    realDependencies: Dependencies;
    /** The oldest queued job of this kind, or null if none is queued */
    findNextQueued(): Promise<Job | null>;
    /** Marks a queued job running; false if it is no longer queued (cancelled meanwhile) */
    claim(jobId: string): Promise<boolean>;
    /** Runs a job already marked running; aborting `signal` cancels it */
    run(job: Job, dependencies: Dependencies, signal: AbortSignal): Promise<void>;
    /** Deals with jobs a previous server process left running, before any job is claimed */
    recoverInterrupted(): Promise<void>;
}

/** The job a runner is claiming or running */
interface CurrentJob {
    jobId: string;
    controller: AbortController;
    /** Resolves once the runner has let go of the job */
    done: Promise<void>;
}

/** Runs one kind of queued job one at a time across the whole instance, in queue order */
export class JobRunner<Job extends QueuedJob, Dependencies> {
    private draining = false;
    private queueChanged = false;
    private current: CurrentJob | null = null;
    private recoveryRequests: {
        resolve: () => void;
        reject: (error: unknown) => void;
    }[] = [];
    /** Dependencies injected by the service that queued each job; others use the real file system */
    private readonly dependencies = new Map<string, Dependencies>();

    constructor(private readonly options: JobRunnerOptions<Job, Dependencies>) {}

    /** Must be called before the job is committed, so no queue pass can claim it without its dependencies */
    setDependencies(jobId: string, dependencies: Dependencies) {
        this.dependencies.set(jobId, dependencies);
    }

    /**
     * Aborts the job if this runner is claiming or running it, and waits until
     * it has stopped. Returns false if this runner does not have the job.
     */
    async cancel(jobId: string) {
        this.dependencies.delete(jobId);
        const current = this.current;
        if (current?.jobId !== jobId) {
            return false;
        }
        current.controller.abort();
        await current.done;
        return true;
    }

    /**
     * Recovers from a previous server process once no job of this runner is
     * running, then goes on to run queued jobs. Resolves once recovery is done.
     */
    recover() {
        const recovered = new Promise<void>((resolve, reject) =>
            this.recoveryRequests.push({ resolve, reject })
        );
        this.kick();
        return recovered;
    }

    /** Starts running queued jobs unless they are already being run */
    kick() {
        this.queueChanged = true;
        if (this.draining) {
            return;
        }
        this.draining = true;
        void this.drain();
    }

    private async drain() {
        try {
            // A job queued while the last lookup was in flight must not be missed
            while (this.queueChanged) {
                this.queueChanged = false;
                while (await this.runNextQueuedJob()) {}
            }
        } catch (error) {
            this.options.logger.error(
                `${capitalise(this.options.kind)} job queue stopped`,
                error
            );
        } finally {
            // Synchronous with the last check above, so no kick is lost
            this.draining = false;
        }
    }

    /** Claims and runs the oldest queued job; returns false if none is queued */
    private async runNextQueuedJob() {
        // Between jobs, so recovery never touches a job this process is running
        await this.runRequestedRecovery();
        const job = await this.options.findNextQueued();
        if (!job) {
            return false;
        }
        let markDone = () => {};
        const done = new Promise<void>((resolve) => (markDone = resolve));
        const controller = new AbortController();
        // Registered before claiming, so a cancel that finds the job running can abort it
        this.current = { jobId: job.id, controller, done };
        try {
            // Conditional, so a job cancelled meanwhile is not started
            const claimed = await this.options.claim(job.id);
            const dependencies =
                this.dependencies.get(job.id) ?? this.options.realDependencies;
            this.dependencies.delete(job.id);
            if (claimed) {
                await this.options.run(job, dependencies, controller.signal);
            }
        } finally {
            this.current = null;
            markDone();
        }
        return true;
    }

    private async runRequestedRecovery() {
        const requests = this.recoveryRequests.splice(0);
        if (requests.length === 0) {
            return;
        }
        try {
            await this.options.recoverInterrupted();
            requests.forEach((request) => request.resolve());
        } catch (error) {
            this.options.logger.error(
                `Could not recover ${this.options.kind} jobs`,
                error
            );
            requests.forEach((request) => request.reject(error));
        }
    }
}

export function throwIfAborted(signal: AbortSignal) {
    if (signal.aborted) {
        throw signal.reason;
    }
}

/** Persists a running job's in-memory progress periodically instead of per chunk */
export class ProgressSaver<Progress extends object> {
    private timer: NodeJS.Timeout | null = null;
    private saving: Promise<void> = Promise.resolve();
    private lastSaved = "";

    /** `jobName` names the job in the warning a failed save is logged with; the job survives it */
    constructor(
        private readonly progress: Progress,
        private readonly persist: (progress: Progress) => Promise<void>,
        private readonly logger: Log,
        private readonly jobName: string
    ) {}

    start() {
        this.timer = setInterval(() => this.save(), PROGRESS_SAVE_INTERVAL_MS);
    }

    async stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.saving;
    }

    private save() {
        const current = { ...this.progress };
        const serialised = JSON.stringify(current);
        if (serialised === this.lastSaved) {
            return;
        }
        this.lastSaved = serialised;
        this.saving = this.saving
            .then(() => this.persist(current))
            .catch((error) =>
                this.logger.warn(
                    `Could not save progress of ${
                        this.jobName
                    } (${getErrorMessage(error)})`
                )
            );
    }
}

function capitalise(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
