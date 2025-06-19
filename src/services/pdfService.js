import axios from "axios";
import PDFParser from "pdf2json";
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import os from "os"; // ✅ Cross-platform temp folder
import { CONSTANTS } from "../utils/constants.js";
import { countTokens } from "../utils/tokenizer.js";

class PDFServiceClass {
  constructor(
    tempDir = os.tmpdir(), // ✅ Use OS-specific temp directory
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
    // ✅ Ensure temp directory exists
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

  async extractTextFromPDF(filePath) {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData) => {
        reject(errData.parserError);
      });

      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        try {
          let fullText = "";

          pdfData.Pages.forEach((page) => {
            page.Texts.forEach((text) => {
              text.R.forEach((textRun) => {
                if (textRun.T) {
                  fullText += decodeURIComponent(textRun.T) + " ";
                }
              });
            });
            fullText += "\n";
          });

          resolve(fullText);
        } catch (error) {
          reject(error);
        }
      });

      pdfParser.loadPDF(filePath);
    });
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
}

const PDFService = new PDFServiceClass();
export default PDFService;
