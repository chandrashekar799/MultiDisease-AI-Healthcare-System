import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyB_MdfZigWxqNAAVFpDVDbDelDIhK0pPQ4'
const ai = new GoogleGenAI({
  apiKey: apiKey
})

export async function GET(request: NextRequest) {
  try {
    // Test with a simple model call
    const testModels = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash']
    const results: any[] = []

    for (const modelName of testModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: 'Say "test"',
        })
        results.push({
          model: modelName,
          status: 'success',
          response: response.text.substring(0, 50)
        })
      } catch (error: any) {
        results.push({
          model: modelName,
          status: 'failed',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      apiKeyConfigured: !!apiKey,
      testResults: results,
      message: 'Check testResults to see which models work'
    })
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Failed to test API',
        message: error.message 
      },
      { status: 500 }
    )
  }
}

