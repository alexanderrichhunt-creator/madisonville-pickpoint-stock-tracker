import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadSettings, saveSettings } from '@/lib/google-sheets';

/**
 * Bootstrap endpoint (Google Sheets version).
 * Visit this once after a fresh deploy to ensure the admin password hash exists.
 * 
 * Usage: https://your-app.onrender.com/api/bootstrap-admin
 * 
 * Safe to call multiple times.
 */
export async function GET(req: NextRequest) {
  try {
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || "mpp2026";

    const settings = await loadSettings();
    const hashKey = "admin_password_hash";

    // Create or update the bootstrap password hash in Settings sheet
    const hash = await bcrypt.hash(initialPassword, 10);
    settings[hashKey] = hash;

    await saveSettings(settings);

    return NextResponse.json({
      success: true,
      message: "Admin bootstrap complete. You can now log in.",
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
