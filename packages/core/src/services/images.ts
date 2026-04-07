import type Database from 'better-sqlite3';

export interface ImageResult {
  data: Buffer;
  contentType: string;
}

/**
 * Retrieve an image from the IMAGES table by its id (e.g. "1/13/97/26.PNG").
 * Returns null if not found.
 */
export const getImage = (
  db: Database.Database,
  imageId: string,
): ImageResult | null => {
  const row = db
    .prepare('SELECT data, content_type FROM IMAGES WHERE id = ? LIMIT 1')
    .get(imageId.toUpperCase()) as
    | { data: Buffer; content_type: string }
    | undefined;

  if (!row) return null;

  return {
    data: row.data,
    contentType: row.content_type || 'image/png',
  };
};
