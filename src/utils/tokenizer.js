import pkg from "tiktoken";
const { encoding_for_model } = pkg;

let tokenizer = null;

export async function countTokens(text) {
  try {
    if (!tokenizer) {
      tokenizer = encoding_for_model("text-embedding-3-small");
    }

    const encoded = tokenizer.encode(text);

    return encoded.length;
  } catch (error) {
    console.error("Error counting tokens:", error);
    throw error;
  }
}
