const LOCAL_ORIGIN = "https://save-stroke.local";

function localDestination(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  if ([...value].some(character => character === "\\" ||
      character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(value, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN) return null;
    return {
      pathname: url.pathname.replace(/\/$/, "") || "/",
      suffix: `${url.search}${url.hash}`,
    };
  } catch {
    return null;
  }
}

export function getLandingDestination({ hasAdmin = false, hasPatient = false, patient } = {}) {
  if (hasAdmin) return "/admin";
  if (hasPatient) return patient?.requiresPasswordChange ? "/settings?required=1" : "/";
  return "/guest";
}

export function getAdminDestination(from) {
  const target = localDestination(from);
  return target && ["/admin", "/register"].includes(target.pathname)
    ? `${target.pathname}${target.suffix}` : "/admin";
}

export function getPatientDestination(from, patient) {
  if (patient?.requiresPasswordChange) return "/settings?required=1";
  const target = localDestination(from);
  if (!target) return "/";
  if (["/", "/profile", "/settings"].includes(target.pathname))
    return `${target.pathname}${target.suffix}`;
  const record = target.pathname.match(/^\/(health|history)(?:\/\d{13})?$/);
  if (record && /^\d{13}$/.test(patient?.citizenId || ""))
    return `/${record[1]}/${patient.citizenId}${target.suffix}`;
  return "/";
}
