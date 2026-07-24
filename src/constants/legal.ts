/**
 * Legal & support copy for Profile / Settings.
 * In-app documents follow the common consumer-app pattern (Privacy, Terms,
 * product notices) until hosted URLs are published.
 */

export const APP_DISPLAY_NAME = 'Renter Guardian';

export const SUPPORT_EMAIL = 'support@renterguardian.app';

/** Shown in About / footer. */
export const APP_VERSION = '1.0.0';

export const LEGAL_LAST_UPDATED = 'July 24, 2026';

export type LegalDocId = 'privacy' | 'terms' | 'notices';

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  /** Short row subtitle on the settings list. */
  subtitle: string;
  /** Optional public URL when hosted; otherwise the in-app body is shown. */
  url?: string | null;
  sections: Array<{ heading?: string; paragraphs: string[] }>;
};

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    subtitle: 'How we collect and use your information',
    url: null,
    sections: [
      {
        paragraphs: [
          `Last updated: ${LEGAL_LAST_UPDATED}`,
          `This Privacy Policy explains how ${APP_DISPLAY_NAME} (“we”, “us”) collects, uses, and shares information when you use our mobile and web applications (the “Service”).`,
        ],
      },
      {
        heading: 'Information we collect',
        paragraphs: [
          'Account information you provide, such as name, email address, and phone number used to sign in.',
          'Property and documentation data you upload or create, including addresses, lease details, photos, videos (when enabled), notes, tour schedules, inspections, and generated reports.',
          'Technical information such as device type, app version, and basic diagnostic logs needed to operate and secure the Service.',
        ],
      },
      {
        heading: 'How we use information',
        paragraphs: [
          'To provide, maintain, and improve the Service—including storing your documentation, sharing access with collaborators you invite, and sending in-app or email notifications you enable.',
          'To authenticate you, prevent abuse, and protect the security of accounts and data.',
          'To communicate with you about the Service, including support responses and important product notices.',
        ],
      },
      {
        heading: 'Sharing',
        paragraphs: [
          'We do not sell your personal information.',
          'We share data with service providers that help us run the Service (for example cloud hosting, authentication, and storage), under contracts that limit their use of your data.',
          'If you invite someone to a property, they can see information for that property according to the access role you grant.',
          'We may disclose information if required by law or to protect rights, safety, and the integrity of the Service.',
        ],
      },
      {
        heading: 'Retention & your choices',
        paragraphs: [
          'We retain account and documentation data while your account is active and as needed to provide the Service.',
          'You may update profile details in Settings and request support assistance for account or data questions.',
          `Contact us at ${SUPPORT_EMAIL} for privacy-related requests.`,
        ],
      },
      {
        heading: 'Changes',
        paragraphs: [
          'We may update this Privacy Policy from time to time. We will post the updated version in the app and revise the “Last updated” date above.',
        ],
      },
    ],
  },
  terms: {
    id: 'terms',
    title: 'Terms of Service',
    subtitle: 'Rules for using Renter Guardian',
    url: null,
    sections: [
      {
        paragraphs: [
          `Last updated: ${LEGAL_LAST_UPDATED}`,
          `By creating an account or using ${APP_DISPLAY_NAME}, you agree to these Terms of Service.`,
        ],
      },
      {
        heading: 'The Service',
        paragraphs: [
          `${APP_DISPLAY_NAME} helps renters document property condition, tours, and related records. Features may change as we improve the product.`,
          'You must be at least 18 years old (or the age of majority where you live) to use the Service.',
        ],
      },
      {
        heading: 'Your account & content',
        paragraphs: [
          'You are responsible for your account credentials and for activity under your account.',
          'You retain ownership of content you upload. You grant us a limited license to host, process, and display that content solely to operate the Service (including sharing with collaborators you authorize).',
          'Do not upload unlawful content or content you do not have the right to use. Do not attempt to disrupt or reverse engineer the Service except as allowed by law.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'Use the Service only for lawful purposes. Do not harass others, infringe intellectual property, or misuse collaboration and sharing features.',
        ],
      },
      {
        heading: 'Disclaimers',
        paragraphs: [
          'THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
          `${APP_DISPLAY_NAME} is a documentation tool. It does not provide legal advice, professional inspection services, insurance coverage, or guarantees about how records will be treated by landlords, courts, agencies, or insurers.`,
        ],
      },
      {
        heading: 'Limitation of liability',
        paragraphs: [
          'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF DATA, PROFITS, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE.',
        ],
      },
      {
        heading: 'Termination',
        paragraphs: [
          'You may stop using the Service at any time. We may suspend or terminate access if you violate these Terms or if we discontinue the Service.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          `Questions about these Terms: ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  notices: {
    id: 'notices',
    title: 'Important notices',
    subtitle: 'Product limitations and documentation disclaimer',
    url: null,
    sections: [
      {
        paragraphs: [
          `Last updated: ${LEGAL_LAST_UPDATED}`,
          `${APP_DISPLAY_NAME} is designed to help you organize photos, notes, and timelines related to rental properties. Please read the following carefully.`,
        ],
      },
      {
        heading: 'Not legal or professional advice',
        paragraphs: [
          'Nothing in the Service is legal advice, and using the Service does not create an attorney–client relationship. For legal questions about your lease, deposits, or disputes, consult a licensed attorney in your jurisdiction.',
          'The Service is not a substitute for a licensed home inspection, appraisal, or insurance assessment.',
        ],
      },
      {
        heading: 'Your records',
        paragraphs: [
          'You are responsible for the accuracy and completeness of information you enter and media you upload.',
          'Generated reports and PDFs summarize information you provide. They are user documentation aids—not certified evidence, and not a guarantee of admissibility, acceptance by a landlord, or any particular outcome.',
        ],
      },
      {
        heading: 'Sharing & collaborators',
        paragraphs: [
          'If you invite others to a property, they may view or edit information based on the role you assign. Share access only with people you trust.',
        ],
      },
      {
        heading: 'Availability',
        paragraphs: [
          'We aim for reliable access but do not guarantee uninterrupted service. Keep your own backups of critical documents when needed.',
        ],
      },
    ],
  },
};

export function getLegalDocument(id: string): LegalDocument | null {
  if (id === 'privacy' || id === 'terms' || id === 'notices') {
    return LEGAL_DOCUMENTS[id];
  }
  return null;
}
