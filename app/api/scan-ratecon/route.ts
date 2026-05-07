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

    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "No rate confirmation text provided" },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract trucking rate confirmation details. Return only valid JSON. No markdown.",
        },
        {
          role: "user",
          content: `
Extract these fields from this rate confirmation text.

Return JSON exactly like this:
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
${text}
          `,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Rate con scan error:", error);

    return NextResponse.json(
      { error: "Failed to scan rate confirmation" },
      { status: 500 }
    );
  }
}