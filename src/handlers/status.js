import PineconeService from "../services/pineconeService.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { CONSTANTS } from "../utils/constants.js";

export const handler = async (event) => {
  try {
    const indexInfo = await PineconeService.getIndexStats();

    return successResponse({
      indexName: CONSTANTS.INDEX_NAME,
      ...indexInfo,
    });
  } catch (error) {
    console.error("Status handler error:", error);
    return errorResponse(error);
  }
};
