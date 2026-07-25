import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

/**
 * Result of processing an image/video asset for upload.
 * Prefer `uri` for direct Storage upload; `base64` is a fallback.
 */
export interface ProcessedImage {
  base64?: string;
  uri?: string;
  mimeType: string;
  fileName: string;
  byteSize?: number;
}

/** Max longest edge before client-side downscale. */
export const MAX_UPLOAD_IMAGE_EDGE = 2048;

/** Max video size for direct Storage upload (matches backend). */
export const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;

/**
 * Flip to `true` to re-enable video pick/upload paths.
 * Keep disabled until product is ready; git history has the old branches.
 */
export const VIDEO_UPLOADS_ENABLED = false;

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i;

/** DocumentPicker MIME filters (images always; video when enabled). */
export const PHOTO_DOCUMENT_PICKER_TYPES = VIDEO_UPLOADS_ENABLED
  ? (['image/*', 'video/*'] as const)
  : (['image/*'] as const);

export function isVideoMimeType(mimeType: string | null | undefined): boolean {
  return (mimeType || '').toLowerCase().startsWith('video/');
}

export function isVideoAsset(asset: ImagePickerAsset): boolean {
  if (asset.type === 'video') return true;
  if (isVideoMimeType(asset.mimeType)) return true;
  const name = `${asset.fileName || ''} ${asset.uri || ''}`;
  return VIDEO_EXT_RE.test(name);
}

function guessVideoMime(asset: ImagePickerAsset): string {
  const mime = (asset.mimeType || '').toLowerCase();
  if (mime.startsWith('video/')) return mime;
  const name = (asset.fileName || asset.uri || '').toLowerCase();
  if (name.includes('.mov')) return 'video/quicktime';
  if (name.includes('.webm')) return 'video/webm';
  if (name.includes('.mkv')) return 'video/x-matroska';
  if (name.includes('.avi')) return 'video/x-msvideo';
  if (name.includes('.3gp')) return 'video/3gpp';
  return 'video/mp4';
}

function defaultVideoFileName(asset: ImagePickerAsset, mimeType: string): string {
  if (asset.fileName) return asset.fileName;
  const ext =
    mimeType.includes('quicktime') || mimeType.includes('mov')
      ? 'mov'
      : mimeType.includes('webm')
        ? 'webm'
        : 'mp4';
  return `video-${Date.now()}.${ext}`;
}

// Dynamically import heic2any only on web (it's a browser-only library)
let heic2any: any = null;
let heic2anyLoading: Promise<boolean> | null = null;

/**
 * Loads the heic2any library (web only).
 * @returns Promise that resolves to true if loaded, false otherwise
 */
async function loadHeic2Any(): Promise<boolean> {
  if (Platform.OS !== 'web') {
    return false;
  }
  
  if (heic2any) {
    return true; // Already loaded
  }
  
  if (heic2anyLoading) {
    return heic2anyLoading; // Already loading, wait for it
  }
  
  heic2anyLoading = (async () => {
    try {
      // Use require for compatibility (dynamic import causes TS errors)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const heic2anyModule = require('heic2any');
      // heic2any can be default export or named export
      // @ts-ignore - heic2any module structure varies
      heic2any = heic2anyModule.default || heic2anyModule;
      
      if (!heic2any || typeof heic2any !== 'function') {
        console.error('[PhotoUploadService] heic2any is not a function:', heic2any);
        return false;
      }
      
      console.log('[PhotoUploadService] heic2any loaded successfully');
      return true;
    } catch (error) {
      console.error('[PhotoUploadService] Failed to load heic2any:', error);
      heic2any = null;
      heic2anyLoading = null;
      return false;
    }
  })();
  
  return heic2anyLoading;
}

/**
 * Converts a data URI to a Blob.
 * @param dataUri - The data URI string
 * @returns A Blob object
 */
function dataUriToBlob(dataUri: string): Blob {
  const arr = dataUri.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Converts HEIC to JPEG on web.
 * @param asset - The image picker asset
 * @returns Processed image data (base64, mimeType, fileName)
 * @throws Error if conversion fails or platform is not web
 */
async function convertHeicToJpeg(
  asset: ImagePickerAsset
): Promise<ProcessedImage> {
  if (Platform.OS !== 'web') {
    throw new Error('HEIC conversion only available on web');
  }
  
  // Check WebAssembly support (required for heic2any)
  if (typeof WebAssembly === 'undefined') {
    console.error('[PhotoUploadService] WebAssembly not supported in this browser');
    throw new Error(
      'HEIC conversion requires WebAssembly support, which is not available in this browser. ' +
      'Please convert the image to JPEG manually or use a different browser.'
    );
  }
  
  // Ensure heic2any is loaded
  const loaded = await loadHeic2Any();
  if (!loaded || !heic2any) {
    console.error('[PhotoUploadService] heic2any failed to load');
    throw new Error(
      'HEIC conversion library failed to load. ' +
      'Please refresh the page and try again. ' +
      'If the problem persists, please convert the image to JPEG manually.'
    );
  }
  
  console.log('[PhotoUploadService] WebAssembly and heic2any are available, proceeding with conversion');

  try {
    // Check if file is HEIC
    let isHeic = false;
    
    // Method 1: Check URI for HEIC indicators (for web, URI is most reliable)
    if (asset.uri) {
      const uriLower = asset.uri.toLowerCase();
      isHeic = 
        uriLower.includes('image/heic') || 
        uriLower.includes('image/heif') ||
        uriLower.includes('.heic') || 
        uriLower.includes('.heif');
    }
    
    // Method 2: Check mimeType/fileName if available
    if (!isHeic && (asset.mimeType || asset.fileName)) {
      isHeic =
        asset.mimeType?.includes('heic') ||
        asset.mimeType?.includes('heif') ||
        asset.fileName?.toLowerCase().endsWith('.heic') ||
        asset.fileName?.toLowerCase().endsWith('.heif') ||
        false;
    }

    if (!isHeic) {
      // Not HEIC, return as-is
      if (asset.uri.startsWith('data:')) {
        const mimeType = asset.mimeType || 'image/jpeg';
        return {
          base64: asset.uri,
          mimeType,
          fileName: asset.fileName || `photo-${Date.now()}.jpg`,
        };
      }
      // For non-data URIs on web, read as base64
      const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mimeType = asset.mimeType || 'image/jpeg';
      return {
        base64: `data:${mimeType};base64,${base64Data}`,
        mimeType,
        fileName: asset.fileName || `photo-${Date.now()}.jpg`,
      };
    }

    // Convert HEIC to JPEG using heic2any
    console.log('[PhotoUploadService] Converting HEIC to JPEG on web...');

    // Get the file as a Blob
    let blob: Blob;
    if (asset.uri.startsWith('data:')) {
      blob = dataUriToBlob(asset.uri);
    } else {
      try {
        const response = await fetch(asset.uri);
        blob = await response.blob();
      } catch (fetchError) {
        console.warn('[PhotoUploadService] Fetch failed, trying base64 conversion');
        const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const mimeType = asset.mimeType || 'image/heic';
        blob = dataUriToBlob(`data:${mimeType};base64,${base64Data}`);
      }
    }

    // Ensure blob has correct type for heic2any
    let fileBlob = blob;
    if (!blob.type || (!blob.type.includes('heic') && !blob.type.includes('heif'))) {
      console.log('[PhotoUploadService] Blob type is not HEIC, creating new blob with HEIC type');
      fileBlob = new Blob([blob], { type: 'image/heic' });
    }
    
    console.log('[PhotoUploadService] Starting heic2any conversion...');
    const startTime = Date.now();
    let conversionCompleted = false;
    
    // Call heic2any with explicit error handling
    let conversionPromise: Promise<Blob | Blob[]>;
    try {
      conversionPromise = heic2any({
        blob: fileBlob,
        toType: 'image/jpeg',
        quality: 0.9,
      }) as Promise<Blob | Blob[]>;
      
      conversionPromise = conversionPromise.then((result) => {
        conversionCompleted = true;
        return result;
      });
    } catch (initError) {
      console.error('[PhotoUploadService] Error calling heic2any:', initError);
      throw new Error(
        `Failed to start HEIC conversion: ${initError instanceof Error ? initError.message : 'Unknown error'}`
      );
    }

    // Add timeout (20 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        if (!conversionCompleted) {
          const elapsed = Date.now() - startTime;
          console.error(`[PhotoUploadService] HEIC conversion timed out after ${elapsed}ms`);
          reject(
            new Error(
              `HEIC conversion timed out after ${elapsed}ms. ` +
              `The file may be too large or corrupted. ` +
              `Please try converting it to JPEG manually.`
            )
          );
        }
      }, 20000);
    });

    let convertedBlob: Blob | Blob[];
    try {
      convertedBlob = await Promise.race([
        conversionPromise,
        timeoutPromise,
      ]) as Blob | Blob[];
      
      const elapsed = Date.now() - startTime;
      console.log(`[PhotoUploadService] heic2any completed in ${elapsed}ms`);
    } catch (raceError) {
      const elapsed = Date.now() - startTime;
      console.error(`[PhotoUploadService] Conversion failed after ${elapsed}ms:`, raceError);
      throw raceError;
    }

    // heic2any returns an array, get the first result
    const jpegBlob = Array.isArray(convertedBlob)
      ? convertedBlob[0]
      : convertedBlob;

    if (!jpegBlob) {
      throw new Error('HEIC conversion returned no result');
    }

    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        if (!dataUri) {
          reject(new Error('Failed to read converted JPEG'));
          return;
        }
        
        // Ensure the data URI has the correct MIME type (image/jpeg)
        let base64: string;
        if (dataUri.startsWith('data:image/jpeg')) {
          base64 = dataUri;
        } else if (dataUri.startsWith('data:')) {
          const base64Data = dataUri.split(',')[1];
          base64 = `data:image/jpeg;base64,${base64Data}`;
        } else {
          base64 = `data:image/jpeg;base64,${dataUri}`;
        }
        
        const fileName = (asset.fileName || `photo-${Date.now()}.jpg`)
          .replace(/\.heic$/i, '.jpg')
          .replace(/\.heif$/i, '.jpg');
        
        resolve({
          base64,
          mimeType: 'image/jpeg',
          fileName: fileName.endsWith('.jpg') ? fileName : `${fileName}.jpg`,
        });
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(jpegBlob);
    });
  } catch (error) {
    console.error('[PhotoUploadService] HEIC conversion failed:', error);
    throw new Error(
      `Failed to convert HEIC file to JPEG: ${error instanceof Error ? error.message : 'Unknown error'}. Please convert it manually.`
    );
  }
}

/**
 * Downscale images whose longest edge exceeds MAX_UPLOAD_IMAGE_EDGE.
 * Returns null when resize is unnecessary or unavailable.
 */
async function resizeImageForUpload(
  asset: ImagePickerAsset
): Promise<ProcessedImage | null> {
  const width = asset.width || 0;
  const height = asset.height || 0;
  const longest = Math.max(width, height);
  if (!asset.uri || longest <= 0 || longest <= MAX_UPLOAD_IMAGE_EDGE) {
    return null;
  }

  try {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const scale = MAX_UPLOAD_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height);
      const targetW = Math.max(1, Math.round(bitmap.width * scale));
      const targetH = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      bitmap.close?.();
      const outBlob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!outBlob) return null;
      const objectUrl = URL.createObjectURL(outBlob);
      return {
        uri: objectUrl,
        mimeType: 'image/jpeg',
        fileName: (asset.fileName || `photo-${Date.now()}.jpg`).replace(
          /\.(heic|heif|png|webp)$/i,
          '.jpg'
        ),
        byteSize: outBlob.size,
      };
    }

    const scale = MAX_UPLOAD_IMAGE_EDGE / longest;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: targetW, height: targetH } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    let byteSize: number | undefined;
    try {
      const info = await FileSystem.getInfoAsync(result.uri);
      if (info.exists && typeof (info as { size?: number }).size === 'number') {
        byteSize = (info as { size: number }).size;
      }
    } catch {
      // ignore
    }
    return {
      uri: result.uri,
      mimeType: 'image/jpeg',
      fileName: (asset.fileName || `photo-${Date.now()}.jpg`).replace(
        /\.(heic|heif|png|webp)$/i,
        '.jpg'
      ),
      byteSize,
    };
  } catch (err) {
    console.warn('[PhotoUploadService] resize skipped:', err);
    return null;
  }
}

/**
 * Processes an image or video asset for upload.
 * Handles HEIC conversion on web for images; videos keep a local URI
 * for direct-to-Storage upload (base64 through Cloud Functions is too small).
 */
export async function processImageForUpload(asset: ImagePickerAsset): Promise<ProcessedImage> {
  if (isVideoAsset(asset)) {
    if (!VIDEO_UPLOADS_ENABLED) {
      throw new Error('Video uploads are temporarily disabled');
    }
    const mimeType = guessVideoMime(asset);
    const fileName = defaultVideoFileName(asset, mimeType);
    let byteSize = typeof asset.fileSize === 'number' ? asset.fileSize : undefined;
    if (byteSize == null && asset.uri && !asset.uri.startsWith('data:')) {
      try {
        const info = await FileSystem.getInfoAsync(asset.uri);
        if (info.exists && typeof (info as { size?: number }).size === 'number') {
          byteSize = (info as { size: number }).size;
        }
      } catch {
        // size unknown — backend still accepts without size
      }
    }
    if (byteSize != null && byteSize > MAX_VIDEO_UPLOAD_BYTES) {
      throw new Error('Video exceeds 200 MB limit');
    }
    if (asset.uri) {
      return {
        uri: asset.uri,
        mimeType,
        fileName,
        byteSize,
        ...(asset.uri.startsWith('data:') ? { base64: asset.uri } : {}),
      };
    }
    throw new Error('Video URI is missing');
  }

  // On web, check if we need to convert HEIC to JPEG
  if (Platform.OS === 'web') {
    let isHeic = false;
    
    // Method 1: Check URI for HEIC indicators (most reliable on web)
    if (asset.uri) {
      const uriLower = asset.uri.toLowerCase();
      isHeic = 
        uriLower.includes('image/heic') || 
        uriLower.includes('image/heif') ||
        uriLower.includes('.heic') || 
        uriLower.includes('.heif');
    }
    
    // Method 2: Check mimeType/fileName if available
    if (!isHeic && (asset.mimeType || asset.fileName)) {
      isHeic =
        asset.mimeType?.includes('heic') ||
        asset.mimeType?.includes('heif') ||
        asset.fileName?.toLowerCase().endsWith('.heic') ||
        asset.fileName?.toLowerCase().endsWith('.heif') ||
        false;
    }
    
    // Method 3: Try to detect by reading file signature (magic bytes)
    if (!isHeic && asset.uri && !asset.uri.startsWith('data:')) {
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.slice(0, 12).arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const signature = String.fromCharCode(...bytes.slice(4, 8));
        const brand = String.fromCharCode(...bytes.slice(8, 12));
        if (signature === 'ftyp' && (brand.includes('heic') || brand.includes('heif') || brand.includes('mif1'))) {
          isHeic = true;
          console.log('[PhotoUploadService] Detected HEIC by file signature');
        }
      } catch (sigError) {
        console.log('[PhotoUploadService] Could not read file signature:', sigError);
      }
    }

    // Ensure heic2any is loaded only when HEIC is detected
    if (isHeic) {
      const heic2anyLoaded = await loadHeic2Any();

      if (heic2anyLoaded && heic2any) {
        return await convertHeicToJpeg(asset);
      }
      throw new Error(
        'HEIC conversion library not loaded. Please refresh the page and try again.'
      );
    }
  }

  // Resize large images before upload (max 2048px edge) when possible.
  const resized = await resizeImageForUpload(asset);
  if (resized) {
    return resized;
  }

  // Prefer local URI for direct-to-Storage upload (avoids base64 through CF).
  if (asset.uri && !asset.uri.startsWith('data:')) {
    let byteSize =
      typeof asset.fileSize === 'number' ? asset.fileSize : undefined;
    if (byteSize == null && Platform.OS !== 'web') {
      try {
        const info = await FileSystem.getInfoAsync(asset.uri);
        if (info.exists && typeof (info as { size?: number }).size === 'number') {
          byteSize = (info as { size: number }).size;
        }
      } catch {
        // size unknown
      }
    }
    return {
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || `photo-${Date.now()}.jpg`,
      byteSize,
    };
  }

  // Data URI fallback
  if (asset.uri.startsWith('data:')) {
    const mimeType = asset.mimeType || 'image/jpeg';
    return {
      base64: asset.uri,
      uri: asset.uri,
      mimeType,
      fileName: asset.fileName || `photo-${Date.now()}.jpg`,
    };
  }

  // Native read as base64 last resort
  const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mimeType = asset.mimeType || 'image/jpeg';
  return {
    base64: `data:${mimeType};base64,${base64Data}`,
    mimeType,
    fileName: asset.fileName || `photo-${Date.now()}.jpg`,
  };
}

