import dotenv from "dotenv";

dotenv.config();

export const config = {
  appId: process.env.APP_ID || "123456",
  privateKey: process.env.PRIVATE_KEY || "mock-private-key",
  webhookSecret: process.env.WEBHOOK_SECRET || "development-secret",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  databaseUrl: process.env.DATABASE_URL || "file:repoclaw.db",
  port: parseInt(process.env.PORT || "3000", 10),
  modelName: process.env.MODEL_NAME || "deepseek-chat",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
  maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
  sandboxTimeoutMs: parseInt(process.env.SANDBOX_TIMEOUT_MS || "30000", 10),
};
