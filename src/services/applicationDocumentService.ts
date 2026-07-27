/**
 * Pick and upload a rental application PDF for a property.
 */

import { Alert, Linking, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { photosService } from './photosService';
import { getAuthenticatedMediaFileUrl } from '../utils/fileUrl';

export const MAX_APPLICATION_PDF_BYTES = 25 * 1024 * 1024;

export type PickedApplicationPdf = {
  uri: string;
  name: string;
  mimeType: string;
  byteSize?: number;
};

/**
 * Ask whether to attach an application PDF when marking Applied.
 * @return attach | skip | cancel
 */
export function promptAttachApplicationPdf(options?: {
  title?: string;
  message?: string;
}): Promise<'attach' | 'skip' | 'cancel'> {
  const title = options?.title ?? 'Submit application PDF?';
  const message =
    options?.message ??
    'Attach the rental application you submitted (PDF). You can also skip and add it later.';

  return new Promise((resolve) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const attach = window.confirm(
        `${title}\n\n${message}\n\nOK = attach PDF, Cancel = skip for now`
      );
      resolve(attach ? 'attach' : 'skip');
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
      { text: 'Skip for now', onPress: () => resolve('skip') },
      { text: 'Attach PDF', onPress: () => resolve('attach') },
    ]);
  });
}

/**
 * Open the system document picker for a single PDF.
 */
export async function pickApplicationPdf(): Promise<PickedApplicationPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf'],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const doc = result.assets[0];
  const mimeType = (doc.mimeType || 'application/pdf').toLowerCase();
  if (
    mimeType !== 'application/pdf' &&
    !doc.name?.toLowerCase().endsWith('.pdf')
  ) {
    throw new Error('Please choose a PDF file');
  }
  const byteSize = typeof doc.size === 'number' ? doc.size : undefined;
  if (byteSize != null && byteSize > MAX_APPLICATION_PDF_BYTES) {
    throw new Error('PDF exceeds 25 MB limit');
  }
  return {
    uri: doc.uri,
    name: doc.name || `application-${Date.now()}.pdf`,
    mimeType: 'application/pdf',
    byteSize,
  };
}

/**
 * Upload a picked PDF and return the media file id.
 * Uses photosService.uploadFile so web (≤15MB) goes through the CF base64
 * path — browser PUT to GCS fails CORS.
 */
export async function uploadApplicationPdf(
  propertyId: string,
  file: PickedApplicationPdf
): Promise<{ fileId: string; fileName: string }> {
  const fileId = await photosService.uploadFile({
    uri: file.uri,
    type: 'application/pdf',
    name: file.name,
    byteSize: file.byteSize,
    propertyId,
  });
  return { fileId, fileName: file.name };
}

/**
 * Pick + upload in one step. Returns null if the user cancels the picker.
 */
export async function pickAndUploadApplicationPdf(
  propertyId: string
): Promise<{ fileId: string; fileName: string } | null> {
  const picked = await pickApplicationPdf();
  if (!picked) return null;
  return uploadApplicationPdf(propertyId, picked);
}

/**
 * Escape text for safe use inside an HTML document.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Open the stored application PDF in the system browser / viewer.
 * @param fileId Media file id.
 * @param fileName Optional display name for the browser tab title (web).
 */
export async function openApplicationPdf(
  fileId: string,
  fileName?: string | null
): Promise<void> {
  const displayName =
    (fileName && fileName.trim()) || 'application.pdf';

  // Web: open a titled tab (opening the getFile URL leaves the tab as "getFile").
  // Open the blank window synchronously under the user gesture, then load bytes.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const win = window.open('about:blank', '_blank');
    if (!win) {
      throw new Error('Unable to open application PDF (popup blocked)');
    }
    const safeTitle = escapeHtml(displayName);
    win.document.title = displayName;
    win.document.body.innerHTML =
      `<p style="font-family:system-ui;padding:1rem">Loading ${safeTitle}…</p>`;

    try {
      const url = await getAuthenticatedMediaFileUrl(fileId, 'original');
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Unable to open application PDF');
      }
      const pdfBlob = await res.blob();
      const typed =
        pdfBlob.type === 'application/pdf'
          ? pdfBlob
          : new Blob([pdfBlob], { type: 'application/pdf' });
      const pdfObjectUrl = URL.createObjectURL(typed);
      win.document.open();
      win.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
          `<title>${safeTitle}</title>` +
          `<style>html,body{margin:0;height:100%;background:#525659}` +
          `embed{width:100%;height:100%;border:0}</style></head>` +
          `<body><embed src="${pdfObjectUrl}" type="application/pdf"/></body></html>`
      );
      win.document.close();
    } catch (err) {
      try {
        win.close();
      } catch {
        // ignore
      }
      throw err;
    }
    return;
  }

  const url = await getAuthenticatedMediaFileUrl(fileId, 'original');
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('Unable to open application PDF');
  }
  await Linking.openURL(url);
}
