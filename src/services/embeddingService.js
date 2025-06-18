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
    const prompt = `You are a helpful and friendly assistant.

Answer the user's question based on the context below when relevant. If the context includes an answer, give a natural, brief response that reflects the meaning without repeating or quoting it directly.

If the answer is not in the context but is something you can answer from general knowledge, just answer it naturally—**do not mention context or general knowledge explicitly**, and avoid using parentheses.

If the question is a greeting or small talk (like "hi", "how are you"), respond conversationally, as a human would.

Be warm, clear, and concise. Avoid technical phrasing, citations, or brackets.

---
Context:
${context}

Question: ${question}

Answer:`;

    const completion = await this.openai.chat.completions.create({
      model: this.chatModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 200,
    });

    return completion.choices[0].message.content;
  }
}

const EmbeddingService = new EmbeddingServiceClass();
export default EmbeddingService;
