import { readFile } from "fs/promises";
import ExifParser from "exif-parser";
import { env } from "~/env";
import Log, { LogColor } from "./log";
import path from "path";
import { createDirIfNotExists } from "./file-system-helpers";
import { promisify } from "util";
import { getPlaiceholder } from "plaiceholder";
import { getErrorMessage, removeSubstring } from "./utils";

const LOGGER = new Log("IMG", LogColor.YELLOW);

export type ExifData = {
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    label?: string;
  };
  takenAt?: Date;
};

export async function getExif(
  imagePath: string,
): Promise<ExifData | undefined> {
  const SECONDS_TO_MS = 1000;

  try {
    const buffer = await readFile(imagePath);
    if (!buffer) {
      throw new Error("Could not read image to buffer");
    }
    const parser = ExifParser.create(buffer);
    const {
      tags: {
        GPSLatitude,
        GPSLatitudeRef,
        GPSLongitude,
        GPSLongitudeRef,
        GPSAltitude,
        GPSAltitudeRef,
        DateTimeOriginal,
        CreateDate,
      },
    } = parser.parse();

    const takenAt = DateTimeOriginal
      ? new Date(DateTimeOriginal * SECONDS_TO_MS)
      : CreateDate
        ? new Date(CreateDate * SECONDS_TO_MS)
        : undefined;

    if (!GPSLatitude || !GPSLatitudeRef || !GPSLongitude || !GPSLongitudeRef) {
      return { takenAt };
    }

    const latitude = (
      GPSLatitudeRef === "N" ? GPSLatitude : -GPSLatitude
    ) as number;
    const longitude = (
      GPSLongitudeRef === "E" ? GPSLongitude : -GPSLongitude
    ) as number;
    const altitude = GPSAltitude as number;
    let label: string | undefined;

    if (env.GEO_API_KEY) {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode?latitude=${latitude}&longitude=${longitude}&key=${env.GEO_API_KEY}`,
      );
      if (res.status !== 200) {
        LOGGER.warn(
          `Geocoding API request responded with '${res.status} (${res.statusText})'`,
        );
      } else {
        const { countryName, principalSubdivision, city, locality } =
          await res.json();

        const uniqueParts = new Set(
          [
            removeSubstring(countryName, "(the)"),
            principalSubdivision,
            city,
            locality,
          ].filter((part) => !!part.trim()),
        );
        label = Array.from(uniqueParts).reverse().join(", ");
      }
    }

    return {
      takenAt,
      gps: {
        latitude,
        longitude,
        altitude,
        label,
      },
    };
  } catch (error) {
    LOGGER.warn(
      `Could not parse exif data of image '${imagePath}' (${getErrorMessage(
        error,
      )})`,
    );
  }
}

export async function generateImageThumbnail(
  sourcePath: string,
  targetPath: string,
) {
  const dirname = path.dirname(targetPath);
  await createDirIfNotExists(dirname);

  const [{ default: imageSize }, { default: sharp }] = await Promise.all([
    import("image-size"),
    import("sharp"),
  ]);

  const sizeOf = promisify(imageSize);
  const { width, height } = await sizeOf(sourcePath).then((result) => ({
    width: result?.width ?? 0,
    height: result?.height ?? 0,
  }));
  sharp.cache(false);
  const { width: thumbnailWidth, height: thumbnailHeight } = await sharp(
    sourcePath,
  )
    .resize({
      width: env.THUMBNAIL_MAX_WIDTH,
      height: env.THUMBNAIL_MAX_HEIGHT,
      fit: "inside",
    })
    .toFile(targetPath);
  return { width, height, thumbnailWidth, thumbnailHeight };
}

export async function generateBlur(fileBuffer: Buffer | null) {
  if (!fileBuffer) {
    throw new Error("Invalid file");
  }
  const { base64 } = await getPlaiceholder(fileBuffer);
  return base64;
}
