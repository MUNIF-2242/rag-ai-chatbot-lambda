export const createResponse = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    ...headers,
  },
  body: JSON.stringify(body),
});

export const successResponse = (data) => createResponse(200, data);
export const errorResponse = (error, statusCode = 500) =>
  createResponse(statusCode, { error: error.message || error });
export const validationError = (message) =>
  createResponse(400, { error: message });
