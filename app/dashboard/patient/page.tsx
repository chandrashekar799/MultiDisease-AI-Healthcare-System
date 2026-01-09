'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { analyzeSymptoms } from '@/lib/gemini'
import { Consultation } from '@/types'
import { MessageSquare, History, LogOut, Send, X, CheckCircle, DollarSign, Pill } from 'lucide-react'

const COMMON_SYMPTOMS = [
  'Fever',
  'Headache',
  'Cough',
  'Sore Throat',
  'Nausea',
  'Dizziness',
  'Fatigue',
  'Body Aches',
  'Chest Pain',
  'Shortness of Breath',
  'Abdominal Pain',
  'Joint Pain',
  'Rash',
  'Diarrhea',
  'Constipation',
]

type ViewMode = 'chat' | 'history'

interface Medicine {
  name: string
  genericName?: string
  description?: string
  cost?: string
}

// Function to parse medicines from analysis text
function parseMedicines(analysis: string): Medicine[] {
  const medicines: Medicine[] = []
  
  // Try to find medicines section
  const medicineSection = analysis.match(/MEDICINES?:([\s\S]*?)(?:\n\n|\n\d+\.|$)/i)
  if (!medicineSection) {
    // Try alternative patterns
    const altPattern = analysis.match(/(?:Recommended medicines|Medicines|Prescription):([\s\S]*?)(?:\n\n|\n\d+\.|Important|When to consult|$)/i)
    if (altPattern) {
      const medicineText = altPattern[1]
      const lines = medicineText.split('\n').filter(line => line.trim() && line.includes('$'))
      
      lines.forEach(line => {
        const costMatch = line.match(/\$([\d,]+\.?\d*)/)
        const cost = costMatch ? costMatch[1] : undefined
        
        // Extract medicine name (before colon or dash)
        const nameMatch = line.match(/[-•]\s*(.+?)(?:\s*\(|:|\s*-\s*Approximate|$)/)
        const name = nameMatch ? nameMatch[1].trim() : line.split(':')[0].trim()
        
        // Extract generic name if in parentheses
        const genericMatch = line.match(/\(([^)]+)\)/)
        const genericName = genericMatch ? genericMatch[1] : undefined
        
        if (name && name.length > 2) {
          medicines.push({
            name: name,
            genericName: genericName,
            description: line.split(':')[1]?.split('Approximate')[0]?.trim(),
            cost: cost
          })
        }
      })
    }
    return medicines
  }
  
  const medicineText = medicineSection[1]
  const lines = medicineText.split('\n').filter(line => line.trim() && (line.includes('$') || line.includes('Cost')))
  
  lines.forEach(line => {
    const costMatch = line.match(/(?:Cost|Approximate Cost):\s*\$?([\d,]+\.?\d*)/i)
    const cost = costMatch ? costMatch[1] : line.match(/\$([\d,]+\.?\d*)/)?.[1]
    
    // Extract medicine name
    const nameMatch = line.match(/[-•]\s*(.+?)(?:\s*\(|:|\s*-\s*|Approximate|$)/)
    const name = nameMatch ? nameMatch[1].trim() : line.split(':')[0].replace(/[-•]/, '').trim()
    
    // Extract generic name if in parentheses
    const genericMatch = line.match(/\(([^)]+)\)/)
    const genericName = genericMatch ? genericMatch[1] : undefined
    
    if (name && name.length > 2) {
      medicines.push({
        name: name,
        genericName: genericName,
        description: line.split(':')[1]?.split('Approximate')[0]?.trim(),
        cost: cost
      })
    }
  })
  
  return medicines
}

export default function PatientDashboard() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('chat')
  const [symptoms, setSymptoms] = useState('')
  const [selectedSymptom, setSelectedSymptom] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; content: string }>>([])
  const [loading, setLoading] = useState(false)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [user, setUser] = useState<any>(null)
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (viewMode === 'history') {
      loadConsultations()
    }
  }, [viewMode])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    setUser(user)
  }

  const loadConsultations = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading consultations:', error)
    } else {
      setConsultations(data || [])
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const addSymptomFromDropdown = () => {
    if (selectedSymptom) {
      setSymptoms(prev => prev ? `${prev}, ${selectedSymptom}` : selectedSymptom)
      setSelectedSymptom('')
    }
  }

  const handleSendMessage = async () => {
    if (!symptoms.trim() && !selectedSymptom) return

    const finalSymptoms = symptoms || selectedSymptom
    setLoading(true)

    // Add user message
    const userMessage = { role: 'user' as const, content: finalSymptoms }
    setMessages(prev => [...prev, userMessage])
    setSymptoms('')
    setSelectedSymptom('')

    try {
      // Get AI analysis
      const analysis = await analyzeSymptoms(finalSymptoms)

      // Add AI response
      const aiMessage = { role: 'ai' as const, content: analysis }
      setMessages(prev => [...prev, aiMessage])

      // Save to database
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase
          .from('consultations')
          .insert([
            {
              patient_id: user.id,
              symptoms: finalSymptoms,
              analysis: analysis,
            },
          ])

        if (error) {
          console.error('Error saving consultation:', error)
        } else {
          // Reload consultations if in history view
          loadConsultations()
        }
      }
    } catch (error: any) {
      const errorMessage = { role: 'ai' as const, content: `Error: ${error.message}` }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">AI Doctor - Patient Portal</h1>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Toggle Buttons */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-4 bg-white p-2 rounded-lg shadow-sm inline-flex">
          <button
            onClick={() => setViewMode('chat')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              viewMode === 'chat'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <MessageSquare size={20} />
            Chat Mode
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              viewMode === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <History size={20} />
            History
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-8">
        {viewMode === 'chat' ? (
          <div className="bg-white rounded-xl shadow-lg p-6 h-[calc(100vh-250px)] flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Start by describing your symptoms or selecting from the dropdown</p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-4 flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Analyzing symptoms...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 pt-4 space-y-4">
              {/* Symptom Dropdown */}
              <div className="flex gap-2">
                <select
                  value={selectedSymptom}
                  onChange={(e) => setSelectedSymptom(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a symptom...</option>
                  {COMMON_SYMPTOMS.map((symptom) => (
                    <option key={symptom} value={symptom}>
                      {symptom}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addSymptomFromDropdown}
                  disabled={!selectedSymptom}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>

              {/* Text Input */}
              <div className="flex gap-2">
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Describe your symptoms or select from dropdown above..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={loading || (!symptoms.trim() && !selectedSymptom)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send size={20} />
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {consultations.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 mt-12">
                <History size={48} className="mx-auto mb-4 opacity-50" />
                <p>No consultation history yet. Start a chat to create your first consultation card.</p>
              </div>
            ) : (
              consultations.map((consultation) => {
                const analysisPreview = consultation.analysis.length > 200 
                  ? consultation.analysis.substring(0, 200) + '...' 
                  : consultation.analysis
                const shouldShowMore = consultation.analysis.length > 200
                
                return (
                  <div
                    key={consultation.id}
                    className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-gray-800">Consultation</h3>
                      <span className="text-xs text-gray-500">
                        {new Date(consultation.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Symptoms:</p>
                        <p className="text-gray-800 text-sm">{consultation.symptoms}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Analysis:</p>
                        <p className="text-gray-800 text-sm whitespace-pre-wrap">
                          {analysisPreview}
                        </p>
                        {shouldShowMore && (
                          <button
                            onClick={() => setSelectedConsultation(consultation)}
                            className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Show More
                          </button>
                        )}
                      </div>
                      
                      {/* Medicines Preview */}
                      {(() => {
                        const medicines = parseMedicines(consultation.analysis)
                        if (medicines.length > 0) {
                          const totalMedicineCost = medicines.reduce((sum, med) => {
                            const cost = parseFloat(med.cost?.replace(/,/g, '') || '0')
                            return sum + cost
                          }, 0)
                          
                          return (
                            <div className="pt-3 border-t border-gray-200">
                              <p className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                                <Pill size={16} className="text-blue-600" />
                                Recommended Medicines:
                              </p>
                              <div className="space-y-2">
                                {medicines.slice(0, 2).map((med, idx) => (
                                  <div key={idx} className="bg-blue-50 p-2 rounded-lg">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-800">
                                          {med.name}
                                        </p>
                                        {med.genericName && (
                                          <p className="text-xs text-gray-600">({med.genericName})</p>
                                        )}
                                      </div>
                                      {med.cost && (
                                        <span className="text-sm font-semibold text-blue-600 ml-2">
                                          ${med.cost}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {medicines.length > 2 && (
                                  <p className="text-xs text-gray-500 text-center">
                                    +{medicines.length - 2} more (see full details)
                                  </p>
                                )}
                                {totalMedicineCost > 0 && (
                                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                                    <span className="text-xs font-medium text-gray-700">Total Medicine Cost:</span>
                                    <span className="text-sm font-bold text-blue-600">${totalMedicineCost.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        }
                        return null
                      })()}
                      
                      {/* Doctor Approved & Fund Raised */}
                      <div className="flex items-center gap-4 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle 
                            size={18} 
                            className={consultation.doctor_approved ? 'text-green-600' : 'text-gray-300'} 
                          />
                          <span className={`text-xs font-medium ${consultation.doctor_approved ? 'text-green-600' : 'text-gray-500'}`}>
                            {consultation.doctor_approved ? 'Doctor Approved' : 'Pending Approval'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign size={18} className="text-blue-600" />
                          <span className="text-xs font-medium text-gray-700">
                            Fund Raised: ${consultation.fund_raised?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Modal for Full Analysis */}
      {selectedConsultation && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedConsultation(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Consultation Details</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(selectedConsultation.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedConsultation(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Symptoms:</p>
                  <p className="text-gray-800 bg-gray-50 p-3 rounded-lg">
                    {selectedConsultation.symptoms}
                  </p>
                </div>
                
                {/* Medicines Section */}
                {(() => {
                  const medicines = parseMedicines(selectedConsultation.analysis)
                  if (medicines.length > 0) {
                    const totalCost = medicines.reduce((sum, med) => {
                      const cost = parseFloat(med.cost?.replace(/,/g, '') || '0')
                      return sum + cost
                    }, 0)
                    
                    return (
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                          <Pill size={18} className="text-blue-600" />
                          Recommended Medicines & Costs:
                        </p>
                        <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                          {medicines.map((med, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-blue-100">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-800">{med.name}</p>
                                  {med.genericName && (
                                    <p className="text-sm text-gray-600 mt-1">Generic: {med.genericName}</p>
                                  )}
                                  {med.description && (
                                    <p className="text-sm text-gray-600 mt-1">{med.description}</p>
                                  )}
                                </div>
                                {med.cost && (
                                  <div className="ml-4 text-right">
                                    <p className="text-lg font-bold text-blue-600">${med.cost}</p>
                                    <p className="text-xs text-gray-500">approx. cost</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {totalCost > 0 && (
                            <div className="pt-3 border-t border-blue-200 flex justify-between items-center">
                              <span className="font-semibold text-gray-700">Total Estimated Cost:</span>
                              <span className="text-xl font-bold text-blue-600">${totalCost.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
                
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">Full Analysis:</p>
                  <div className="text-gray-800 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm leading-relaxed">
                    {selectedConsultation.analysis}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle 
                      size={20} 
                      className={selectedConsultation.doctor_approved ? 'text-green-600' : 'text-gray-300'} 
                    />
                    <span className={`text-sm font-medium ${selectedConsultation.doctor_approved ? 'text-green-600' : 'text-gray-500'}`}>
                      {selectedConsultation.doctor_approved ? 'Doctor Approved' : 'Pending Approval'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={20} className="text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">
                      Fund Raised: ${selectedConsultation.fund_raised?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedConsultation(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

