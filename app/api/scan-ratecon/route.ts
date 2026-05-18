import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    let text = "";

if (
  file.type === "application/pdf" ||
  file.name.toLowerCase().endsWith(".pdf")
) {
 const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = "";

  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
  }).promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");

    fullText += `\n${pageText}`;
  }

  text = fullText;
} else {
  text = await file.text();
}

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract trucking rate confirmation data. Return only valid raw JSON. No markdown. No explanations.",
        },
        {
          role: "user",
          content: `
Extract these fields from this rate confirmation text.

Return JSON exactly like this:
{
  "broker_name": "",
  "broker_load_id": "",
  "pickup": "",
  "dropoff": "",
  "rate": 0,
  "loaded_miles": 0,
  "pickup_date": "",
  "delivery_date": "",
  "bol_number": ""
}

Text:
${text}
          `,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "{}";

    const cleaned = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Rate con scan error:", error);

    return NextResponse.json(
      { error: "Failed to scan rate confirmation" },
      { status: 500 }
    );
  }
}