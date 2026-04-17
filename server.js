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
            "Extract the course name, professor name, final category name, and grading categories with numeric weights from this syllabus image."
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
            "Extract the course name, professor name, final category name, and grading categories with numeric weights from this syllabus PDF."
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
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You extract structured syllabus grading data. Return only the requested schema."
            }
          ]
        },
        {
          role: "user",
          content
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "syllabus_grading_info",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              courseName: { type: "string" },
              professorName: { type: "string" },
              finalCategoryName: { type: "string" },
              categories: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    weight: { type: "number" }
                  },
                  required: ["name", "weight"]
                }
              }
            },
            required: [
              "courseName",
              "professorName",
              "finalCategoryName",
              "categories"
            ]
          }
        }
      }
    });

    const rawText = response.output_text || "";
    console.log("AI RAW:", rawText);

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseError) {
      return res.status(500).json({
        error: "AI did not return valid JSON.",
        raw: rawText
      });
    }

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
