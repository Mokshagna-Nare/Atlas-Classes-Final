
const express = require('express');
const router = express.Router();
const { GoogleGenAI, Type } = require("@google/genai");

// Check for API Key
if (!process.env.API_KEY) {
  console.warn("Warning: API_KEY is missing in .env. AI features will fail.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

router.post('/convert-html', async (req, res) => {
    try {
        const { htmlContent } = req.body;
        
        const systemInstruction = `You are an expert exam digitizer. Convert the provided HTML code into a structured JSON test.
        1. Identify EVERY single question.
        2. Extract question text, options, and answer.
        3. Generate SVG for diagrams in 'diagramSvg' field.
        4. Return ONLY JSON.`;

        // Always use gemini-3-pro-preview for complex reasoning and structured data generation tasks
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            // Simple string prompt for text tasks
            contents: `Extract questions from this HTML: \n\n ${htmlContent}`,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        testTitle: { type: Type.STRING },
                        subject: { type: Type.STRING },
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    question: { type: Type.STRING },
                                    type: { type: Type.STRING },
                                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    answer: { type: Type.STRING },
                                    diagramSvg: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Handle possible parsing errors if AI returns slight deviations
        let jsonResponse;
        try {
            // response.text is a property directly returning the extracted string output
            jsonResponse = JSON.parse(response.text);
        } catch (e) {
            console.error("JSON Parse Error:", response.text);
            return res.status(500).json({ message: "AI response was not valid JSON" });
        }

        res.json(jsonResponse);
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ message: "AI Generation Failed" });
    }
});

module.exports = router;
