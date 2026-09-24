export const EMPTY_UUIDV4 = "00000000-0000-0000-0000-000000000000";

/** "1 file", "3 files" */
export function plural(count: number, one: string, many: string) {
    return `${count} ${count === 1 ? one : many}`;
}

export function isUuidv4(uuid?: string) {
  if (!uuid) {
    return false;
  }
  return /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(
    uuid
  );
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error || error instanceof ErrorEvent)
    return error.message;
  const str = String(error);
  return str === "Undefined" ? "Unknown error" : str;
}

export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function caseInsensitiveSorter<T, K extends keyof T>(
  key: K,
  asc: boolean = true
): (a: T, b: T) => number {
  return (a: T, b: T) => {
    const valueA = String(a[key]).toLowerCase();
    const valueB = String(b[key]).toLowerCase();

    const result = valueA.localeCompare(valueB, undefined, {
      sensitivity: "accent",
    });
    return asc ? result : -result;
  };
}

export function getFileSrc(options: {
  collectionId: string;
  fileId: string;
  mimeType: string;
  thumbnail?: boolean;
  /** A video's Rendition instead of its original */
  rendition?: boolean;
  /** A video's Scrub preview, an image variant of the video */
  scrubPreview?: boolean;
}) {
  const {
    collectionId,
    fileId,
    mimeType,
    thumbnail = false,
    rendition = false,
    scrubPreview = false,
  } = options;
  if (scrubPreview) {
    return `/api/collections/${collectionId}/files?image=${fileId}&variant=scrubPreview`;
  }
  const isImage = mimeType.includes("image");
  return `/api/collections/${collectionId}/files?${
    thumbnail ? "thumbnail" : isImage ? "image" : "video"
  }=${fileId}${rendition ? "&variant=rendition" : ""}`;
}

export function isValidDate(d: any) {
  return !isNaN(d) && d instanceof Date;
}

export function removeSubstring(input: string, substring: string): string {
  const regex = new RegExp(substring, "gi");
  return input.replace(regex, "").replace(/\(\)/g, "").trim();
}

export function timestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}
