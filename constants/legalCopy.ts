import { LEGAL_ENTITY } from './legalEntity';

const { companyName, registryCode, contactEmail, appTradeName, lastUpdated } = LEGAL_ENTITY;

export const TERMS_SECTIONS: { heading?: string; body: string }[] = [
  {
    heading: '1. Agreement',
    body: `These Terms of Service ("Terms") govern your use of the ${appTradeName} mobile application ("App") operated by ${companyName} ("we", "us", "our"), registry code ${registryCode}, Estonia. By creating an account or using the App, you agree to these Terms. If you do not agree, do not use the App.`,
  },
  {
    heading: '2. The service',
    body: `${appTradeName} helps you connect with friends: share availability, make plans, chat, and related social features. We may change, suspend, or discontinue features with reasonable notice where practicable.`,
  },
  {
    heading: '3. Eligibility and account',
    body: `You must be at least 16 years old (or the age of digital consent in your country, if higher) to use the App. You are responsible for keeping your login credentials confidential and for all activity under your account. You must provide accurate information and update it when it changes.`,
  },
  {
    heading: '4. Acceptable use',
    body: `You agree not to: (a) break applicable law; (b) harass, abuse, or harm others; (c) upload malware or attempt to breach security; (d) scrape or overload our systems without permission; (e) impersonate others; (f) use the App for spam or unsolicited commercial messaging. We may suspend or terminate accounts that violate these rules.`,
  },
  {
    heading: '5. User content',
    body: `You retain rights to content you submit (e.g. profile text, images). You grant us a licence to host, store, process, and display that content solely to operate and improve the App. You are responsible for ensuring you have the right to share any content you upload.`,
  },
  {
    heading: '6. Intellectual property',
    body: `The App, branding, and our materials are owned by us or our licensors. Except for the limited rights to use the App under these Terms, no rights are granted to you.`,
  },
  {
    heading: '7. Third-party services',
    body: `The App relies on infrastructure and service providers (e.g. authentication and database hosting). Their terms may also apply where you interact with their services.`,
  },
  {
    heading: '8. Disclaimers',
    body: `The App is provided "as is" to the fullest extent permitted by law. We do not guarantee uninterrupted or error-free operation. You use the App at your own risk regarding interactions with other users.`,
  },
  {
    heading: '9. Limitation of liability',
    body: `To the extent permitted by mandatory EU/EEA law (including Estonian law), we are not liable for indirect or consequential damages. Our total liability for claims arising from the App is limited to the greater of EUR 50 or amounts you paid us in the 12 months before the claim (if any), except where liability cannot be limited by law.`,
  },
  {
    heading: '10. Termination',
    body: `You may stop using the App and request account deletion as described in our Privacy Policy. We may suspend or terminate access for breach of these Terms or legal requirements.`,
  },
  {
    heading: '11. Governing law and disputes',
    body: `These Terms are governed by the laws of Estonia, without regard to conflict-of-law rules. Mandatory consumer protections in your country of residence remain unaffected. EU consumers may also use the EU online dispute resolution platform (ODR).`,
  },
  {
    heading: '12. Changes',
    body: `We may update these Terms. We will notify you of material changes through the App or by email where appropriate. Continued use after the effective date constitutes acceptance unless applicable law requires otherwise.`,
  },
  {
    heading: '13. Contact',
    body: `Questions about these Terms: ${contactEmail}.`,
  },
];

export const PRIVACY_SECTIONS: { heading?: string; body: string }[] = [
  {
    heading: 'Who we are',
    body: `The data controller for personal data processed through ${appTradeName} is ${companyName}, registry code ${registryCode}, Estonia. Contact: ${contactEmail}. This notice was last updated: ${lastUpdated}.`,
  },
  {
    heading: 'What data we process',
    body: `We may process: account and authentication data (e.g. email, user ID from our identity provider); profile data (e.g. name, username, photo, bio/vibe); social graph and interactions (friends, invites, availability, plans, responses); messages and content you send in the App; device and technical data (e.g. device type, OS, app version, push notification tokens); usage and security logs needed to run and protect the service.`,
  },
  {
    heading: 'Why we process it (purposes and legal bases)',
    body: `Under the EU General Data Protection Regulation (GDPR), we rely on: performance of a contract — providing the App and features you request; legitimate interests — security, abuse prevention, product improvement, and service analytics where balanced against your rights; consent — where required (e.g. certain marketing or optional analytics, if offered); legal obligation — where we must comply with law.`,
  },
  {
    heading: 'Recipients and processors',
    body: `We use trusted service providers as processors (e.g. cloud hosting, authentication, database, email delivery). They process data only on our instructions and under appropriate agreements. Some providers may be located outside the EEA; where required, we use safeguards such as the EU Commission’s standard contractual clauses.`,
  },
  {
    heading: 'Retention',
    body: `We keep data only as long as needed for the purposes above, including legal, tax, and dispute resolution. Account data is generally deleted or anonymised when you delete your account, subject to limited exceptions (e.g. backups for a short period, or legal retention).`,
  },
  {
    heading: 'Your rights (GDPR)',
    body: `You may have the right to: access your data; rectification; erasure ("right to be forgotten"); restriction of processing; data portability; object to processing based on legitimate interests; withdraw consent where processing is consent-based; and lodge a complaint with a supervisory authority. In Estonia, the Data Protection Inspectorate (Andmekaitse Inspektsioon) is the relevant authority.`,
  },
  {
    heading: 'How to exercise your rights',
    body: `Contact us at ${contactEmail}. We will respond within one month (extendable in complex cases as allowed by law). You may also use in-app settings where available to manage profile and account options.`,
  },
  {
    heading: 'Children',
    body: `The App is not directed at children under 16 (or higher age of digital consent in your Member State). We do not knowingly collect personal data from children below that threshold.`,
  },
  {
    heading: 'Security',
    body: `We implement appropriate technical and organisational measures to protect personal data. No method of transmission over the internet is 100% secure.`,
  },
  {
    heading: 'Changes to this notice',
    body: `We may update this Privacy Policy. We will post the updated version in the App and, for material changes, provide notice as appropriate.`,
  },
];
