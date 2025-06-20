import axios from "axios";
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { createCanvas } from "canvas";
import Tesseract from "tesseract.js";
// This will work with pdfjs-dist@3.11.174
import pkg from "pdfjs-dist/legacy/build/pdf.js";

import { CONSTANTS } from "../utils/constants.js";
import { countTokens } from "../utils/tokenizer.js";

const { getDocument } = pkg;

class PDFServiceClass {
  constructor(
    tempDir = os.tmpdir(),
    chunkSize = CONSTANTS.CHUNK_SIZE,
    overlap = CONSTANTS.CHUNK_OVERLAP
  ) {
    this.tempDir = tempDir;
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  generateDocumentId(source) {
    return crypto.createHash("md5").update(source).digest("hex");
  }

  async downloadPDF(url, docId) {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (err) {
      console.warn(`Could not create temp directory: ${err.message}`);
    }

    const filePath = path.join(this.tempDir, `${docId}.pdf`);

    const response = await axios.get(url, { responseType: "arraybuffer" });
    await fs.writeFile(filePath, response.data);

    return filePath;
  }

  // Convert PDF pages to images (PNG files)
  async convertPdfToImages(filePath) {
    const data = new Uint8Array(await fs.readFile(filePath));
    const pdfDoc = await getDocument({ data }).promise;

    const imagePaths = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      await page.render({ canvasContext: context, viewport }).promise;

      const imagePath = path.join(this.tempDir, `page-${i}.png`);
      await fs.writeFile(imagePath, canvas.toBuffer("image/png"));
      imagePaths.push(imagePath);
    }

    return imagePaths;
  }

  // Clean up Tesseract traineddata files
  async cleanupTesseractFiles() {
    const trainedDataFiles = [
      "eng.traineddata",
      "ben.traineddata",
      "jpn.traineddata",
    ];

    for (const file of trainedDataFiles) {
      try {
        // Check current working directory
        const currentDirPath = path.join(process.cwd(), file);
        await fs.access(currentDirPath);
        await fs.unlink(currentDirPath);
        console.log(`Cleaned up ${file} from current directory`);
      } catch (error) {
        // File doesn't exist in current directory, try temp directory
        try {
          const tempDirPath = path.join(this.tempDir, file);
          await fs.access(tempDirPath);
          await fs.unlink(tempDirPath);
          console.log(`Cleaned up ${file} from temp directory`);
        } catch (tempError) {
          // File doesn't exist in either location, which is fine
          console.log(`${file} not found in expected locations`);
        }
      }
    }
  }

  // Extract text from images using Tesseract OCR (for ben+eng+jpn)
  async extractTextFromImages(imagePaths) {
    let fullText = "";

    for (const imgPath of imagePaths) {
      const {
        data: { text },
      } = await Tesseract.recognize(imgPath, "ben+eng+jpn", {
        logger: (m) => console.log(m), // optional: show OCR progress
      });

      fullText += text + "\n\n";
    }

    return fullText;
  }

  // Main method to extract text from PDF using OCR approach
  async extractTextFromPDF(filePath) {
    const imagePaths = await this.convertPdfToImages(filePath);
    const fullText = await this.extractTextFromImages(imagePaths);

    // Cleanup images after OCR
    for (const imgPath of imagePaths) {
      try {
        await fs.unlink(imgPath);
      } catch (e) {
        console.warn(`Failed to delete image ${imgPath}: ${e.message}`);
      }
    }

    // Clean up Tesseract traineddata files
    await this.cleanupTesseractFiles();

    return fullText;
  }

  splitText(text) {
    const words = text.split(" ");
    const chunks = [];

    for (let i = 0; i < words.length; i += this.chunkSize - this.overlap) {
      const chunk = words.slice(i, i + this.chunkSize).join(" ");
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Could not delete file ${filePath}:`, error.message);
    }
  }

  async calculateTotalTokens(textChunks) {
    let totalTokens = 0;
    for (const chunk of textChunks) {
      totalTokens += await countTokens(chunk);
    }
    return totalTokens;
  }

  // Enhanced cleanup method for complete cleanup
  async performCompleteCleanup(filePath) {
    // Clean up the main PDF file
    await this.cleanupFile(filePath);

    // Clean up any remaining Tesseract files
    await this.cleanupTesseractFiles();
  }
}

const PDFService = new PDFServiceClass();
export default PDFService;
