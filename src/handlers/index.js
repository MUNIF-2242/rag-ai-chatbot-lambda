import PDFService from "../services/pdfService.js";
import PineconeService from "../services/pineconeService.js";
import EmbeddingService from "../services/embeddingService.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { validateUrl } from "../utils/validation.js";
import { calculateEmbeddingCost } from "../utils/pricing.js";

export const handler = async (event) => {
  try {
    // ✅ Handle base64-encoded body safely
    let body;
    if (event.isBase64Encoded) {
      const decoded = Buffer.from(event.body, "base64").toString("utf-8");
      body = JSON.parse(decoded);
    } else {
      body = JSON.parse(event.body || "{}");
    }

    const { url } = body;

    validateUrl(url);

    await PineconeService.ensureIndexExists();

    const docId = PDFService.generateDocumentId(url);
    const exists = await PineconeService.documentExists(docId);

    if (exists) {
      return successResponse({
        message: "Document already indexed",
        docId,
        sourceUrl: url,
        skipped: true,
      });
    }

    const filePath = await PDFService.downloadPDF(url, docId);
    const text = await PDFService.extractTextFromPDF(filePath);

    console.log(`##################`);
    console.log(text);
    console.log(`##################`);
    await PDFService.cleanupFile(filePath);

    const chunks = PDFService.splitText(text);
    const totalTokens = await PDFService.calculateTotalTokens(chunks);

    const estimatedCost = calculateEmbeddingCost(
      totalTokens,
      "text-embedding-3-small"
    );
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

    return successResponse({
      message: "Successfully indexed new document",
      docId,
      sourceUrl: url,
      chunksAdded: vectors.length,
      totalTokens, // ⬅️ Here
      estimatedCostUSD: Number(estimatedCost.toFixed(6)),
      addedAt,
      skipped: false,
    });
  } catch (error) {
    console.error("Index handler error:", error);
    return errorResponse(error);
  }
};
