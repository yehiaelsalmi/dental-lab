import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      // The privacy policy must be readable without an account (Google checks it).
      const isPublic = pathname.startsWith("/login") || pathname === "/privacy";
      if (isPublic || isLoggedIn) return true;
      // Remember where the user was going (e.g. a case link from an email) so
      // they land there after signing in instead of on the case list.
      const loginUrl = new URL("/login", request.nextUrl);
      loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return Response.redirect(loginUrl);
    },
    async signIn({ user, account }) {
      // Sign-in with Google only works for accounts a Lab Leader already
      // created — this app doesn't let people self-register.
      if (account?.provider === "google") {
        if (!user.email) return false;
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (!dbUser || !dbUser.active) return "/login?error=not_registered";
      }
      return true;
    },
    // Only the user id lives in the token; the role and its permissions are
    // read fresh on each request (src/lib/access.ts).
    async jwt({ token, user, account }) {
      if (account?.provider === "credentials" && user) {
        token.id = user.id as string;
      } else if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (dbUser) token.id = dbUser.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
