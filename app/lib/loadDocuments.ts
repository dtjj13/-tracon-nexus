import { supabase } from "./supabase";

const privateDocumentPrefix = "storage://documents/";
const signedUrlSeconds = 10 * 60;

export function privateDocumentReference(filePath: string) {
  return `${privateDocumentPrefix}${filePath}`;
}

export function privateDocumentPath(reference: string) {
  if (!reference.startsWith(privateDocumentPrefix)) return null;
  const filePath = reference.slice(privateDocumentPrefix.length);
  if (!filePath || filePath.startsWith("/") || filePath.includes("..")) {
    throw new Error("This document reference is invalid.");
  }
  return filePath;
}

export async function getDocumentAccessUrl(reference: string) {
  const filePath = privateDocumentPath(reference);
  if (!filePath) {
    let legacyUrl: URL;
    try {
      legacyUrl = new URL(reference);
    } catch {
      throw new Error("This document link is invalid.");
    }

    if (legacyUrl.protocol !== "https:" && legacyUrl.protocol !== "http:") {
      throw new Error("This document link uses an unsupported address type.");
    }

    return legacyUrl.toString();
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, signedUrlSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "This document could not be opened.");
  }

  return data.signedUrl;
}

export async function openLoadDocument(reference: string) {
  const preview = window.open("", "_blank");
  if (preview) {
    preview.opener = null;
    preview.document.title = "Opening document…";
  }

  try {
    const url = await getDocumentAccessUrl(reference);
    if (preview) {
      preview.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    preview?.close();
    throw error;
  }
}
