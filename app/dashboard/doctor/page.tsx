'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Consultation, DoctorStats } from '@/types'
import { LogOut, CheckCircle, XCircle, FileText, Clock, Trophy, Share2, User, Pill, MessageSquare } from 'lucide-react'

type ViewMode = 'dashboard' | 'consultations' | 'history'

export default function DoctorDashboard() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [stats, setStats] = useState<DoctorStats>({
    totalConsultations: 0,
    approvedConsultations: 0,
    pendingConsultations: 0,
    totalPoints: 0
  })
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  const [doctorNotes, setDoctorNotes] = useState('')
  const [prescription, setPrescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkUser()
    if (viewMode === 'dashboard') {
      loadStats()
    } else if (viewMode === 'consultations') {
      loadConsultations()
    }
  }, [viewMode])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    
    // Verify user is a doctor
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'doctor') {
      router.push('/')
      return
    }

    setUser(user)
  }

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get all consultations
    const { data: allConsultations } = await supabase
      .from('consultations')
      .select('*')

    // Get doctor points
    const { data: pointsData } = await supabase
      .from('doctor_points')
      .select('points')
      .eq('doctor_id', user.id)

    const totalPoints = pointsData?.reduce((sum, p) => sum + (p.points || 0), 0) || 0
    const total = allConsultations?.length || 0
    const approved = allConsultations?.filter(c => c.doctor_approved).length || 0
    const pending = total - approved

    setStats({
      totalConsultations: total,
      approvedConsultations: approved,
      pendingConsultations: pending,
      totalPoints: totalPoints
    })
  }

  const loadConsultations = async () => {
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading consultations:', error)
    } else {
      setConsultations(data || [])
    }
  }

  const handleApprove = async (consultation: Consultation, approved: boolean) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Build update object with only available fields
      const updateData: any = {
        doctor_approved: approved,
      }

      // Only include these fields if columns exist (will be added via migration)
      if (doctorNotes) {
        updateData.doctor_notes = doctorNotes
      }
      if (prescription) {
        updateData.prescription = prescription
      }
      if (approved) {
        updateData.approved_by = user.id
      } else {
        updateData.approved_by = null
      }

      // Update consultation
      const { error: updateError } = await supabase
        .from('consultations')
        .update(updateData)
        .eq('id', consultation.id)

      if (updateError) {
        // Check if it's a column error
        if (updateError.message.includes('column') || updateError.message.includes('schema cache')) {
          throw new Error('Database schema needs to be updated. Please run the migration script: supabase-migration-doctor-fields.sql')
        }
        throw updateError
      }

      // Award points if approved
      if (approved) {
        const { error: pointsError } = await supabase
          .from('doctor_points')
          .insert([
            {
              doctor_id: user.id,
              consultation_id: consultation.id,
              points: 10, // 10 points per approval
              reason: 'Approved consultation'
            }
          ])

        if (pointsError) console.error('Error adding points:', pointsError)
      }

      // Reload data
      await loadConsultations()
      await loadStats()
      setSelectedConsultation(null)
      setDoctorNotes('')
      setPrescription('')
    } catch (error: any) {
      console.error('Error approving consultation:', error)
      alert('Failed to update consultation: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const shareOnSocialMedia = (platform: string) => {
    const text = `I've reviewed ${stats.approvedConsultations} consultations and earned ${stats.totalPoints} points on AI Doctor! 🏥👨‍⚕️`
    const url = window.location.origin

    let shareUrl = ''
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`
        break
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
        break
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`
        break
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }
  }

  const pendingConsultations = consultations.filter(c => !c.doctor_approved)
  const approvedConsultations = consultations.filter(c => c.doctor_approved)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">AI Doctor - Doctor Portal</h1>
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

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-4 bg-white p-2 rounded-lg shadow-sm inline-flex">
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              viewMode === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Trophy size={20} />
            Dashboard
          </button>
          <button
            onClick={() => setViewMode('consultations')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              viewMode === 'consultations'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FileText size={20} />
            Consultations
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              viewMode === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Clock size={20} />
            History
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-8">
        {viewMode === 'dashboard' ? (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Consultations</p>
                    <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalConsultations}</p>
                  </div>
                  <FileText className="text-blue-600" size={40} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Approved</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">{stats.approvedConsultations}</p>
                  </div>
                  <CheckCircle className="text-green-600" size={40} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">{stats.pendingConsultations}</p>
                  </div>
                  <Clock className="text-orange-600" size={40} />
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/90">Total Points</p>
                    <p className="text-3xl font-bold mt-2">{stats.totalPoints}</p>
                  </div>
                  <Trophy size={40} />
                </div>
              </div>
            </div>

            {/* Share Achievement Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Share Your Achievement!</h2>
                  <p className="text-blue-100 mb-4">
                    You've reviewed {stats.approvedConsultations} consultations and earned {stats.totalPoints} points. Share your success!
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => shareOnSocialMedia('twitter')}
                      className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
                    >
                      <Share2 size={18} />
                      Twitter
                    </button>
                    <button
                      onClick={() => shareOnSocialMedia('facebook')}
                      className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
                    >
                      <Share2 size={18} />
                      Facebook
                    </button>
                    <button
                      onClick={() => shareOnSocialMedia('linkedin')}
                      className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
                    >
                      <Share2 size={18} />
                      LinkedIn
                    </button>
                    <button
                      onClick={() => shareOnSocialMedia('whatsapp')}
                      className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
                    >
                      <Share2 size={18} />
                      WhatsApp
                    </button>
                  </div>
                </div>
                <Trophy size={80} className="opacity-20" />
              </div>
            </div>
          </div>
        ) : viewMode === 'consultations' ? (
          <div className="space-y-6">
            {/* Pending Consultations */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="text-orange-600" size={24} />
                Pending Consultations ({pendingConsultations.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingConsultations.length === 0 ? (
                  <div className="col-span-full text-center text-gray-500 py-12 bg-white rounded-xl">
                    <Clock size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No pending consultations</p>
                  </div>
                ) : (
                  pendingConsultations.map((consultation) => (
                    <div
                      key={consultation.id}
                      className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setSelectedConsultation(consultation)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-gray-800">Consultation</h3>
                        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Pending</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{consultation.symptoms}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(consultation.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Approved Consultations */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <CheckCircle className="text-green-600" size={24} />
                Approved Consultations ({approvedConsultations.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {approvedConsultations.length === 0 ? (
                  <div className="col-span-full text-center text-gray-500 py-12 bg-white rounded-xl">
                    <CheckCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No approved consultations yet</p>
                  </div>
                ) : (
                  approvedConsultations.map((consultation) => (
                    <div
                      key={consultation.id}
                      className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setSelectedConsultation(consultation)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-gray-800">Consultation</h3>
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Approved</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{consultation.symptoms}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(consultation.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">All Consultations History</h2>
            <div className="space-y-4">
              {consultations.map((consultation) => (
                <div
                  key={consultation.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedConsultation(consultation)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {consultation.doctor_approved ? (
                          <CheckCircle className="text-green-600" size={20} />
                        ) : (
                          <Clock className="text-orange-600" size={20} />
                        )}
                        <span className="font-medium text-gray-800">
                          {consultation.doctor_approved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{consultation.symptoms}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(consultation.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Consultation Detail Modal */}
      {selectedConsultation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setSelectedConsultation(null)
            setDoctorNotes('')
            setPrescription('')
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
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
                onClick={() => {
                  setSelectedConsultation(null)
                  setDoctorNotes('')
                  setPrescription('')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                    <User size={18} />
                    Patient Symptoms:
                  </p>
                  <p className="text-gray-800 bg-gray-50 p-3 rounded-lg">
                    {selectedConsultation.symptoms}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                    <MessageSquare size={18} />
                    AI Analysis:
                  </p>
                  <div className="text-gray-800 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm">
                    {selectedConsultation.analysis}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    Doctor Notes:
                  </label>
                  <textarea
                    value={doctorNotes || selectedConsultation.doctor_notes || ''}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Add your professional notes here..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                    <Pill size={18} />
                    Prescription:
                  </label>
                  <textarea
                    value={prescription || selectedConsultation.prescription || ''}
                    onChange={(e) => setPrescription(e.target.value)}
                    placeholder="Add prescription details here..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {selectedConsultation.doctor_approved ? (
                  <span className="text-green-600 font-medium flex items-center gap-2">
                    <CheckCircle size={20} />
                    Approved
                  </span>
                ) : (
                  <span className="text-orange-600 font-medium flex items-center gap-2">
                    <Clock size={20} />
                    Pending Approval
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                {!selectedConsultation.doctor_approved && (
                  <button
                    onClick={() => handleApprove(selectedConsultation, false)}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <XCircle size={18} />
                    Reject
                  </button>
                )}
                <button
                  onClick={() => handleApprove(selectedConsultation, true)}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  {selectedConsultation.doctor_approved ? 'Update' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
