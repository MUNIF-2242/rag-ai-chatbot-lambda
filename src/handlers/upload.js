import S3Service from "../services/s3Service.js";
import {
  successResponse,
  errorResponse,
  validationError,
} from "../utils/response.js";
import multipartParser from "lambda-multipart-parser";

export const handler = async (event) => {
  try {
    // Check if it's a multipart form request (file upload)
    const contentType =
      event.headers["content-type"] || event.headers["Content-Type"] || "";

    if (contentType.includes("multipart/form-data")) {
      // Handle direct file upload (single or multiple)
      return await handleFileUpload(event);
    } else {
      // Handle presigned URL request (existing functionality)
      return await handlePresignedUrl(event);
    }
  } catch (error) {
    console.error("Upload handler error:", error);
    return errorResponse(error);
  }
};

// Enhanced function to handle single or multiple file uploads
async function handleFileUpload(event) {
  try {
    // Parse the multipart form data

    const result = await multipartParser.parse(event, true); // true = base64 decode

    console.log("isBase64Encoded:", event.isBase64Encoded);
    console.log(
      "Parsed files:",
      result.files?.map((f) => f.filename)
    );

    if (!result.files || result.files.length === 0) {
      return validationError("No files uploaded");
    }

    console.log(`Processing ${result.files.length} file(s)`);

    // Arrays to store successful uploads and failed uploads
    const successfulUploads = [];
    const failedUploads = [];

    // Process each file
    for (let i = 0; i < result.files.length; i++) {
      const file = result.files[i];
      const fileName = file.filename;
      const fileBuffer = file.content;
      const contentType = file.contentType || "application/pdf";

      try {
        // Validate file type
        if (
          !contentType.includes("pdf") &&
          !fileName.toLowerCase().endsWith(".pdf")
        ) {
          failedUploads.push({
            fileName,
            error: "Only PDF files are allowed",
          });
          continue;
        }

        // Validate file size (optional - e.g., max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (fileBuffer.length > maxSize) {
          failedUploads.push({
            fileName,
            error: "File size exceeds 10MB limit",
          });
          continue;
        }

        // Upload file to S3
        const uploadResult = await S3Service.uploadPDF(
          fileBuffer,
          fileName,
          contentType
        );

        successfulUploads.push({
          fileName,
          fileSize: fileBuffer.length,
          ...uploadResult,
        });

        console.log(`Successfully uploaded: ${fileName}`);
      } catch (error) {
        console.error(`Failed to upload ${fileName}:`, error);
        failedUploads.push({
          fileName,
          error: error.message,
        });
      }
    }

    // Prepare response based on results
    const totalFiles = result.files.length;
    const successCount = successfulUploads.length;
    const failureCount = failedUploads.length;

    if (successCount === 0) {
      // All uploads failed
      return errorResponse({
        message: "All file uploads failed",
        totalFiles,
        successfulUploads: 0,
        failedUploads: failureCount,
        failures: failedUploads,
      });
    } else if (failureCount === 0) {
      // All uploads succeeded
      return successResponse({
        message: `All ${successCount} file(s) uploaded successfully to S3`,
        totalFiles,
        successfulUploads: successCount,
        failedUploads: 0,
        files: successfulUploads,
      });
    } else {
      // Partial success
      return successResponse({
        message: `${successCount} of ${totalFiles} file(s) uploaded successfully`,
        totalFiles,
        successfulUploads: successCount,
        failedUploads: failureCount,
        files: successfulUploads,
        failures: failedUploads,
      });
    }
  } catch (error) {
    console.error("File upload error:", error);
    return errorResponse(error);
  }
}

// Existing function for presigned URL (keep for backward compatibility)
async function handlePresignedUrl(event) {
  try {
    const { fileName, contentType } = JSON.parse(event.body || "{}");

    if (!fileName) {
      return validationError("fileName is required");
    }

    const result = await S3Service.getPresignedUploadUrl(fileName, contentType);

    return successResponse({
      message: "Presigned URL generated successfully",
      ...result,
    });
  } catch (error) {
    console.error("Presigned URL error:", error);
    return errorResponse(error);
  }
}
