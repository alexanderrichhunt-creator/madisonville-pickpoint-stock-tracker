import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * Temporary bootstrap endpoint.
 * Visit this once after a fresh deploy to ensure the admin user + password hash exists.
 * 
 * Usage: https://your-app.onrender.com/api/bootstrap-admin
 * 
 * Safe to call multiple times.
 */
export async function GET(req: NextRequest) {
  try {
    const adminEmail = "admin@pickpoint.local";
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || "mpp2026";

    // Create user if missing
    let user = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: adminEmail,
          name: "Administrator",
          isAdmin: true,
        },
      });
    }

    // Create or update the bootstrap password hash
    const hashKey = `admin_password_hash_${user.id}`;
    const hash = await bcrypt.hash(initialPassword, 10);

    await prisma.appSetting.upsert({
      where: { key: hashKey },
      update: { value: hash },
      create: { key: hashKey, value: hash },
    });

    return NextResponse.json({
      success: true,
      message: "Admin user and bootstrap password hash are ready.",
      login: {
        username: "admin",
        password: initialPassword,
      },
    });
  } catch (error: any) {
    console.error("Bootstrap admin error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Failed to bootstrap admin" 
      },
      { status: 500 }
    );
  }
}
