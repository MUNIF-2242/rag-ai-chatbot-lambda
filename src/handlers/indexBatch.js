import PDFService from "../services/pdfService.js";
import PineconeService from "../services/pineconeService.js";
import EmbeddingService from "../services/embeddingService.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { validateUrls } from "../utils/validation.js";

export const handler = async (event) => {
  try {
    const { urls } = JSON.parse(event.body || "{}");

    validateUrls(urls);

    await PineconeService.ensureIndexExists();

    const results = [];

    for (const urlData of urls) {
      try {
        const url = typeof urlData === "string" ? urlData : urlData.url;
        const docId = PDFService.generateDocumentId(url);

        const exists = await PineconeService.documentExists(docId);
        if (exists) {
          results.push({
            message: "Document already indexed",
            docId,
            sourceUrl: url,
            skipped: true,
          });
          continue;
        }

        const filePath = await PDFService.downloadPDF(url, docId);
        const text = await PDFService.extractTextFromPDF(filePath);
        await PDFService.cleanupFile(filePath);

        const chunks = PDFService.splitText(text);
        const embeddings = await EmbeddingService.createEmbeddings(chunks);

        const addedAt = new Date().toISOString();
        const vectors = embeddings.map((embedding, i) => ({
          id: `${docId}-chunk-${i}`,
          values: embedding,
          metadata: {
            text: chunks[i],
            docId: docId,
            sourceUrl: url,
            chunkIndex: i,
            addedAt: addedAt,
          },
        }));

        await PineconeService.upsertVectors(vectors);

        results.push({
          message: "Successfully indexed new document",
          docId,
          sourceUrl: url,
          chunksAdded: vectors.length,
          addedAt,
          skipped: false,
        });
      } catch (error) {
        results.push({
          sourceUrl: typeof urlData === "string" ? urlData : urlData.url,
          error: error.message,
          skipped: false,
        });
      }
    }

    const successful = results.filter((r) => !r.error && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => r.error).length;

    return successResponse({
      results,
      summary: {
        total: urls.length,
        successful,
        skipped,
        failed,
      },
    });
  } catch (error) {
    console.error("Batch index handler error:", error);
    return errorResponse(error);
  }
};
