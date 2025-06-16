import { Pinecone } from "@pinecone-database/pinecone";

class PineconeServiceClass {
  constructor() {
    // Initialize Pinecone client
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    this.indexName = process.env.PINECONE_INDEX_NAME || "rag-ai-chatbot-index";
    this.index = null;
  }

  async ensureIndexExists() {
    try {
      // Check if index exists
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(
        (index) => index.name === this.indexName
      );

      if (!indexExists) {
        console.log(`Creating index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI embedding dimension
          metric: "cosine",
          spec: {
            serverless: {
              cloud: "aws",
              region: "us-east-1",
            },
          },
        });

        // Wait for index to be ready
        console.log("Waiting for index to be ready...");
        await this.waitForIndexReady();
      }

      // Get index instance
      this.index = this.pinecone.index(this.indexName);
      console.log(`Connected to index: ${this.indexName}`);
    } catch (error) {
      console.error("Error ensuring index exists:", error);
      throw new Error(`Failed to ensure index exists: ${error.message}`);
    }
  }

  async waitForIndexReady(maxWaitTime = 60000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const indexStats = await this.pinecone.describeIndex(this.indexName);
        if (indexStats.status?.ready) {
          console.log("Index is ready!");
          return;
        }
        console.log("Index not ready yet, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      } catch (error) {
        console.log("Waiting for index to be created...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    throw new Error("Index did not become ready within the expected time");
  }

  async documentExists(docId) {
    try {
      if (!this.index) {
        await this.ensureIndexExists();
      }

      const queryResponse = await this.index.query({
        vector: new Array(1536).fill(0), // Dummy vector
        filter: { docId: docId },
        topK: 1,
        includeMetadata: false,
      });

      return queryResponse.matches && queryResponse.matches.length > 0;
    } catch (error) {
      console.error("Error checking if document exists:", error);
      return false; // Assume it doesn't exist if we can't check
    }
  }

  async upsertVectors(vectors) {
    try {
      if (!this.index) {
        await this.ensureIndexExists();
      }

      console.log(`Upserting ${vectors.length} vectors to Pinecone`);

      // Upsert in batches of 100 (Pinecone limit)
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.index.upsert(batch);
        console.log(
          `Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            vectors.length / batchSize
          )}`
        );
      }

      console.log("All vectors upserted successfully");
    } catch (error) {
      console.error("Error upserting vectors:", error);
      throw new Error(`Failed to upsert vectors: ${error.message}`);
    }
  }

  async queryVectors(queryVector, filter = null, topK = 5) {
    try {
      if (!this.index) {
        await this.ensureIndexExists();
      }

      // Build query parameters
      const queryParams = {
        vector: queryVector,
        topK: topK,
        includeMetadata: true,
      };

      // Only add filter if it's provided and not empty
      if (filter && Object.keys(filter).length > 0) {
        queryParams.filter = filter;
      }

      const queryResponse = await this.index.query(queryParams);

      return queryResponse.matches || [];
    } catch (error) {
      console.error("Error querying vectors:", error);
      throw new Error(`Failed to query vectors: ${error.message}`);
    }
  }

  async getIndexStats() {
    try {
      if (!this.index) {
        await this.ensureIndexExists();
      }

      const stats = await this.index.describeIndexStats();

      // Get sample vectors to extract document metadata
      const queryRes = await this.index.query({
        vector: new Array(1536).fill(0), // dummy vector - adjust dimension if different
        topK: 100,
        includeMetadata: true,
      });

      const documents = new Map();
      queryRes.matches.forEach((match) => {
        if (match.metadata?.docId && match.metadata?.sourceUrl) {
          documents.set(match.metadata.docId, {
            docId: match.metadata.docId,
            sourceUrl: match.metadata.sourceUrl,
            addedAt: match.metadata.addedAt,
          });
        }
      });

      return {
        totalVectors: stats.totalVectorCount,
        documents: Array.from(documents.values()),
      };
    } catch (error) {
      console.error("Error getting index stats:", error);
      throw new Error(`Failed to get index stats: ${error.message}`);
    }
  }
}

const PineconeService = new PineconeServiceClass();
export default PineconeService;
