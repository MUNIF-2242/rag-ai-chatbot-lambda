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

  async uploadPDF(fileBuffer, fileName, contentType = "application/pdf") {
    try {
      const key = `pdfs/${fileName}`;

      console.log(`Uploading file: ${fileName} to bucket: ${this.bucketName}`);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: {
          "original-filename": fileName,
          "upload-timestamp": new Date().toISOString(),
        },
      });

      const response = await this.s3Client.send(command);

      console.log(`File uploaded successfully. ETag: ${response.ETag}`);

      const s3Url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      return {
        s3Url,
        key,
        bucket: this.bucketName,
        etag: response.ETag,
        size: fileBuffer.length,
      };
    } catch (error) {
      console.error("S3 upload error:", error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  async getPresignedUploadUrl(fileName, contentType = "application/pdf") {
    try {
      const key = `pdfs/${Date.now()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });

      return {
        uploadUrl: signedUrl,
        key,
        s3Url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
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
      return response;
    } catch (error) {
      console.error("Get file error:", error);
      throw new Error(`Failed to get file from S3: ${error.message}`);
    }
  }
}

const S3Service = new S3ServiceClass();
export default S3Service;
