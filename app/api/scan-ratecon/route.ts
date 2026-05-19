import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createRequire } from "module";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({
        error: "No file uploaded",
      });
    }

    let text = "";

    // TXT SUPPORT
    if (file.type === "text/plain") {
      text = await file.text();
    }

    // PDF SUPPORT
    else if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      const bytes = Buffer.from(await file.arrayBuffer());

      const parsed = await pdfParse(bytes);

      text = parsed.text;
    }

    else {
      return NextResponse.json({
        error: "Unsupported file type",
      });
    }

    // FAIL SAFE
    if (!text || text.trim().length < 20) {
      return NextResponse.json({
        error:
          "Could not read this PDF. Broker may have sent a scanned/image PDF.",
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You extract trucking rate confirmation data.

Return ONLY valid JSON.

Example:
{
  "broker_name": "",
  "broker_load_id": "",
  "pickup": "",
  "dropoff": "",
  "rate": "",
  "loaded_miles": "",
  "bol_number": ""
}
`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const raw =
      completion.choices[0].message.content || "{}";

    const parsedData = JSON.parse(raw);

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error(error);

    return NextResponse.json({
      error: error.message || "Failed to scan rate confirmation",
    });
  }
}