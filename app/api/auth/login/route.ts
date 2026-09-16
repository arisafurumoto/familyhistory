import { NextResponse } from "next/server";
import {
  familySessionCookie,
  getFamilyPasswordConfigured,
  safeReturnTo,
  verifyFamilyPassword,
} from "../../../auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!getFamilyPasswordConfigured()) {
    return NextResponse.redirect(new URL("/login?error=setup", request.url), {
      status: 303,
    });
  }

  const password =
    typeof formData.get("password") === "string" ? formData.get("password") : "";
  if (!(await verifyFamilyPassword(password ?? ""))) {
    return NextResponse.redirect(
      new URL(`/login?error=1&returnTo=${encodeURIComponent(returnTo)}`, request.url),
      { status: 303 },
    );
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url), {
    status: 303,
  });
  const session = await familySessionCookie(new URL(request.url).protocol === "https:");
  if (session) response.cookies.set(session.name, session.value, session.options);
  return response;
}
