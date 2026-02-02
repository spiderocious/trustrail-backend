import OpenAI from 'openai';
import logger from '../config/logger';
import { TrustEngineAnalysisResult } from '../types/trustEngine.types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Upload bank statement file (PDF or CSV) to OpenAI
 */
export const uploadFileToOpenAI = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ fileId: string; fileSize: number }> => {
  try {
    const file = await openai.files.create({
      file: new File([fileBuffer], fileName, { type: mimeType }),
      purpose: 'assistants',
    });

    logger.info(`File uploaded to OpenAI: ${file.id} (${fileName})`);

    return {
      fileId: file.id,
      fileSize: fileBuffer.length,
    };
  } catch (error: any) {
    logger.error('OpenAI file upload error:', error);
    throw new Error(`Failed to upload file to OpenAI: ${error.message}`);
  }
};

/**
 * Analyze bank statement using OpenAI Chat Completions API
 * Uses configurable prompt from environment variable
 */
export const analyzeFileWithOpenAI = async (
  fileId: string,
  installmentAmount: number,
  approvalWorkflow: any
): Promise<{
  analysisResult: TrustEngineAnalysisResult;
  fullResponse: any; // Save entire response for debugging
  fullPrompt?: string;
}> => {
  try {
    const systemPrompt = process.env.OPENAI_PROMPT;
    if (!systemPrompt) {
      throw new Error('OPENAI_PROMPT environment variable is not set');
    }

    // Build the prompt with context
    const fullPrompt = `${systemPrompt}

Installment Amount: ₦${installmentAmount}
Auto-Approve Threshold: ${approvalWorkflow.autoApproveThreshold}
Auto-Decline Threshold: ${approvalWorkflow.autoDeclineThreshold}
Min Trust Score: ${approvalWorkflow.minTrustScore}`;

    // Use Chat Completions API with file
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'developer',
          content: [
            {
              type: 'text',
              text: fullPrompt,
            },
          ],
        } as any,
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                file_id: fileId,
              },
            },
          ],
        } as any,
      ],
      response_format: { type: 'json_object' },
    }, {
      timeout: 600000, // 10 minutes
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response from OpenAI');
    }

    const messageContent = response.choices[0].message.content;
    if (!messageContent) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse JSON response
    const analysisResult: TrustEngineAnalysisResult = JSON.parse(messageContent);

    // Save full response for debugging
    const fullResponse = {
      model: response.model,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason,
      rawResponse: messageContent,
      completedAt: new Date().toISOString(),
    };

    logger.info(`OpenAI analysis completed for file ${fileId} (model: ${response.model})`);

    return {
      analysisResult,
      fullResponse,
      fullPrompt,
    };
  } catch (error: any) {
    logger.error('OpenAI analysis error:', error);
    throw new Error(`OpenAI analysis failed: ${error.message}`);
  }
};

/**
 * Delete file from OpenAI (cleanup)
 */
export const deleteOpenAIFile = async (fileId: string): Promise<void> => {
  try {
    await openai.files.delete(fileId);
    logger.info(`Deleted OpenAI file: ${fileId}`);
  } catch (error: any) {
    logger.warn(`Failed to delete OpenAI file ${fileId}:`, error.message);
  }
};

export default {
  uploadFileToOpenAI,
  analyzeFileWithOpenAI,
  deleteOpenAIFile,
};
