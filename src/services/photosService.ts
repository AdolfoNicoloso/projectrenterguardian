import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { backendClient, BackendError } from './backendClient';
import type { Photo } from '../types';
import {
  isVideoMimeType,
  MAX_VIDEO_UPLOAD_BYTES,
} from './photoUploadService';

export type UploadableFile = {
  /** Data URI or raw base64 (images / small files). */
  base64?: string;
  /** Local file URI for direct Storage upload (videos). */
  uri?: string;
  type: string;
  name: string;
  propertyId?: string;
  byteSize?: number;
};

function estimateBytesFromBase64(base64: string): number {
  const payload = base64.includes(',') ? base64.split(',')[1] : base64;
  return Math.floor((payload.length * 3) / 4);
}

async function blobFromUploadable(file: UploadableFile): Promise<Blob> {
  if (file.uri && !file.uri.startsWith('data:')) {
    const response = await fetch(file.uri);
    if (!response.ok) {
      throw new Error('Failed to read media file for upload');
    }
    return await response.blob();
  }
  if (file.base64) {
    const dataUri = file.base64.startsWith('data:')
      ? file.base64
      : `data:${file.type};base64,${file.base64}`;
    const res = await fetch(dataUri);
    return await res.blob();
  }
  if (file.uri?.startsWith('data:')) {
    const res = await fetch(file.uri);
    return await res.blob();
  }
  throw new Error('Missing file data for upload');
}

/**
 * Domain service for photo operations.
 * Calls Firebase Cloud Functions only (Firestore/Storage on the server).
 * Videos use signed direct-to-GCS uploads; images use uploadFile base64.
 */
class PhotosService {
  /**
   * Get all photos for a property.
   * Verifies property ownership before returning photos.
   * @param {string} propertyId The property ID.
   * @param {object} filters Optional filters.
   * @param {string} filters.status Filter by assignment status.
   * @param {string} filters.spaceId Filter by space ID.
   * @return {Promise<Photo[]>} The photos list.
   */
  async getPhotos(
    propertyId: string,
    filters?: { status?: 'unassigned' | 'assigned'; spaceId?: string }
  ): Promise<Photo[]> {
    const encodedId = encodeURIComponent(propertyId);
    let query = `getPhotos?propertyId=${encodedId}`;
    if (filters?.status) {
      query += `&status=${encodeURIComponent(filters.status)}`;
    }
    if (filters?.spaceId) {
      query += `&spaceId=${encodeURIComponent(filters.spaceId)}`;
    }
    const response = await backendClient.call<{ data: Photo[] }>(query, {
      method: 'GET',
    });
    return response.data || [];
  }

  /**
   * Get a single photo by ID.
   * Verifies property ownership before returning photo.
   * @param {string} photoId The photo ID.
   * @return {Promise<Photo>} The photo.
   */
  async getPhoto(photoId: string): Promise<Photo> {
    const encodedId = encodeURIComponent(photoId);
    const response = await backendClient.call<{ data: Photo }>(
      `getPhoto?photoId=${encodedId}`,
      {
        method: 'GET',
      }
    );
    return response.data;
  }

  /**
   * Create a new photo.
   * Verifies property ownership before creating.
   * @param {Partial<Photo>} data Photo data (property, file, captured_at, etc.).
   * @return {Promise<Photo>} The created photo.
   */
  async createPhoto(data: Partial<Photo>): Promise<Photo> {
    const response = await backendClient.call<{ data: Photo }>('createPhoto', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * Update a photo.
   * Verifies property ownership before updating.
   * @param {string} photoId The photo ID.
   * @param {Partial<Photo>} updates The fields to update.
   * @return {Promise<Photo>} The updated photo.
   */
  async updatePhoto(photoId: string, updates: Partial<Photo>): Promise<Photo> {
    const response = await backendClient.call<{ data: Photo }>('updatePhoto', {
      method: 'PATCH',
      body: JSON.stringify({ id: photoId, ...updates }),
    });
    return response.data;
  }

  /**
   * Upload via Cloud Function base64 body (images / small files only).
   */
  async uploadFileBase64(file: {
    base64: string;
    type: string;
    name: string;
    propertyId?: string;
  }): Promise<string> {
    const response = await backendClient.call<{ data: { id: string } }>(
      'uploadFile',
      {
        method: 'POST',
        body: JSON.stringify(file),
      }
    );
    return response.data.id;
  }

  /**
   * Direct-to-Storage upload using a short-lived signed PUT URL.
   * Required for videos (Cloud Functions reject video base64 bodies).
   */
  async uploadFileDirect(file: UploadableFile): Promise<string> {
    const size =
      file.byteSize ??
      (file.base64 ? estimateBytesFromBase64(file.base64) : undefined);

    if (size != null && size > MAX_VIDEO_UPLOAD_BYTES) {
      throw new BackendError(
        isVideoMimeType(file.type)
          ? 'Video exceeds 200 MB limit'
          : 'File exceeds size limit',
        400
      );
    }

    const session = await backendClient.call<{
      data: { fileId: string; uploadUrl: string; contentType: string };
    }>('createMediaUpload', {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        type: file.type,
        propertyId: file.propertyId,
        size,
      }),
    });

    const { fileId, uploadUrl, contentType } = session.data;

    try {
      const canNativeUpload =
        Platform.OS !== 'web' &&
        !!file.uri &&
        !file.uri.startsWith('data:') &&
        !file.uri.startsWith('blob:');

      if (canNativeUpload && file.uri) {
        const result = await FileSystem.uploadAsync(uploadUrl, file.uri, {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'Content-Type': contentType,
          },
        });
        if (result.status < 200 || result.status >= 300) {
          throw new BackendError(
            `Storage upload failed (${result.status})`,
            result.status
          );
        }
      } else {
        const blob = await blobFromUploadable(file);
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
          },
          body: blob,
        });
        if (!putRes.ok) {
          throw new BackendError(
            `Storage upload failed (${putRes.status})`,
            putRes.status
          );
        }
      }

      await backendClient.call<{ ok: boolean }>('finalizeMediaUpload', {
        method: 'POST',
        body: JSON.stringify({ fileId }),
      });
      return fileId;
    } catch (err) {
      try {
        await this.deleteUploadedFile(fileId);
      } catch (cleanupErr) {
        console.warn('[photosService] direct upload cleanup failed:', cleanupErr);
      }
      throw err;
    }
  }

  /**
   * Upload a file; chooses direct Storage for videos, base64 function for images.
   */
  async uploadFile(file: UploadableFile): Promise<string> {
    const isVideo = isVideoMimeType(file.type);
    if (isVideo) {
      // DO NOT REMOVE CODE — video uploads temporarily disabled.
      // Re-enable by removing this throw and restoring the direct-upload branch below.
      throw new Error('Video uploads are temporarily disabled');
      // DO NOT REMOVE CODE
      // return this.uploadFileDirect(file);
    }
    // DO NOT REMOVE CODE — direct Storage path for large / URI-only files (used by videos):
    // if (file.uri && !file.base64) {
    //   return this.uploadFileDirect(file);
    // }
    if (!file.base64) {
      throw new Error('Missing base64 for image upload');
    }
    return this.uploadFileBase64({
      base64: file.base64,
      type: file.type,
      name: file.name,
      propertyId: file.propertyId,
    });
  }

  /**
   * Best-effort delete of an orphaned upload (media_files + Storage).
   * Only succeeds for files the caller uploaded.
   * @param {string} fileId Media file id from uploadFile.
   */
  async deleteUploadedFile(fileId: string): Promise<void> {
    await backendClient.call<{ ok: boolean }>('deleteUploadedFile', {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    });
  }

  /**
   * Upload bytes then create the photo row. If createPhoto fails after a
   * successful upload, best-effort delete the orphaned media file.
   */
  async uploadAndCreatePhoto(
    file: UploadableFile,
    photoData: Partial<Photo> & { property: string }
  ): Promise<Photo> {
    const fileId = await this.uploadFile({
      ...file,
      propertyId: photoData.property,
    });
    try {
      return await this.createPhoto({ ...photoData, file: fileId });
    } catch (err) {
      try {
        await this.deleteUploadedFile(fileId);
      } catch (cleanupErr) {
        console.warn('[photosService] orphan cleanup failed:', cleanupErr);
      }
      throw err;
    }
  }

  /**
   * Delete a photo.
   * Verifies property ownership before deleting.
   * @param {string} photoId The photo ID.
   * @return {Promise<void>} Resolves when photo is deleted.
   */
  async deletePhoto(photoId: string): Promise<void> {
    await backendClient.call<{ ok: boolean; message?: string }>('deletePhoto', {
      method: 'POST',
      body: JSON.stringify({ id: photoId }),
    });
  }
}

export const photosService = new PhotosService();
