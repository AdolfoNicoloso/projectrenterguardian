import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { Photo } from '../types';
import {
  // DO NOT REMOVE CODE — used when video uploads are re-enabled in pickMediaFromLibraryAsync:
  // PHOTO_DOCUMENT_PICKER_TYPES,
  isVideoMimeType,
  processImageForUpload,
} from './photoUploadService';
import { photosService } from './photosService';

/** How many media files to process/upload in parallel. */
export const MEDIA_UPLOAD_CONCURRENCY = 3;

/**
 * Shared library picker options for multi photo selection.
 * `selectionLimit: 0` = system max (unlimited where supported).
 *
 * DO NOT REMOVE CODE — video uploads temporarily disabled.
 * To re-enable videos: use MediaTypeOptions.All, Automatic representation,
 * and Android `legacy: true` (see commented branches below).
 */
export function mediaLibraryPickerOptions(options?: {
  imagesOnly?: boolean;
}): ImagePicker.ImagePickerOptions {
  // DO NOT REMOVE CODE — force images-only while videos are disabled.
  // const imagesOnly = options?.imagesOnly === true;
  const imagesOnly = true;
  void options;
  return {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    // DO NOT REMOVE CODE
    // mediaTypes: imagesOnly
    //   ? ImagePicker.MediaTypeOptions.Images
    //   : ImagePicker.MediaTypeOptions.All,
    allowsMultipleSelection: true,
    selectionLimit: 0,
    orderedSelection: true,
    quality: 0.8,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    // DO NOT REMOVE CODE — when videos are enabled, use Automatic for video assets:
    // preferredAssetRepresentationMode: imagesOnly
    //   ? ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
    //   : ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Automatic,
    // DO NOT REMOVE CODE — Android: legacy GET_CONTENT shows image+video MIME types:
    // ...(Platform.OS === 'android' && !imagesOnly ? { legacy: true } : {}),
  };
}

/**
 * Open the device library / file picker for photos.
 * DO NOT REMOVE CODE — video uploads temporarily disabled (imagesOnly forced).
 * On web, DocumentPicker with `image/*,video/*` was used so camera-roll sheets
 * included videos (expo-image-picker's web accept string often hid them).
 */
export async function pickMediaFromLibraryAsync(options?: {
  imagesOnly?: boolean;
}): Promise<ImagePickerAsset[] | null> {
  // DO NOT REMOVE CODE — force images-only while videos are disabled.
  // const imagesOnly = options?.imagesOnly === true;
  const imagesOnly = true;
  void options;

  if (Platform.OS === 'web') {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      // DO NOT REMOVE CODE — restore video MIME when re-enabling uploads:
      // type: imagesOnly ? ['image/*'] : [...PHOTO_DOCUMENT_PICKER_TYPES],
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
    mimeType: mime || undefined,
    fileSize: doc.size ?? undefined,
    type: isVideo ? 'video' : 'image',
  };
}


export type BatchItemResult<T> =
  | { ok: true; index: number; value: T }
  | { ok: false; index: number; error: unknown };

export type BatchUploadSummary<T> = {
  successCount: number;
  failCount: number;
  successes: T[];
  results: BatchItemResult<T>[];
  firstErrorMessage?: string;
};

export type BatchProgress = {
  completed: number;
  total: number;
  successCount: number;
  failCount: number;
};

/**
 * Run async work over items with a fixed concurrency pool.
 * Failures are captured per-item; the batch continues.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (progress: BatchProgress) => void,
  onItemComplete?: (result: BatchItemResult<R>) => void
): Promise<BatchUploadSummary<R>> {
  const total = items.length;
  const results: BatchItemResult<R>[] = new Array(total);
  let nextIndex = 0;
  let completed = 0;
  let successCount = 0;
  let failCount = 0;

  const report = () => {
    onProgress?.({ completed, total, successCount, failCount });
  };

  report();

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
      return failed.error instanceof Error
        ? failed.error.message
        : String(failed.error);
    })(),
  };
}

/**
 * Process ImagePicker assets and upload+create photo rows with concurrency.
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
  noun = 'photo(s)',
  // DO NOT REMOVE CODE — default was 'photo(s)/video(s)' when videos were enabled
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
