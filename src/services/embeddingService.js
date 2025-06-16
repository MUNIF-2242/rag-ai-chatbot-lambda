import { OpenAI } from "openai";

class EmbeddingServiceClass {
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey) {
      throw new Error("Missing OpenAI API key");
    }

    this.openai = new OpenAI({ apiKey });
    this.embeddingModel = "text-embedding-3-small";
    this.chatModel = "gpt-4.1-nano";
  }

  async createEmbedding(text) {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    return response.data[0].embedding;
  }

  async createEmbeddings(texts) {
    const embeddings = await Promise.all(
      texts.map((text) => this.createEmbedding(text))
    );
    return embeddings;
  }

  async generateAnswer(context, question) {
    const prompt = `You are an HR assistant. Use the following context to answer the user's question. 
If the context does not contain enough information to answer the question completely, use the context as much as possible and supplement with general knowledge, but clearly indicate what comes from the policy document vs general knowledge.

Context: ${context}

Question: ${question}

Answer:`;

    const completion = await this.openai.chat.completions.create({
      model: this.chatModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    return completion.choices[0].message.content;
  }
}

const EmbeddingService = new EmbeddingServiceClass();
export default EmbeddingService;
