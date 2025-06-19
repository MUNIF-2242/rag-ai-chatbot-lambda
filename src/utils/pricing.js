export function calculateEmbeddingCost(
  tokenCount,
  model = "text-embedding-3-small"
) {
  const PRICES_PER_MILLION = {
    "text-embedding-3-small": 0.02,
    "text-embedding-3-large": 0.13,
    "text-embedding-ada-002": 0.1,
  };

  const pricePerMillion = PRICES_PER_MILLION[model] || 0.02;
  return (tokenCount / 1_000_000) * pricePerMillion;
}
