/**
 * Extends app.json so Google OAuth can return via the reversed client-ID URL scheme
 * (required now that Web OAuth clients reject custom schemes like freetohang://).
 * @see https://developers.google.com/identity/protocols/oauth2/native-app
 */
module.exports = ({ config }) => {
  const schemes = ['freetohang'];

  const schemeFromGoogleClientId = (clientId) => {
    if (!clientId || typeof clientId !== 'string') return null;
    const trimmed = clientId.trim();
    const suffix = '.apps.googleusercontent.com';
    if (!trimmed.endsWith(suffix)) return null;
    return `com.googleusercontent.apps.${trimmed.slice(0, -suffix.length)}`;
  };

  const iosScheme = schemeFromGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '');
  const androidScheme = schemeFromGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '');
  if (iosScheme) schemes.push(iosScheme);
  if (androidScheme && androidScheme !== iosScheme) schemes.push(androidScheme);

  return {
    ...config,
    scheme: schemes.length === 1 ? schemes[0] : schemes,
  };
};
