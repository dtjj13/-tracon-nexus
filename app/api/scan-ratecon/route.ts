import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "No rate confirmation text provided" },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Extract trucking rate confirmation load details. Return only valid JSON.",
        },
        {
          role: "user",
          content: `Extract these fields from this rate confirmation text:

{
  "broker_load_id": "",
  "broker_name": "",
  "pickup": "",
  "dropoff": "",
  "rate": "",
  "loaded_miles": "",
  "pickup_date": "",
  "delivery_date": "",
  "bol_number": ""
}

Text:
${text}`,
        },
      ],
    });

    const output = JSON.stringify((response as any).output || "{}");

    return NextResponse.json({
      raw: output,
    });
  } catch (error) {
    console.error("Rate con scan error:", error);

    return NextResponse.json(
      { error: "Failed to scan rate confirmation" },
      { status: 500 }
    );
  }
}