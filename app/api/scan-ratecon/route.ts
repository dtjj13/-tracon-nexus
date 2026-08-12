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
You extract operational load data from trucking rate confirmations.

Rate confirmations vary by broker. Interpret each field by its meaning
and context, not by a fixed page position, layout, or exact heading.

Extraction rules:

- broker_name: The broker or customer issuing the rate confirmation
  and paying the carrier. Do not return the motor carrier's name.

- broker_load_id: The broker's primary identifier for this load.
  It may be labeled Load Number, Load ID, Order Number, Trip Number,
  Shipment Number, PO, Reference Number, or Confirmation Number.
  Prefer the identifier clearly tied to the broker's load.

- pickup: The first pickup, origin, or shipper stop.
  For a multi-stop load, return the first pickup.
  Keep a readable city/state or full location.

- dropoff: The final delivery, destination, or consignee stop.
  For a multi-stop load, return the last delivery.
  Keep a readable city/state or full location.

- rate: The total agreed gross compensation paid to the carrier.
  Prefer an explicitly stated All-In Total, Carrier Pay, Total Charges,
  Contract Amount, Flat Rate, or Total Rate.
  If no total is stated, add components only when they are clearly
  carrier-pay items such as linehaul and fuel surcharge.
  Do not use commodity value, insurance value, an advance, a deduction,
  a quick-pay fee, or an individual line item when a total is present.

- loaded_miles: The explicitly stated loaded, linehaul, or trip mileage.
  Exclude miles clearly labeled deadhead or empty.
  If the document provides only one clearly stated trip mileage, use it.

- bol_number: Only a number explicitly identified as BOL or Bill of Lading.

Never invent a value.
If a field is missing or ambiguous, return an empty string.
Return rate and loaded_miles as numeric strings without currency symbols,
commas, or unit labels.
`,
    },
    {
      role: "user",
      content: text,
    },
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "rate_confirmation",
      description:
        "Structured trucking rate confirmation fields for review.",
      strict: true,
      schema: {
        type: "object",
        properties: {
          broker_name: {
            type: "string",
            description:
              "The broker or customer paying the motor carrier.",
          },
          broker_load_id: {
            type: "string",
            description:
              "The primary broker load, order, trip, shipment, reference, or confirmation number.",
          },
          pickup: {
            type: "string",
            description:
              "The first pickup, origin, or shipper location.",
          },
          dropoff: {
            type: "string",
            description:
              "The final delivery, destination, or consignee location.",
          },
          rate: {
            type: "string",
            description:
              "The total agreed carrier compensation as a numeric string without symbols or commas.",
          },
          loaded_miles: {
            type: "string",
            description:
              "Loaded or trip mileage as a numeric string without units or commas.",
          },
          bol_number: {
            type: "string",
            description:
              "The number explicitly identified as the BOL or Bill of Lading.",
          },
        },
        required: [
          "broker_name",
          "broker_load_id",
          "pickup",
          "dropoff",
          "rate",
          "loaded_miles",
          "bol_number",
        ],
        additionalProperties: false,
      },
    },
  },
});

const message = completion.choices[0]?.message;

if (message?.refusal) {
  return NextResponse.json(
    {
      error: "This document could not be processed by the AI scanner.",
    },
    {
      status: 422,
    }
  );
}

const raw = message?.content;

if (!raw) {
  return NextResponse.json(
    {
      error: "The AI scanner returned an empty response.",
    },
    {
      status: 502,
    }
  );
}

const parsedData = JSON.parse(raw) as {
  broker_name: string;
  broker_load_id: string;
  pickup: string;
  dropoff: string;
  rate: string;
  loaded_miles: string;
  bol_number: string;
};

const cleanNumber = (value: any) => {
  if (!value) return "";

  return String(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .trim();
};

const cleaned = {
  broker_name: parsedData.broker_name || "",
  broker_load_id: parsedData.broker_load_id || "",
  pickup: parsedData.pickup || "",
  dropoff: parsedData.dropoff || "",
  rate: cleanNumber(parsedData.rate),
  loaded_miles: cleanNumber(parsedData.loaded_miles),
  bol_number: parsedData.bol_number || "",
};

return NextResponse.json(cleaned);
  } catch (error: any) {
    console.error(error);

    return NextResponse.json({
      error: error.message || "Failed to scan rate confirmation",
    });
  }
}