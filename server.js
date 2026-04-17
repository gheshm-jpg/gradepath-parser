import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("GradePath parser backend is running.");
});

app.post("/analyze-syllabus", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const mimeType = req.file.mimetype;
    const base64 = req.file.buffer.toString("base64");

    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      return res.status(400).json({ error: "Only image files or PDFs are allowed." });
    }

    let content;

    if (isImage) {
      content = [
        {
          type: "input_text",
          text:
            'Read this syllabus image and return ONLY valid JSON in this exact format: {"courseName":"","professorName":"","categories":[{"name":"","weight":0}],"finalCategoryName":""}. Extract the course name, professor name, grading categories, and category weights. The weights must be numbers only. If the syllabus is unclear, make the best reasonable guess. Do not include any explanation, only JSON.'
        },
        {
          type: "input_image",
          image_url: `data:${mimeType};base64,${base64}`
        }
      ];
    } else {
      content = [
        {
          type: "input_text",
          text:
            'Read this syllabus PDF and return ONLY valid JSON in this exact format: {"courseName":"","professorName":"","categories":[{"name":"","weight":0}],"finalCategoryName":""}. Extract the course name, professor name, grading categories, and category weights. The weights must be numbers only. If the syllabus is unclear, make the best reasonable guess. Do not include any explanation, only JSON.'
        },
        {
          type: "input_file",
          filename: req.file.originalname,
          file_data: `data:${mimeType};base64,${base64}`
        }
      ];
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content
        }
      ]
    });

    const rawText = response.output_text || "";
    const parsed = JSON.parse(rawText);

    return res.json(parsed);
  } catch (error) {
    console.error("Analyze error:", error);
    return res.status(500).json({
      error: "Failed to analyze syllabus.",
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
