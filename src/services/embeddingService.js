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
    const prompt = `You are a helpful and concise assistant.

    Answer the user's question based on the provided context. If the answer is found in the context, briefly confirm it and naturally mention that it's based on the context (without repeating the same information from the context).
    
    If the answer is not found in the context, but can be answered with general knowledge, answer it and add: "based on general knowledge."
    
    Avoid repeating the same facts from the context. Be conversational and brief.
    
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
