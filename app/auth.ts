import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "furumoto_family_session";
const SESSION_LABEL = "furumoto-family-history-v1";
const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;

type RuntimeEnv = {
  FAMILY_SITE_PASSWORD?: string;
};

export function getFamilyPasswordConfigured() {
  return Boolean(getFamilyPassword());
}

export async function isFamilyAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  if (!session) return false;

  const expected = await createSessionValue();
  return expected !== null && constantTimeEqual(session, expected);
}

export async function requireFamilySession(returnTo: string) {
  if (await isFamilyAuthenticated()) return;
  redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
}

export async function verifyFamilyPassword(input: string) {
  const familyPassword = getFamilyPassword();
  if (!familyPassword) return false;

  const [inputHash, passwordHash] = await Promise.all([
    digest(`${SESSION_LABEL}:${input}`),
    digest(`${SESSION_LABEL}:${familyPassword}`),
  ]);
  return constantTimeEqual(inputHash, passwordHash);
}

export async function familySessionCookie(secure: boolean) {
  const value = await createSessionValue();
  if (!value) return null;

  return {
    name: SESSION_COOKIE,
    value,
    options: {
      httpOnly: true,
      maxAge: ONE_MONTH_SECONDS,
      path: "/",
      sameSite: "lax" as const,
      secure,
    },
  };
}

export function familySessionCookieName() {
  return SESSION_COOKIE;
}

export function safeReturnTo(value: FormDataEntryValue | string | null) {
  const text = typeof value === "string" ? value : "/";
  if (!text.startsWith("/") || text.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(text, "https://family.local");
  } catch {
    return "/";
  }

  if (url.origin !== "https://family.local") return "/";
  if (url.pathname.startsWith("/api/")) return "/";
  if (url.pathname === "/login") return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function getFamilyPassword() {
  const runtimeEnv = env as unknown as RuntimeEnv;
  return runtimeEnv.FAMILY_SITE_PASSWORD ?? process.env.FAMILY_SITE_PASSWORD ?? "";
}

async function createSessionValue() {
  const familyPassword = getFamilyPassword();
  if (!familyPassword) return null;
  return `v1.${await digest(`${SESSION_LABEL}:${familyPassword}`)}`;
}

async function digest(value: string) {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return base64Url(new Uint8Array(hashBuffer));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}
