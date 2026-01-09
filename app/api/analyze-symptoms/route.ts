import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyB_MdfZigWxqNAAVFpDVDbDelDIhK0pPQ4'
// The client gets the API key from the environment variable `GEMINI_API_KEY`
// But we can also pass it explicitly
const ai = new GoogleGenAI({
  apiKey: apiKey
})

export async function POST(request: NextRequest) {
  try {
    const { symptoms } = await request.json()

    if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length === 0) {
      return NextResponse.json(
        { error: 'Symptoms are required' },
        { status: 400 }
      )
    }

    const prompt = `You are a medical AI assistant. Analyze the following symptoms and provide a comprehensive response with:
1. A brief description of what might be happening (possible condition/diagnosis)
2. Recommended medicines with approximate costs in the following format:
   MEDICINES:
   - Medicine Name 1 (Generic Name): Brief description. Approximate Cost: $XX.XX
   - Medicine Name 2 (Generic Name): Brief description. Approximate Cost: $XX.XX
   (Include 2-4 commonly recommended medicines with approximate costs in USD)
3. Important notes and warnings
4. When to consult a real doctor

Format your response in a clear, professional manner. Always emphasize that this is preliminary advice and consulting a healthcare professional is recommended for proper diagnosis and treatment. Include approximate costs for medicines in USD.

Symptoms: ${symptoms}

Please provide a detailed, helpful medical response.`

    // Try different model versions
    const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro']
    let analysis: string
    let success = false

    for (const modelName of modelNames) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        })
        analysis = response.text
        success = true
        console.log(`Successfully used model: ${modelName}`)
        break
      } catch (error: any) {
        console.log(`Model ${modelName} failed: ${error.message}`)
        continue
      }
    }

    if (!success) {
      throw new Error('All Gemini models failed. Please verify your API key has access to Gemini models.')
    }

    return NextResponse.json({ analysis })
  } catch (error: any) {
    console.error('Error calling Gemini API:', error)
    const errorMessage = error.message || 'Unknown error'
    
    // Provide more helpful error messages
    let userMessage = 'Failed to analyze symptoms.'
    if (errorMessage.includes('API key')) {
      userMessage = 'Invalid API key. Please check your Gemini API key configuration.'
    } else if (errorMessage.includes('quota') || errorMessage.includes('quotaExceeded')) {
      userMessage = 'API quota exceeded. Please check your Gemini API usage limits.'
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      userMessage = 'Gemini model not available. Please verify your API key has access to Gemini models. Visit /api/test-gemini to check available models.'
    }
    
    return NextResponse.json(
      { 
        error: userMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

