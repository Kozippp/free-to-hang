import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen';
import { PRIVACY_SECTIONS } from '@/constants/legalCopy';

export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen sections={PRIVACY_SECTIONS} />;
}
