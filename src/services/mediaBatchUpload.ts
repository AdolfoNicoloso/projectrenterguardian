import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { Photo } from '../types';
import {
  PHOTO_DOCUMENT_PICKER_TYPES,
  VIDEO_UPLOADS_ENABLED,
  isVideoMimeType,
  processImageForUpload,
} from './photoUploadService';
import { photosService } from './photosService';

/** How many media files to process/upload in parallel. */
export const MEDIA_UPLOAD_CONCURRENCY = 3;

/**
 * Shared library picker options for multi photo selection.
 * `selectionLimit: 0` = system max (unlimited where supported).
 * Video inclusion follows VIDEO_UPLOADS_ENABLED.
 */
export function mediaLibraryPickerOptions(options?: {
  imagesOnly?: boolean;
}): ImagePicker.ImagePickerOptions {
  const imagesOnly =
    !VIDEO_UPLOADS_ENABLED || options?.imagesOnly === true;
  return {
    mediaTypes: imagesOnly
      ? ImagePicker.MediaTypeOptions.Images
      : ImagePicker.MediaTypeOptions.All,
    allowsMultipleSelection: true,
    selectionLimit: 0,
    orderedSelection: true,
    quality: 0.8,
    preferredAssetRepresentationMode: imagesOnly
      ? ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
      : ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Automatic,
    ...(Platform.OS === 'android' && !imagesOnly ? { legacy: true } : {}),
  };
}

/**
 * Open the device library / file picker for photos (and videos when enabled).
 * On web, DocumentPicker is used so MIME filters are reliable.
 */
export async function pickMediaFromLibraryAsync(options?: {
  imagesOnly?: boolean;
}): Promise<ImagePickerAsset[] | null> {
  const imagesOnly =
    !VIDEO_UPLOADS_ENABLED || options?.imagesOnly === true;

  if (Platform.OS === 'web') {
    const result = await DocumentPicker.getDocumentAsync({
      type: imagesOnly
        ? ['image/*']
        : [...PHOTO_DOCUMENT_PICKER_TYPES],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return null;
    return result.assets.map((doc) => documentToImagePickerAsset(doc));
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission to access your photo library is required.');
  }

  const result = await ImagePicker.launchImageLibraryAsync(
    mediaLibraryPickerOptions({ imagesOnly })
  );
  if (result.canceled || !result.assets?.length) return null;
  return result.assets;
}

function documentToImagePickerAsset(
  doc: DocumentPicker.DocumentPickerAsset
): ImagePickerAsset {
  const mime = doc.mimeType || '';
  const isVideo = isVideoMimeType(mime);
  return {
    uri: doc.uri,
    width: 0,
    height: 0,
    fileName: doc.name || undefined,
    fileSize: doc.size ?? undefined,
    mimeType: mime || undefined,
    type: isVideo ? 'video' : 'image',
    assetId: null,
    duration: null,
    exif: null,
    base64: null,
  } as ImagePickerAsset;
}

export type BatchProgress = {
  completed: number;
  total: number;
  successCount: number;
  failCount: number;
};

export type BatchItemResult<R> =
  | { ok: true; index: number; value: R }
  | { ok: false; index: number; error: unknown };

export type BatchUploadSummary<R> = {
  successCount: number;
  failCount: number;
  successes: R[];
  results: Array<BatchItemResult<R> | undefined>;
  firstErrorMessage?: string;
};

/**
 * Run async work over items with a fixed concurrency pool.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (progress: BatchProgress) => void,
  onItemComplete?: (result: BatchItemResult<R>) => void
): Promise<BatchUploadSummary<R>> {
  const total = items.length;
  const results: Array<BatchItemResult<R> | undefined> = new Array(total);
  let nextIndex = 0;
  let completed = 0;
  let successCount = 0;
  let failCount = 0;

  const report = () => {
    onProgress?.({ completed, total, successCount, failCount });
  };

  const runWorker = async () => {
    while (nextIndex < total) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      let result: BatchItemResult<R>;
      try {
        const value = await worker(item, index);
        result = { ok: true, index, value };
        successCount += 1;
      } catch (error) {
        result = { ok: false, index, error };
        failCount += 1;
        console.error('[mediaBatchUpload] item failed:', error);
      }
      results[index] = result;
      onItemComplete?.(result);
      completed += 1;
      report();
    }
  };

  const poolSize = Math.max(1, Math.min(concurrency, total || 1));
  await Promise.all(
    Array.from({ length: total === 0 ? 0 : poolSize }, () => runWorker())
  );

  return {
    successCount,
    failCount,
    successes: results
      .filter((r): r is Extract<BatchItemResult<R>, { ok: true }> => r?.ok === true)
      .map((r) => r.value),
    results,
    firstErrorMessage: (() => {
      const failed = results.find(
        (r): r is Extract<BatchItemResult<R>, { ok: false }> => r?.ok === false
      );
      if (!failed) return undefined;
      const err = failed.error;
      return err instanceof Error ? err.message : String(err);
    })(),
  };
}

/**
 * Process ImagePicker assets and create photo rows with limited concurrency.
 */
export async function uploadImagePickerAssetsBatch(
  assets: ImagePickerAsset[],
  buildPhotoData: (
    asset: ImagePickerAsset,
    index: number
  ) => Partial<Photo> & { property: string },
  options?: {
    concurrency?: number;
    onProgress?: (progress: BatchProgress) => void;
    onItemComplete?: (result: BatchItemResult<Photo>) => void;
  }
): Promise<BatchUploadSummary<Photo>> {
  return mapWithConcurrency(
    assets,
    options?.concurrency ?? MEDIA_UPLOAD_CONCURRENCY,
    async (asset, index) => {
      const processed = await processImageForUpload(asset);
      return photosService.uploadAndCreatePhoto(
        {
          base64: processed.base64,
          uri: processed.uri,
          type: processed.mimeType,
          name: processed.fileName,
          byteSize: processed.byteSize,
        },
        buildPhotoData(asset, index)
      );
    },
    options?.onProgress,
    options?.onItemComplete
  );
}

/**
 * Upload already-processed files (e.g. DocumentPicker) with concurrency.
 */
export async function uploadProcessedFilesBatch(
  files: Array<{
    base64?: string;
    uri?: string;
    type: string;
    name: string;
    byteSize?: number;
  }>,
  buildPhotoData: (
    file: {
      base64?: string;
      uri?: string;
      type: string;
      name: string;
      byteSize?: number;
    },
    index: number
  ) => Partial<Photo> & { property: string },
  options?: {
    concurrency?: number;
    onProgress?: (progress: BatchProgress) => void;
    onItemComplete?: (result: BatchItemResult<Photo>) => void;
  }
): Promise<BatchUploadSummary<Photo>> {
  return mapWithConcurrency(
    files,
    options?.concurrency ?? MEDIA_UPLOAD_CONCURRENCY,
    async (file, index) =>
      photosService.uploadAndCreatePhoto(file, buildPhotoData(file, index)),
    options?.onProgress,
    options?.onItemComplete
  );
}

export function formatBatchUploadToast(
  successCount: number,
  failCount: number,
  noun = VIDEO_UPLOADS_ENABLED ? 'photo(s)/video(s)' : 'photo(s)',
  firstErrorMessage?: string
): { message: string; type: 'success' | 'error' } | null {
  if (successCount === 0 && failCount === 0) return null;
  if (failCount === 0) {
    return { message: `${successCount} ${noun} uploaded`, type: 'success' };
  }
  if (successCount === 0) {
    return {
      message: firstErrorMessage || `Failed to upload ${noun}`,
      type: 'error',
    };
  }
  return {
    message: firstErrorMessage
      ? `${successCount} uploaded, ${failCount} failed: ${firstErrorMessage}`
      : `${successCount} uploaded, ${failCount} failed`,
    type: 'error',
  };
}
