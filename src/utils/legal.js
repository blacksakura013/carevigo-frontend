export const TERMS_VERSION = "2026-11-01";
export const PRIVACY_VERSION = "2026-11-01";
export const LEGAL_EFFECTIVE_DATE = "1 พฤศจิกายน 2569";

// Versions describe the documents shown to the person. The server records the
// acceptance time and actor; browser storage is never used as consent evidence.
export function agreementPayload(value, { staff = false } = {}) {
  return {
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    termsAccepted: value?.termsAccepted === true,
    ...(staff
      ? {
          privacyNoticeAcknowledged: value?.privacyNoticeAcknowledged === true,
          lawfulAuthorityConfirmed: value?.lawfulAuthorityConfirmed === true,
        }
      : { healthDataConsent: value?.healthDataConsent === true }),
  };
}

export function staffAgreementPayload(value) {
  return agreementPayload(value, { staff: true });
}

export function agreementsComplete(value, { staff = false } = {}) {
  return value?.termsAccepted === true && (staff
    ? value?.privacyNoticeAcknowledged === true && value?.lawfulAuthorityConfirmed === true
    : value?.healthDataConsent === true);
}
