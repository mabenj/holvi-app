import Database from "@/db/Database";
import { Collection } from "@/db/models/Collection";
import { IncomingMessage } from "http";
import { Op, Transaction } from "sequelize";
import { Readable } from "stream";
import { Clock, realClock } from "../common/clock";
import { HolviError, NotFoundError } from "../common/errors";
import { UserFileSystem } from "../common/user-file-system";
import { EMPTY_UUIDV4, caseInsensitiveSorter } from "../common/utilities";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFileDto } from "../types/collection-file-dto";
import { CollectionFileFormData } from "../validators/collection-file.validator";
import { CollectionFormData } from "../validators/collection.validator";
import { CollectionDetails } from "../types/collection-details";
import { SCRUB_PREVIEW_MIME_TYPE } from "../types/scrub-preview";
import {
  BrowseCollectionsPage,
  BrowseCollectionsQuery,
  browseCollections,
  summarizeCollections,
} from "./collection-browsing";
import {
  BrowseFilesPage,
  BrowseFilesQuery,
  BrowseTimelineQuery,
  browseFiles,
  browseTimeline,
} from "./file-browsing";
import { UUID_PATTERN } from "./keyset-paging";
import { VideoProcessingService } from "./video-processing.service";

export type {
  BrowseCollectionsPage,
  BrowseCollectionsQuery,
} from "./collection-browsing";
export type { CollectionFileType } from "../types/collection-file-type";
export type {
  BrowseFilesPage,
  BrowseFilesQuery,
  BrowseTimelineQuery,
  FileSort,
} from "./file-browsing";

interface CreateResult {
  collection?: CollectionDto;
  nameError?: string;
  errors?: string[];
}

interface GetBufferResult {
  file: Buffer;
  filename: string;
  mimeType: string;
}

interface GetStreamResult {
  stream: Readable;
  chunkStartEnd: [start: number, end: number];
  totalLengthBytes: number;
  mimeType: string;
  filename: string;
}

interface CollectionServiceOptions {
  /** Tells the time for the Shuffle period, whether an Open extends the previous one, and which collections are Forgotten collections */
  clock?: Clock;
}

export class CollectionService {
  private readonly clock: Clock;

  constructor(
    private readonly userId: string,
    options: CollectionServiceOptions = {}
  ) {
    this.clock = options.clock ?? realClock;
  }

  /** One page of the user's collections as summaries, in random order for the seed or the current Shuffle period */
  async browseCollections(
    query: BrowseCollectionsQuery = {}
  ): Promise<BrowseCollectionsPage> {
    return browseCollections(this.userId, this.clock(), query);
  }

  /** One page of the files of one of the user's collections, newest first unless another sort is asked for */
  async browseFiles(
    collectionId: string,
    query: BrowseFilesQuery = {}
  ): Promise<BrowseFilesPage> {
    await this.throwIfNotUserCollection(collectionId);
    return browseFiles(collectionId, query);
  }

  /** One page of the Timeline: every file the user owns, across their collections, newest first */
  async browseTimeline(
    query: BrowseTimelineQuery = {}
  ): Promise<BrowseFilesPage> {
    return browseTimeline(this.userId, query);
  }

  async getAllFiles(): Promise<CollectionFileDto[]> {
    const db = await Database.getInstance();
    const files = await db.models.CollectionFile.findAll({
      include: {
        model: db.models.Collection,
        required: true,
        where: {
          UserId: this.userId,
        },
      },
    });
    return files.map((file) => file.toDto());
  }

  async updateFile(
    collectionId: string,
    data: CollectionFileFormData
  ): Promise<CollectionFileDto> {
    const db = await Database.getInstance();
    await this.throwIfNotUserCollection(collectionId);
    // Only a file of that collection, which the check above made sure is the user's
    const fileInDb = await db.models.CollectionFile.findOne({
      where: { id: data.id, CollectionId: collectionId },
    });
    if (!fileInDb) {
      throw new NotFoundError(`File '${data.id}' not found`);
    }

    const transaction = await db.transaction();
    try {
      // update file
      fileInDb.name = data.name;
      await fileInDb.save({ transaction });

      // create new tags
      await db.models.Tag.bulkCreate(
        data.tags.map((tag) => ({ name: tag })),
        {
          ignoreDuplicates: true,
          returning: false,
          transaction,
        }
      );

      // update junction table
      await db.models.CollectionFileTag.destroy({
        where: {
          CollectionFileId: fileInDb.id,
          TagName: {
            [Op.notIn]: data.tags,
          },
        },
        transaction,
      });
      await db.models.CollectionFileTag.bulkCreate(
        data.tags.map((tag) => ({
          TagName: tag,
          CollectionFileId: fileInDb.id,
        })),
        {
          ignoreDuplicates: true,
          returning: false,
          transaction,
        }
      );

      await transaction.commit();

      // fetch tags from junction table
      const fileTags = await db.models.CollectionFileTag.findAll({
        where: {
          CollectionFileId: fileInDb.id,
        },
      });

      return {
        ...fileInDb.toDto(),
        tags: fileTags.map((tag) => tag.TagName),
      };
    } catch (error) {
      transaction.rollback();
      throw new HolviError(`Error updating file '${data.id}'`, error);
    }
  }

  /** One of the user's collections as its page shows it: its summary and description */
  async getCollection(collectionId: string): Promise<CollectionDetails> {
    const db = await Database.getInstance();
    await this.throwIfNotUserCollection(collectionId);
    const collection = await db.models.Collection.findByPk(collectionId, {
      attributes: ["id", "name", "description", "createdAt"],
      raw: true,
    });
    if (!collection) {
      throw new NotFoundError(`Collection not found '${collectionId}'`);
    }
    const [summary] = await summarizeCollections([collection]);
    return { ...summary, description: collection.description ?? "" };
  }

  async multiDelete(idsToDelete: string[]) {
    const db = await Database.getInstance();
    const transaction = await db.transaction();

    try {
      const collections = await db.models.Collection.findAll({
        where: {
          UserId: this.userId,
          id: {
            [Op.in]: idsToDelete,
          },
        },
      });
      const collectionFiles = await db.models.CollectionFile.findAll({
        where: {
          id: {
            [Op.in]: idsToDelete,
          },
        },
        include: {
          model: db.models.Collection,
          required: true,
          where: {
            UserId: this.userId,
          },
        },
      });
      await Promise.all(
        collections.map((collection) => collection.destroy({ transaction }))
      );
      await Promise.all(
        collectionFiles.map((file) => file.destroy({ transaction }))
      );

      const fileSystem = new UserFileSystem(this.userId);
      for (let i = 0; i < collections.length; i++) {
        await fileSystem.deleteCollectionDir(collections[i].id);
      }
      for (let i = 0; i < collectionFiles.length; i++) {
        const { CollectionId, id } = collectionFiles[i];
        await fileSystem.deleteFileAndThumbnail(CollectionId, id);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new HolviError(`Error performing multi-deletion`, error);
    }
  }

  async deleteFile(collectionId: string, fileId: string) {
    const db = await Database.getInstance();
    const transaction = await db.transaction();
    await this.throwIfNotUserCollection(collectionId);

    try {
      const collectionFile = await db.models.CollectionFile.findByPk(fileId);
      if (!collectionFile) {
        throw new NotFoundError(`File not found '${fileId}'`);
      }
      collectionFile.destroy({ transaction });

      const fileSystem = new UserFileSystem(this.userId);
      await fileSystem.deleteFileAndThumbnail(collectionId, collectionFile.id);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new HolviError(`Error deleting file '${fileId}'`, error);
    }
  }

  /** Streams a chunk of a video's original, or of its Rendition if it has one */
  async getVideoStream(
    collectionId: string,
    videoId: string,
    offset: number,
    { rendition = false }: { rendition?: boolean } = {}
  ): Promise<GetStreamResult> {
    const fileInfo = await this.getCollectionFileInfo(collectionId, videoId);
    if (!fileInfo) {
      throw new NotFoundError(`File not found '${videoId}'`);
    }
    if (rendition && !fileInfo.hasRendition) {
      throw new NotFoundError(`Video '${videoId}' has no Rendition`);
    }

    const fileSystem = new UserFileSystem(this.userId);
    const { stream, totalLengthBytes, chunkStartEnd } =
      await fileSystem.getFileStream(collectionId, fileInfo.id, offset, {
        rendition,
      });
    if (!stream) {
      throw new HolviError(`Could not get file stream for file '${videoId}'`);
    }

    return {
      stream,
      // A Rendition is always an MP4, whatever the original was
      filename: rendition
        ? `${fileInfo.label.replace(/\.[^.]*$/, "")}.mp4`
        : fileInfo.label,
      mimeType: rendition ? "video/mp4" : fileInfo.mimeType,
      chunkStartEnd,
      totalLengthBytes,
    };
  }

  /** A video's Scrub preview, a JPEG image */
  async getScrubPreview(
    collectionId: string,
    videoId: string
  ): Promise<GetBufferResult> {
    const fileInfo = await this.getCollectionFileInfo(collectionId, videoId);
    if (!fileInfo) {
      throw new NotFoundError(`File not found '${videoId}'`);
    }
    if (!fileInfo.hasScrubPreview) {
      throw new NotFoundError(`Video '${videoId}' has no Scrub preview`);
    }
    const file = await new UserFileSystem(this.userId).readScrubPreview(
      collectionId,
      fileInfo.id
    );
    return {
      mimeType: SCRUB_PREVIEW_MIME_TYPE,
      file,
      filename: `${fileInfo.label.replace(/\.[^.]*$/, "")}_scrub.jpg`,
    };
  }

  async getFileBuffer(
    collectionId: string,
    fileId: string,
    thumbnail: boolean = false
  ): Promise<GetBufferResult> {
    const fileInfo = await this.getCollectionFileInfo(collectionId, fileId);
    if (!fileInfo) {
      throw new NotFoundError(`File not found '${fileId}'`);
    }

    const fileSystem = new UserFileSystem(this.userId);
    const file = await fileSystem.readFile(
      collectionId,
      fileInfo.id,
      thumbnail
    );
    if (!file) {
      throw new HolviError(`Could not read file '${fileId}'`);
    }
    return {
      mimeType: fileInfo.mimeType,
      file,
      filename: fileInfo.label,
    };
  }

  async uploadCollection(
    collectionName: string,
    req: IncomingMessage
  ): Promise<CreateResult> {
    const { collection, nameError } = await this.createCollection(
      collectionName,
      []
    );
    if (!collection || nameError) {
      return { nameError };
    }
    try {
      const { files, errors } = await this.uploadFiles(collection.id, req);
      collection.thumbnails = files
        .sort(caseInsensitiveSorter("name"))
        .slice(0, Collection.thumbnailsLimit)
        .map((file) => file.thumbnailSrc);
      collection.imageCount = files.filter((file) =>
        file.mimeType.includes("image")
      ).length;
      collection.videoCount = files.filter((file) =>
        file.mimeType.includes("video")
      ).length;
      return {
        collection,
        errors,
      };
    } catch (error) {
      await this.deleteCollection(collection.id);
      throw new HolviError("Error uploading collection", error);
    }
  }

  async uploadFiles(
    collectionId: string,
    req: IncomingMessage
  ): Promise<{
    collection: CollectionDto;
    files: CollectionFileDto[];
    errors: string[];
  }> {
    const db = await Database.getInstance();
    await this.throwIfNotUserCollection(collectionId);
    const fileSystem = new UserFileSystem(this.userId);
    // Opened only once the files have arrived, so a long upload holds no connection
    let transaction: Transaction | undefined;
    try {
      let { files, errors } = await fileSystem.uploadFilesToTempDir(req);

      const duplicateNames = await db.models.CollectionFile.findAll({
        where: {
          CollectionId: collectionId,
          name: {
            [Op.in]: files.map((file) => file.originalFilename),
          },
        },
        raw: true,
      });
      const duplicates = files.filter((newFile) => {
        const match = duplicateNames.find(
          (oldFile) => oldFile.name === newFile.originalFilename
        );
        return (
          !!match && match.takenAt?.getTime() === newFile.takenAt?.getTime()
        );
      });

      files = files.filter((file) => !duplicates.includes(file));
      if (duplicates.length > 0) {
        errors.push(
          ...duplicates.map(
            (duplicate) =>
              `Skipped uploading file '${duplicate.originalFilename}' because a file with the same name and timestamp already exists in the collection`
          )
        );
      }

      transaction = await db.transaction();
      const insertedRows = await db.models.CollectionFile.bulkCreate(
        files.map((file) => ({
          id: file.id,
          name: file.originalFilename,
          mimeType: file.mimeType,
          width: file.width,
          height: file.height,
          thumbnailWidth: file.thumbnailWidth,
          thumbnailHeight: file.thumbnailHeight,
          CollectionId: collectionId,
          gpsLatitude: file.gps?.latitude,
          gpsLongitude: file.gps?.longitude,
          gpsAltitude: file.gps?.altitude,
          gpsLabel: file.gps?.label,
          takenAt: file.takenAt,
          durationInSeconds: file.durationInSeconds,
          blurDataUrl: file.blurDataUrl,
          // Every new video gets video processing, in the background
          processingStatus: file.mimeType.startsWith("video")
            ? "pending"
            : null,
        })),
        {
          transaction,
        }
      );
      await fileSystem.mergeTempDirToCollectionDir(collectionId);
      await transaction.commit();
      // Not awaited: the upload finishes without waiting for video processing
      VideoProcessingService.kick();

      const collection = await db.models.Collection.findByPk(collectionId, {
        include: [db.models.CollectionFile, db.models.Tag],
      });
      if (!collection) {
        throw new NotFoundError(`Collection '${collectionId}' not found`);
      }

      return {
        collection: collection.toDto(),
        files: insertedRows.map((row) => row.toDto()),
        errors: errors,
      };
    } catch (error) {
      await transaction?.rollback().catch(() => undefined);
      throw new HolviError(
        `Error uploading files to collection '${collectionId}'`,
        error
      );
    } finally {
      await fileSystem.clearTempDir();
    }
  }

  async updateCollection(
    collectionId: string,
    collectionData: CollectionFormData
  ): Promise<CreateResult> {
    const db = await Database.getInstance();
    await this.throwIfNotUserCollection(collectionId);

    if (await this.nameTaken(collectionData.name, collectionId)) {
      return { nameError: "Collection name already exists" };
    }

    // Opened only after the checks, so a rejection never holds a connection
    const transaction = await db.transaction();
    try {
      const collectionInDb = await db.models.Collection.findByPk(collectionId, {
        include: db.models.CollectionFile,
      });
      if (!collectionInDb) {
        throw new NotFoundError(`Collection not found '${collectionId}'`);
      }
      // update file
      collectionInDb.name = collectionData.name;
      collectionInDb.description = collectionData.description || "";
      await collectionInDb.save({ transaction });

      // create new tags
      await db.models.Tag.bulkCreate(
        collectionData.tags.map((tag) => ({ name: tag })),
        {
          ignoreDuplicates: true,
          returning: false,
          transaction,
        }
      );

      // update junction table
      await db.models.CollectionTag.destroy({
        where: {
          CollectionId: collectionInDb.id,
          TagName: {
            [Op.notIn]: collectionData.tags,
          },
        },
        transaction,
      });
      await db.models.CollectionTag.bulkCreate(
        collectionData.tags.map((tag) => ({
          TagName: tag,
          CollectionId: collectionInDb.id,
        })),
        {
          ignoreDuplicates: true,
          returning: false,
          transaction,
        }
      );

      await transaction.commit();

      // fetch tags from junction table
      const collectionTags = await db.models.CollectionTag.findAll({
        where: {
          CollectionId: collectionInDb.id,
        },
      });

      return {
        collection: {
          ...collectionInDb.toDto(),
          tags: collectionTags.map((tag) => tag.TagName),
        },
      };
    } catch (error) {
      transaction.rollback();
      throw new HolviError(
        `Error updating collection '${collectionData.name}'`,
        error
      );
    }
  }

  async deleteCollection(collectionId: string) {
    const db = await Database.getInstance();
    await this.throwIfNotUserCollection(collectionId);

    const transaction = await db.transaction();
    try {
      await db.models.Collection.destroy({
        where: {
          id: collectionId,
        },
        transaction,
      });
      const fileSystem = new UserFileSystem(this.userId);
      await fileSystem.deleteCollectionDir(collectionId);
      await transaction.commit();
    } catch (error) {
      transaction.rollback();
      throw new HolviError(
        `Error deleting collection '${collectionId}'`,
        error
      );
    }
  }

  async createCollection(
    name: string,
    tags: string[],
    description?: string
  ): Promise<CreateResult> {
    if (await this.nameTaken(name)) {
      return { nameError: "Collection name already exists" };
    }
    const db = await Database.getInstance();
    const transaction = await db.transaction();
    try {
      const collection = await db.models.Collection.create(
        {
          name,
          UserId: this.userId,
          description,
        },
        { transaction }
      );
      await db.models.Tag.bulkCreate(
        tags.map((tag) => ({ name: tag })),
        {
          ignoreDuplicates: true,
          returning: false,
          transaction,
        }
      );
      const collectionTags = await db.models.CollectionTag.bulkCreate(
        tags.map((tag) => ({
          TagName: tag,
          CollectionId: collection.id,
        })),
        { transaction }
      );

      await transaction.commit();
      return {
        collection: {
          ...collection.toDto(),
          tags: collectionTags.map((tag) => tag.TagName),
        },
      };
    } catch (error) {
      transaction.rollback();
      throw new HolviError("Error creating collection", error);
    }
  }

  private async getCollectionFileInfo(collectionId: string, fileId: string) {
    const db = await Database.getInstance();
    const collectionFile = await db.models.CollectionFile.findOne({
      where: {
        CollectionId: collectionId,
        id: fileId,
      },
      attributes: [
        "mimeType",
        "id",
        "name",
        "hasRendition",
        "scrubPreviewLayout",
      ],
      include: {
        model: db.models.Collection,
        required: true,
        where: {
          UserId: this.userId,
        },
      },
      raw: true,
    });
    if (!collectionFile) {
      return null;
    }
    return {
      id: collectionFile.id,
      label: collectionFile.name,
      mimeType: collectionFile.mimeType,
      hasRendition: collectionFile.hasRendition,
      hasScrubPreview: collectionFile.scrubPreviewLayout !== null,
    };
  }

  private async throwIfNotUserCollection(collectionId: string) {
    if (!UUID_PATTERN.test(collectionId)) {
      throw new NotFoundError(`Collection not found '${collectionId}'`);
    }
    const db = await Database.getInstance();
    const collection = await db.models.Collection.findByPk(collectionId, {
      attributes: ["UserId"],
      raw: true,
    });
    if (!collection || collection.UserId !== this.userId) {
      throw new NotFoundError(`Collection not found '${collectionId}'`);
    }
  }

  private async nameTaken(name: string, collectionId?: string) {
    const db = await Database.getInstance();
    const existing = await db.models.Collection.findOne({
      where: {
        UserId: this.userId,
        id: {
          [Op.ne]: collectionId || EMPTY_UUIDV4,
        },
        name: name.trim(),
      },
      raw: true,
    });
    return !!existing;
  }
}
