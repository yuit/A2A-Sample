import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load configuration from .env at project root
dotenv.config();

const vertexai = process.env.VERTEX_AI === 'true';
const apiKey = process.env.VERTEX_API_KEY ?? '';
const modelName = process.env.VERTEX_MODEL ?? 'gemini-3-flash-preview';

export const systemInstruction = 
`
    You are healthcare policy expert. Answer the user's question based on the given document.
    If there is no information in the document, answer that YOU DON'T KNOW.
`;

export class policyAgent {
  private readonly pdfData: Buffer;

  constructor(pdfRelativePath: string = path.join(__dirname, '..', 'data', '2026AnthemgHIPSBC.pdf')) {
    this.pdfData = fs.readFileSync(pdfRelativePath);
  }

  async answerQuery(userPrompt: string): Promise<string> {
    const client = new GoogleGenAI({
      apiKey,
      vertexai,
    });

    const response = await client.models.generateContent({
      model: modelName,
      config: {
        systemInstruction,
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: userPrompt },
            {
              inlineData: {
                data: this.pdfData.toString('base64'),
                mimeType: 'application/pdf',
              },
            },
          ],
        },
      ],
    });

    return response.text ?? '';
  }
}

