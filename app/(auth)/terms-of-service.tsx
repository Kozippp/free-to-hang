import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen';
import { TERMS_SECTIONS } from '@/constants/legalCopy';

export default function TermsOfServiceScreen() {
  return <LegalDocumentScreen sections={TERMS_SECTIONS} />;
}
