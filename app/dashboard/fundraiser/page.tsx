'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Consultation, Donation, FundraiserStats } from '@/types'
import { LogOut, DollarSign, TrendingUp, Users, Target, Plus, Edit, X, CheckCircle, Clock, Heart, Share2, BarChart3, Pill } from 'lucide-react'

type ViewMode = 'dashboard' | 'campaigns' | 'donations' | 'statistics'

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

export default function FundraiserDashboard() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<FundraiserStats>({
    totalRaised: 0,
    totalDonations: 0,
    activeCampaigns: 0,
    consultationsHelped: 0
  })
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  const [donationAmount, setDonationAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [donationNotes, setDonationNotes] = useState('')
  const [showDonationModal, setShowDonationModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateAmount, setUpdateAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkUser()
    if (viewMode === 'dashboard') {
      loadStats()
      loadConsultations()
    } else if (viewMode === 'campaigns') {
      loadConsultations()
    } else if (viewMode === 'donations') {
      loadDonations()
    } else if (viewMode === 'statistics') {
      loadStats()
      loadDonations()
    }
  }, [viewMode])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    
    // Verify user is a fundraiser
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'fundraiser') {
      router.push('/')
      return
    }

    setUser(user)
  }

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get all donations by this fundraiser
    const { data: donationsData } = await supabase
      .from('donations')
      .select('amount')
      .eq('fundraiser_id', user.id)

    // Get consultations with funds raised
    const { data: consultationsData } = await supabase
      .from('consultations')
      .select('fund_raised, doctor_approved')
      .gt('fund_raised', 0)

    const totalRaised = donationsData?.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0) || 0
    const totalDonations = donationsData?.length || 0
    const consultationsHelped = consultationsData?.filter(c => c.fund_raised > 0).length || 0
    const activeCampaigns = consultationsData?.filter(c => c.doctor_approved && c.fund_raised > 0).length || 0

    setStats({
      totalRaised,
      totalDonations,
      activeCampaigns,
      consultationsHelped
    })
  }

  const loadConsultations = async () => {
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading consultations:', error)
      // Check if it's a permissions error
      if (error.message.includes('policy') || error.message.includes('permission')) {
        alert('Permission error: Fundraisers need SELECT policy on consultations. Please run the migration script.')
      }
    } else {
      console.log('Loaded consultations:', data?.length || 0)
      setConsultations(data || [])
    }
  }

  const loadDonations = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('donations')
      .select('*')
      .eq('fundraiser_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading donations:', error)
    } else {
      setDonations(data || [])
    }
  }

  const handleAddDonation = async () => {
    if (!selectedConsultation || !donationAmount || parseFloat(donationAmount) <= 0) {
      alert('Please enter a valid donation amount')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const amount = parseFloat(donationAmount)
      const currentFundRaised = selectedConsultation.fund_raised || 0

      // Add donation record
      const { error: donationError } = await supabase
        .from('donations')
        .insert([
          {
            consultation_id: selectedConsultation.id,
            fundraiser_id: user.id,
            amount: amount,
            donor_name: donorName || null,
            donor_email: donorEmail || null,
            notes: donationNotes || null
          }
        ])

      if (donationError) throw donationError

      // Update consultation fund_raised
      const { error: updateError } = await supabase
        .from('consultations')
        .update({
          fund_raised: currentFundRaised + amount
        })
        .eq('id', selectedConsultation.id)

      if (updateError) throw updateError

      // Reload data
      await loadConsultations()
      await loadStats()
      await loadDonations()
      
      // Reset form
      setShowDonationModal(false)
      setDonationAmount('')
      setDonorName('')
      setDonorEmail('')
      setDonationNotes('')
      setSelectedConsultation(null)
    } catch (error: any) {
      console.error('Error adding donation:', error)
      alert('Failed to add donation: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateFundRaised = async () => {
    if (!selectedConsultation || !updateAmount) {
      alert('Please enter an amount')
      return
    }

    setLoading(true)
    try {
      const amount = parseFloat(updateAmount)

      const { error: updateError } = await supabase
        .from('consultations')
        .update({
          fund_raised: amount
        })
        .eq('id', selectedConsultation.id)

      if (updateError) throw updateError

      // Reload data
      await loadConsultations()
      await loadStats()
      
      setShowUpdateModal(false)
      setUpdateAmount('')
      setSelectedConsultation(null)
    } catch (error: any) {
      console.error('Error updating fund raised:', error)
      alert('Failed to update: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const shareOnSocialMedia = (platform: string) => {
    const text = `I've helped raise $${stats.totalRaised.toFixed(2)} for ${stats.consultationsHelped} patients on AI Doctor! 💚🏥`
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

  const consultationsNeedingFunding = consultations.filter(c => c.doctor_approved && (c.fund_raised || 0) === 0)
  const activeCampaigns = consultations.filter(c => c.doctor_approved && (c.fund_raised || 0) > 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">AI Doctor - Fundraiser Portal</h1>
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
        <div className="flex gap-4 bg-white p-2 rounded-lg shadow-sm inline-flex flex-wrap">
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              viewMode === 'dashboard'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <BarChart3 size={20} />
            Dashboard
          </button>
          <button
            onClick={() => setViewMode('campaigns')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              viewMode === 'campaigns'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Target size={20} />
            Campaigns
          </button>
          <button
            onClick={() => setViewMode('donations')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              viewMode === 'donations'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <DollarSign size={20} />
            Donations
          </button>
          <button
            onClick={() => setViewMode('statistics')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              viewMode === 'statistics'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <TrendingUp size={20} />
            Statistics
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
                    <p className="text-sm text-gray-600">Total Raised</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">${stats.totalRaised.toFixed(2)}</p>
                  </div>
                  <DollarSign className="text-green-600" size={40} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Donations</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalDonations}</p>
                  </div>
                  <Heart className="text-blue-600" size={40} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Campaigns</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{stats.activeCampaigns}</p>
                  </div>
                  <Target className="text-purple-600" size={40} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Patients Helped</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">{stats.consultationsHelped}</p>
                  </div>
                  <Users className="text-orange-600" size={40} />
                </div>
              </div>
            </div>

            {/* Share Achievement Card */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl shadow-lg p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Share Your Impact!</h2>
                  <p className="text-green-100 mb-4">
                    You've raised ${stats.totalRaised.toFixed(2)} and helped {stats.consultationsHelped} patients. Share your success!
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => shareOnSocialMedia('twitter')}
                      className="bg-white text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors flex items-center gap-2"
                    >
                      <Share2 size={18} />
                      Twitter
                    </button>
                    <button
                      onClick={() => shareOnSocialMedia('facebook')}
                      className="bg-white text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors flex items-center gap-2"
                    >
                      <Share2 size={18} />
                      Facebook
                    </button>
                    <button
                      onClick={() => shareOnSocialMedia('linkedin')}
                      className="bg-white text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors flex items-center gap-2"
                    >
                      <Share2 size={18} />
                      LinkedIn
                    </button>
                    <button
                      onClick={() => shareOnSocialMedia('whatsapp')}
                      className="bg-white text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors flex items-center gap-2"
                    >
                      <Share2 size={18} />
                      WhatsApp
                    </button>
                  </div>
                </div>
                <Heart size={80} className="opacity-20" />
              </div>
            </div>

            {/* Consultations Needing Funding */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="text-orange-600" size={24} />
                Consultations Needing Funding ({consultationsNeedingFunding.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {consultationsNeedingFunding.length === 0 ? (
                  <div className="col-span-full text-center text-gray-500 py-12 bg-white rounded-xl">
                    <CheckCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p>All approved consultations have funding!</p>
                  </div>
                ) : (
                  consultationsNeedingFunding.slice(0, 6).map((consultation) => {
                    const medicines = parseMedicines(consultation.analysis)
                    const totalMedicineCost = medicines.reduce((sum, med) => {
                      const cost = parseFloat(med.cost?.replace(/,/g, '') || '0')
                      return sum + cost
                    }, 0)
                    
                    return (
                      <div
                        key={consultation.id}
                        className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
                        onClick={() => {
                          setSelectedConsultation(consultation)
                          setShowDonationModal(true)
                        }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold text-gray-800">Campaign</h3>
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Needs Funding</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{consultation.symptoms}</p>
                        
                        {/* Medicines Preview */}
                        {medicines.length > 0 && (
                          <div className="mb-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                              <Pill size={14} className="text-blue-600" />
                              Medicines Needed:
                            </p>
                            <div className="space-y-1">
                              {medicines.slice(0, 2).map((med, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                  <span className="text-gray-700 truncate flex-1">{med.name}</span>
                                  {med.cost && (
                                    <span className="text-blue-600 font-semibold ml-2">${med.cost}</span>
                                  )}
                                </div>
                              ))}
                              {medicines.length > 2 && (
                                <p className="text-xs text-gray-500">+{medicines.length - 2} more</p>
                              )}
                            </div>
                            {totalMedicineCost > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-700">Total Medicine Cost:</span>
                                <span className="text-sm font-bold text-blue-600">${totalMedicineCost.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                          <span className="text-xs text-gray-500">Fund Raised</span>
                          <span className="text-lg font-bold text-green-600">$0.00</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        ) : viewMode === 'campaigns' ? (
          <div className="space-y-6">
            {/* Active Campaigns */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Target className="text-green-600" size={24} />
                Active Campaigns ({activeCampaigns.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCampaigns.length === 0 ? (
                  <div className="col-span-full text-center text-gray-500 py-12 bg-white rounded-xl">
                    <Target size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No active campaigns yet</p>
                  </div>
                ) : (
                  activeCampaigns.map((consultation) => {
                    const medicines = parseMedicines(consultation.analysis)
                    const totalMedicineCost = medicines.reduce((sum, med) => {
                      const cost = parseFloat(med.cost?.replace(/,/g, '') || '0')
                      return sum + cost
                    }, 0)
                    
                    return (
                      <div
                        key={consultation.id}
                        className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold text-gray-800">Campaign</h3>
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Active</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{consultation.symptoms}</p>
                        
                        {/* Medicines Preview */}
                        {medicines.length > 0 && (
                          <div className="mb-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                              <Pill size={14} className="text-blue-600" />
                              Medicines Needed:
                            </p>
                            <div className="space-y-1">
                              {medicines.slice(0, 2).map((med, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                  <span className="text-gray-700 truncate flex-1">{med.name}</span>
                                  {med.cost && (
                                    <span className="text-blue-600 font-semibold ml-2">${med.cost}</span>
                                  )}
                                </div>
                              ))}
                              {medicines.length > 2 && (
                                <p className="text-xs text-gray-500">+{medicines.length - 2} more</p>
                              )}
                            </div>
                            {totalMedicineCost > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-700">Total Medicine Cost:</span>
                                <span className="text-sm font-bold text-blue-600">${totalMedicineCost.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Fund Raised</span>
                            <span className="text-lg font-bold text-green-600">${(consultation.fund_raised || 0).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedConsultation(consultation)
                              setShowDonationModal(true)
                            }}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                          >
                            <Plus size={16} />
                            Add Donation
                          </button>
                          <button
                            onClick={() => {
                              setSelectedConsultation(consultation)
                              setUpdateAmount((consultation.fund_raised || 0).toString())
                              setShowUpdateModal(true)
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-2"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* All Consultations */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">All Consultations</h2>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="space-y-4">
                  {consultations.map((consultation) => {
                    const medicines = parseMedicines(consultation.analysis)
                    const totalMedicineCost = medicines.reduce((sum, med) => {
                      const cost = parseFloat(med.cost?.replace(/,/g, '') || '0')
                      return sum + cost
                    }, 0)
                    
                    return (
                      <div
                        key={consultation.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedConsultation(consultation)
                          setShowDonationModal(true)
                        }}
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
                            <p className="text-sm text-gray-600 mb-2">{consultation.symptoms}</p>
                            
                            {/* Medicines Preview */}
                            {medicines.length > 0 && (
                              <div className="mb-2 p-2 bg-blue-50 rounded-lg">
                                <p className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                                  <Pill size={12} className="text-blue-600" />
                                  Medicines: {medicines.slice(0, 2).map(m => m.name).join(', ')}
                                  {medicines.length > 2 && ` +${medicines.length - 2} more`}
                                </p>
                                {totalMedicineCost > 0 && (
                                  <p className="text-xs text-blue-600 font-semibold">
                                    Total Cost: ${totalMedicineCost.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            )}
                            
                            <p className="text-xs text-gray-500">
                              {new Date(consultation.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-bold text-green-600">${(consultation.fund_raised || 0).toFixed(2)}</p>
                            <p className="text-xs text-gray-500">raised</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'donations' ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">All Donations</h2>
            <div className="space-y-4">
              {donations.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <Heart size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No donations recorded yet</p>
                </div>
              ) : (
                donations.map((donation) => (
                  <div key={donation.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Heart className="text-red-500" size={20} />
                          <span className="font-medium text-gray-800">
                            {donation.donor_name || 'Anonymous Donor'}
                          </span>
                        </div>
                        {donation.donor_email && (
                          <p className="text-sm text-gray-600 mb-1">{donation.donor_email}</p>
                        )}
                        {donation.notes && (
                          <p className="text-sm text-gray-600 italic">"{donation.notes}"</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(donation.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-green-600">${parseFloat(donation.amount.toString()).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Fundraising Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Total Amount Raised</p>
                  <p className="text-4xl font-bold text-green-600">${stats.totalRaised.toFixed(2)}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Total Donations</p>
                  <p className="text-4xl font-bold text-blue-600">{stats.totalDonations}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Active Campaigns</p>
                  <p className="text-4xl font-bold text-purple-600">{stats.activeCampaigns}</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Patients Helped</p>
                  <p className="text-4xl font-bold text-orange-600">{stats.consultationsHelped}</p>
                </div>
              </div>
            </div>

            {donations.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Donations</h3>
                <div className="space-y-3">
                  {donations.slice(0, 5).map((donation) => (
                    <div key={donation.id} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-0">
                      <div>
                        <p className="font-medium text-gray-800">{donation.donor_name || 'Anonymous'}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(donation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-green-600">${parseFloat(donation.amount.toString()).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Donation Modal */}
      {showDonationModal && selectedConsultation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowDonationModal(false)
            setSelectedConsultation(null)
            setDonationAmount('')
            setDonorName('')
            setDonorEmail('')
            setDonationNotes('')
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Add Donation</h2>
              <button
                onClick={() => {
                  setShowDonationModal(false)
                  setSelectedConsultation(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultation</label>
                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{selectedConsultation.symptoms.substring(0, 100)}...</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Donation Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Donor Name (Optional)</label>
                <input
                  type="text"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Donor Email (Optional)</label>
                <input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="donor@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={donationNotes}
                  onChange={(e) => setDonationNotes(e.target.value)}
                  placeholder="Add any notes about this donation..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDonationModal(false)
                    setSelectedConsultation(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDonation}
                  disabled={loading || !donationAmount}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Heart size={18} />
                  {loading ? 'Adding...' : 'Add Donation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Fund Raised Modal */}
      {showUpdateModal && selectedConsultation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowUpdateModal(false)
            setSelectedConsultation(null)
            setUpdateAmount('')
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Update Fund Raised</h2>
              <button
                onClick={() => {
                  setShowUpdateModal(false)
                  setSelectedConsultation(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultation</label>
                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{selectedConsultation.symptoms.substring(0, 100)}...</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Fund Raised *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={updateAmount}
                  onChange={(e) => setUpdateAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowUpdateModal(false)
                    setSelectedConsultation(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateFundRaised}
                  disabled={loading || !updateAmount}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Edit size={18} />
                  {loading ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
