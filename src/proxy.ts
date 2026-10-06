import { auth } from "@/auth";

// Signed-out visitors are sent to /login with the page they wanted (see the
// `authorized` callback in auth.ts).
export default auth;

// Pages only: API routes check the session themselves, and the icons must stay
// reachable from the login page. Server-action submissions (they carry a
// `next-action` header) skip the proxy too: the proxy buffers request bodies
// and caps them at 10MB, which cut off large scan uploads, and every action
// already checks the user's permissions itself.
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
      missing: [{ type: "header", key: "next-action" }],
    },
  ],
};
