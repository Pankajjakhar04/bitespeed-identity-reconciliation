import "dotenv/config";
import express from "express";
import { errorHandler } from "./middleware/errorHandler";
import identifyRouter from "./routes/identify";
import prisma from "./lib/prisma";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/", identifyRouter);
app.use(errorHandler);

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log("Database connection established.");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();

export default app;
