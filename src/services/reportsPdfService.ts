/**
 * Server-backed report PDF: generate, open, and download.
 */

import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import type { Report } from '../types';
import { backendClient } from './backendClient';
import { openApplicationPdf } from './applicationDocumentService';
import { getAuthenticatedMediaFileUrl } from '../utils/fileUrl';

/**
 * Ask the Cloud Function to build a PDF from the report snapshot.
 */
export async function generateReportPdf(reportId: string): Promise<Report> {
  const response = await backendClient.call<{ data: Report }>(
    'generateReportPdf',
    {
      method: 'POST',
      body: JSON.stringify({ reportId }),
    }
  );
  return response.data;
}

/**
 * Open the stored report PDF in a viewer / browser tab.
 */
export async function openReportPdf(
  fileId: string,
  fileName = 'report.pdf'
): Promise<void> {
  await openApplicationPdf(fileId, fileName);
}

/**
 * Download (web) or share/save (native) the report PDF.
 */
export async function downloadReportPdf(
  fileId: string,
  fileName = 'report.pdf'
): Promise<void> {
  const url = await getAuthenticatedMediaFileUrl(fileId, 'original');
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Unable to download PDF');
    }
    const blob = await res.blob();
    const typed =
      blob.type === 'application/pdf'
        ? blob
        : new Blob([blob], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(typed);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = safeName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  }

  const target = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${safeName}`;
  const result = await FileSystem.downloadAsync(url, target);
  if (result.status !== 200) {
    throw new Error('Unable to download PDF');
  }
  await Share.share({
    url: result.uri,
    title: safeName,
    message: Platform.OS === 'android' ? result.uri : undefined,
  });
}

/** @deprecated Prefer generateReportPdf / openReportPdf */
export async function generateMoveOutReportPdf(
  report: Report,
  _property: unknown
): Promise<{ reportId: string; fileId?: string } | null> {
  const updated = await generateReportPdf(report.id);
  return { reportId: updated.id, fileId: updated.pdf_file };
}

/** @deprecated Prefer openReportPdf */
export async function openMoveOutReportPdf(fileId: string): Promise<void> {
  await openReportPdf(fileId, 'move-out-report.pdf');
}
