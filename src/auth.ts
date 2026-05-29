import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

// Extend the session and jwt types to include our custom fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isAdmin: boolean
    }
  }

  interface User {
    isAdmin: boolean
  }
}

// JWT augmentation omitted for compatibility with next-auth@5.0.0-beta (types resolved at runtime via callbacks)

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Admin Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        let username: string | undefined
        let password: string | undefined

        try {
          const parsed = credentialsSchema.safeParse(credentials)
          if (!parsed.success) return null

          ;({ username, password } = parsed.data)

          // Look up user by a conventional admin identifier (email or name)
          // We support either "admin" as username or the full email
          const email = username.includes("@") ? username : "admin@pickpoint.local"

          let user = await prisma.user.findUnique({
            where: { email },
          })

          // Self-healing bootstrap: If no admin user exists yet but they are using the correct initial password,
          // create the admin user on the fly. This makes first deploy much more reliable.
          if (!user) {
            const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || "mpp2026"
            if (password === initialPassword) {
              try {
                user = await prisma.user.create({
                  data: {
                    email,
                    name: "Administrator",
                    isAdmin: true,
                  },
                })
              } catch (createError) {
                console.error("Failed to auto-create admin user during bootstrap login:", createError)
                return null
              }
            } else {
              return null
            }
          }

          // For credentials we store a password hash in a custom way.
          // Since the core User model doesn't have password field (Auth.js standard),
          // we use a simple convention: store hashed password in a AppSetting or
          // we accept the initial seed password and compare.
          // Practical approach for internal tool: check against seeded hash in DB
          // or fallback to env for bootstrap.
          const storedHash = await prisma.appSetting.findUnique({
            where: { key: `admin_password_hash_${user.id}` },
          })

          let isValid = false

          if (storedHash?.value) {
            isValid = await bcrypt.compare(password, storedHash.value)
          } else {
            // Bootstrap: allow the well-known initial password from env or default
            // This lets first login work after seed without extra setup.
            const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || "mpp2026"
            if (password === initialPassword) {
              // On successful bootstrap login with initial password, upgrade to hashed storage
              const newHash = await bcrypt.hash(password, 10)
              await prisma.appSetting.upsert({
                where: { key: `admin_password_hash_${user.id}` },
                update: { value: newHash },
                create: { key: `admin_password_hash_${user.id}`, value: newHash },
              })
              isValid = true
            }
          }

          if (!isValid) return null

          return {
            id: user.id,
            email: user.email,
            name: user.name || "Administrator",
            isAdmin: user.isAdmin,
          }
        } catch (error) {
          console.error("Auth authorize error:", error)
          // Log more context for debugging on Render
          console.error("Auth debug - username attempted:", username ?? "unknown")
          console.error("Auth debug - env check - has DATABASE_URL:", !!process.env.DATABASE_URL)
          console.error("Auth debug - env check - has NEXTAUTH_SECRET:", !!process.env.NEXTAUTH_SECRET)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          ;(token as any).id = user.id
          ;(token as any).isAdmin = (user as any).isAdmin ?? false
        }
        return token
      } catch (err) {
        console.error("JWT callback error:", err);
        throw err;
      }
    },
    async session({ session, token }) {
      try {
        if (session.user) {
          ;(session.user as any).id = (token as any).id as string
          ;(session.user as any).isAdmin = (token as any).isAdmin ?? false
        }
        return session
      } catch (err) {
        console.error("Session callback error:", err);
        throw err;
      }
    },
  },
  pages: {
    signIn: "/login", // We will use a dialog instead, but keep for future
  },
  trustHost: true,
  logger: {
    error(error) {
      console.error("NextAuth Error:", error);
    },
  },
})