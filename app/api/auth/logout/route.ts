import { NextResponse } from "next/server";
import { familySessionCookieName } from "../../../auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  response.cookies.delete(familySessionCookieName());
  return response;
}
