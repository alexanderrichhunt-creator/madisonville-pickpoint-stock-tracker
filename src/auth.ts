import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

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

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Admin Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { username, password } = parsed.data
        const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || "mpp2026"
        const email = username.includes("@") ? username : "admin@pickpoint.local"

        if (!process.env.DATABASE_URL) {
          if (password === initialPassword) {
            return {
              id: "bootstrap-admin",
              email,
              name: "Administrator",
              isAdmin: true,
            }
          }
          return null
        }

        try {
          const setting = await prisma.appSetting.findUnique({
            where: { key: "admin_password_hash" },
          })

          let isValid = false

          if (setting?.value) {
            isValid = await bcrypt.compare(password, setting.value)
          } else if (password === initialPassword) {
            const hash = await bcrypt.hash(initialPassword, 10)
            await prisma.appSetting.upsert({
              where: { key: "admin_password_hash" },
              create: { key: "admin_password_hash", value: hash },
              update: { value: hash },
            })
            isValid = true
          }

          if (!isValid) return null

          return {
            id: "admin-user",
            email,
            name: "Administrator",
            isAdmin: true,
          }
        } catch (error) {
          console.error("Auth authorize error:", error)
          if (password === initialPassword) {
            return {
              id: "bootstrap-admin",
              email,
              name: "Administrator",
              isAdmin: true,
            }
          }
          return null
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.isAdmin = user.isAdmin === true
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.isAdmin = token.isAdmin === true
      }
      return session
    },
  },
  trustHost: true,
})
