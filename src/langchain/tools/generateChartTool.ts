// generate-image.js
import { GoogleGenAI } from "@google/genai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';

// --- 1. Configuración de Clientes (fuera de la función) ---
// Se inicializan una sola vez y se reutilizan en cada invocación de la Lambda.
if (!process.env.GOOGLE_API_KEY || !process.env.APP_REGION || !process.env.S3_BUCKET_NAME) {
  // Esta validación se hace al inicio para evitar errores en tiempo de ejecución.
  throw new Error(
    "Asegúrate de configurar GOOGLE_API_KEY, APP_REGION y S3_BUCKET_NAME en las variables de entorno."
  );
}

const genAI = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY
});
const s3Client = new S3Client({
  region: process.env.APP_REGION,
});

export function generateChartTool() {
  return new DynamicStructuredTool({
    name: 'chart_generator',
    description:
      "Obtener la url de una imagen de un chart generado via prompt.",
    schema: z.object({
      prompt: z.string(),
    }),
    async func(args) {
      console.log(args.prompt)

      // --- 2. Generación de la Imagen con Gemini ---
      console.log("Solicitando la generación de la imagen a Gemini...");
      // Usamos un modelo capaz de generar imágenes como 'gemini-1.5-flash-latest'
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: args.prompt,
      });
      // Asumimos que la respuesta contiene la imagen en el formato esperado.
      // Es importante ajustar esto si la estructura de la respuesta del modelo cambia.
      if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
        throw new Error("No se encontró data de imagen en la respuesta de Gemini.");
      }
      const content = response.candidates[0].content;
      if (!content || !content.parts) {
        throw new Error("La respuesta de Gemini no contiene 'parts' para procesar.");
      }

      const imagePart = content.parts.find(
        (part) => part.inlineData
      );

      if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data || !imagePart.inlineData.mimeType) {
        console.error(
          "Respuesta de la API:",
          JSON.stringify(response, null, 2),
          content.parts.find((part) => part.text)?.text
        );
        throw new Error("No se encontró 'inlineData' con la imagen en la respuesta de Gemini.");
      }

      const imageData = imagePart.inlineData.data;
      const imageBuffer = Buffer.from(imageData, "base64");
      const mimeType = imagePart.inlineData.mimeType;
      const fileExtension = mimeType.split("/")[1] || "png";
      const fileName = `generated-image-${Date.now()}.${fileExtension}`;

      // --- 3. Subida de la Imagen a S3 ---
      console.log(`Subiendo imagen a S3 como '${fileName}'...`);
      const bucketName = process.env.S3_BUCKET_NAME;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: imageBuffer,
        ContentType: mimeType,
      });

      await s3Client.send(command);

      // --- 4. Construcción de la URL pública ---
      // La URL puede variar según tu región y configuración de S3.
      const imageUrl = `https://${bucketName}.s3.${process.env.APP_REGION}.amazonaws.com/${fileName}`;

      console.log("¡Imagen subida con éxito!");
      return imageUrl;
    }
  });
}
