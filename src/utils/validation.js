export const validateUrl = (url) => {
  if (!url) throw new Error("URL is required");
  try {
    new URL(url);
    return true;
  } catch {
    throw new Error("Invalid URL format");
  }
};

export const validateQuestion = (question) => {
  if (
    !question ||
    typeof question !== "string" ||
    question.trim().length === 0
  ) {
    throw new Error("Question is required and must be a non-empty string");
  }
  return true;
};

export const validateUrls = (urls) => {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("URLs array is required and must not be empty");
  }
  urls.forEach((url) => validateUrl(typeof url === "string" ? url : url.url));
  return true;
};
