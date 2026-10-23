import Database from "@/db/Database";
import { Attributes, Model, ModelStatic, WhereOptions } from "sequelize";
import { NotFoundError } from "../common/errors";
import { isUuidv4 } from "../common/utilities";
import { JobStatus } from "../types/job-dto";

/** What the rows of every kind of job (Backup or Restore) have */
interface JobRow extends Model {
    id: string;
    UserId: string;
    status: JobStatus;
    queuedAt: Date;
}

type JobFields<Job extends JobRow> = Partial<Attributes<Job>>;

/** The rows of one kind of job: the queue the job runner takes them from, and each user's jobs */
export class JobStore<Job extends JobRow> {
    /** `name` names a job in errors, e.g. "Backup job" */
    constructor(
        private readonly model: ModelStatic<Job>,
        private readonly name: string
    ) {}

    /** The oldest queued job, or null if none is queued */
    async findNextQueued() {
        const model = await this.getModel();
        return model.findOne({
            where: this.where({ status: "queued" }),
            order: [
                ["queuedAt", "ASC"],
                ["createdAt", "ASC"]
            ]
        });
    }

    /** Marks a queued job running; false if it is no longer queued (cancelled meanwhile) */
    async claim(jobId: string) {
        const model = await this.getModel();
        const [claimed] = await model.update(
            { status: "running" } as JobFields<Job>,
            { where: this.where({ id: jobId, status: "queued" }) }
        );
        return claimed > 0;
    }

    /**
     * Job state is persisted with targeted updates rather than by saving a shared
     * model instance, so progress changed during an in-flight save is never lost.
     */
    async update(jobId: string, fields: JobFields<Job>) {
        const model = await this.getModel();
        await model.update(fields, { where: this.where({ id: jobId }) });
    }

    /** The user's jobs, latest first */
    async findUserJobs(userId: string) {
        const model = await this.getModel();
        return model.findAll({
            where: this.where({ UserId: userId }),
            order: [["queuedAt", "DESC"]]
        });
    }

    /** The user's queued or running job, if any; a user has at most one */
    async findActiveUserJob(userId: string) {
        const model = await this.getModel();
        return model.findOne({
            where: this.where({ UserId: userId, status: ["queued", "running"] })
        });
    }

    /** One of the user's jobs; another user's job is not found */
    async findUserJob(userId: string, jobId: string) {
        const model = await this.getModel();
        const job = isUuidv4(jobId)
            ? await model.findOne({ where: this.where({ id: jobId, UserId: userId }) })
            : null;
        if (!job) {
            throw new NotFoundError(`${this.name} '${jobId}' not found`);
        }
        return job;
    }

    /** The model can only be used once the database has initialised it */
    private async getModel() {
        await Database.getInstance();
        return this.model;
    }

    private where(conditions: Record<string, unknown>) {
        return conditions as WhereOptions<Attributes<Job>>;
    }
}
