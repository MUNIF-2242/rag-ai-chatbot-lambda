import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

class S3ServiceClass {
  constructor(options = {}) {
    this.region =
      options.region || process.env.REGION_FOR_S3_BUCKET || "us-east-1";
    this.bucketName = options.bucketName || process.env.BUCKET_NAME_FOR_KB;

    this.s3Client = new S3Client({
      region: this.region,
    });
  }

  // Helper function to safely encode filename for S3 metadata
  encodeFilenameForMetadata(filename) {
    try {
      // Encode to base64 to safely store unicode characters
      return Buffer.from(filename, "utf-8").toString("base64");
    } catch (error) {
      console.warn("Failed to encode filename for metadata:", error);
      // Fallback: remove non-ASCII characters
      return filename.replace(/[^\x00-\x7F]/g, "");
    }
  }

  // Helper function to decode filename from metadata
  decodeFilenameFromMetadata(encodedFilename) {
    try {
      return Buffer.from(encodedFilename, "base64").toString("utf-8");
    } catch (error) {
      console.warn("Failed to decode filename from metadata:", error);
      return encodedFilename;
    }
  }

  // Helper function to create S3-safe key from filename
  createSafeS3Key(fileName) {
    // For the S3 key, we can use the original filename with proper encoding
    // S3 keys support UTF-8, but we need to be careful with special characters
    const safeFileName = fileName
      .replace(/[<>:"/\\|?*]/g, "_") // Replace problematic characters
      .replace(/\s+/g, "_"); // Replace spaces with underscores

    return `RagChatPdfs/${safeFileName}`;
  }

  async uploadPDF(fileBuffer, fileName, contentType = "application/pdf") {
    try {
      const key = this.createSafeS3Key(fileName);

      console.log(`Uploading file: ${fileName} to bucket: ${this.bucketName}`);

      // Encode the original filename for safe storage in metadata
      const encodedFilename = this.encodeFilenameForMetadata(fileName);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: {
          "original-filename-encoded": encodedFilename, // Base64 encoded filename
          "upload-timestamp": new Date().toISOString(),
          "file-size": fileBuffer.length.toString(),
        },
      });

      const response = await this.s3Client.send(command);

      console.log(`File uploaded successfully. ETag: ${response.ETag}`);

      const s3Url = `https://${this.bucketName}.s3.${
        this.region
      }.amazonaws.com/${encodeURIComponent(key)}`;

      return {
        s3Url,
        key,
        bucket: this.bucketName,
        etag: response.ETag,
        size: fileBuffer.length,
        originalFileName: fileName, // Keep original filename in response
      };
    } catch (error) {
      console.error("S3 upload error:", error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  async getPresignedUploadUrl(fileName, contentType = "application/pdf") {
    try {
      const key = this.createSafeS3Key(fileName);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        Metadata: {
          "original-filename-encoded": this.encodeFilenameForMetadata(fileName),
          "upload-timestamp": new Date().toISOString(),
        },
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });

      return {
        uploadUrl: signedUrl,
        key,
        s3Url: `https://${this.bucketName}.s3.${
          this.region
        }.amazonaws.com/${encodeURIComponent(key)}`,
        originalFileName: fileName,
      };
    } catch (error) {
      console.error("Presigned URL error:", error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  async getFile(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      // If we have encoded filename in metadata, decode it
      if (response.Metadata && response.Metadata["original-filename-encoded"]) {
        response.originalFileName = this.decodeFilenameFromMetadata(
          response.Metadata["original-filename-encoded"]
        );
      }

      return response;
    } catch (error) {
      console.error("Get file error:", error);
      throw new Error(`Failed to get file from S3: ${error.message}`);
    }
  }

  // Utility method to get original filename from S3 object metadata
  async getOriginalFilename(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (response.Metadata && response.Metadata["original-filename-encoded"]) {
        return this.decodeFilenameFromMetadata(
          response.Metadata["original-filename-encoded"]
        );
      }

      // Fallback: extract from key
      return key.split("/").pop();
    } catch (error) {
      console.error("Get original filename error:", error);
      throw new Error(`Failed to get original filename: ${error.message}`);
    }
  }
}

const S3Service = new S3ServiceClass();
export default S3Service;
