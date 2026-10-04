import { auth } from "@/auth";

// Signed-out visitors are sent to /login with the page they wanted (see the
// `authorized` callback in auth.ts).
export default auth;

// Pages only: API routes check the session themselves, and the icons must stay
// reachable from the login page.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.svg$).*)"],
};
