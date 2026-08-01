import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// This route never receives the file itself - only a small handshake request
// from @vercel/blob's client-side upload() helper. The actual file bytes go
// directly from the browser to Blob storage, never touching this function,
// which is exactly what avoids Vercel's hard 4.5MB request body limit.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
          ],
          // 20MB is generous for a photographed or scanned quote - well
          // above what any real HVAC quote document should need, while
          // still protecting against someone uploading something huge.
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log(JSON.stringify({
          event: "blob_upload_completed",
          url: blob.url,
          timestamp: new Date().toISOString(),
        }));
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Blob upload handshake error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
