export async function analyzeSymptoms(symptoms: string): Promise<string> {
  try {
    const response = await fetch('/api/analyze-symptoms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symptoms }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to analyze symptoms')
    }

    const data = await response.json()
    return data.analysis
  } catch (error: any) {
    console.error('Error calling Gemini API:', error)
    throw new Error(error.message || 'Failed to analyze symptoms. Please try again.')
  }
}

