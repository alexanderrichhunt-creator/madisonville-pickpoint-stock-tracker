import { NextResponse } from "next/server";
import { parsePickPointPdfText } from "@/lib/pickpoint-pdf-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No PDF file uploaded." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Upload a .pdf inventory report." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        {
          error:
            "The PDF appears to be empty or image-only. Export a text-based inventory report from PickPoint.",
        },
        { status: 400 }
      );
    }

    const result = parsePickPointPdfText(text);

    return NextResponse.json({
      medications: result.medications,
      dataAsOf: result.dataAsOf,
      warnings: result.warnings,
      recordCount: result.medications.length,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to parse the uploaded PDF.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
