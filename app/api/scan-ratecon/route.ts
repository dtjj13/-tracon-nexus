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

    const output = JSON.stringify(response.output || "{}");

console.log("AI OUTPUT:", output);

const cleaned = output
  .replace(/```json/g, "")
  .replace(/```/g, "")
  .trim();

try {
  const parsed = JSON.parse(cleaned);

  return NextResponse.json(parsed);
} catch (parseError) {
  console.error("JSON PARSE ERROR:", parseError);

  return NextResponse.json({
    error: "AI returned invalid JSON",
    raw: output,
  });
}
  } catch (error) {
    console.error("Rate con scan error:", error);

    return NextResponse.json(
      { error: "Failed to scan rate confirmation" },
      { status: 500 }
    );
  }
}