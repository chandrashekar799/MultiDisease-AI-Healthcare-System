export type UserRole = 'doctor' | 'patient' | 'fundraiser'

export interface User {
  id: string
  email: string
  role: UserRole
  name?: string
  created_at?: string
}

export interface Consultation {
  id: string
  patient_id: string
  symptoms: string
  analysis: string
  doctor_approved?: boolean
  fund_raised?: number
  doctor_notes?: string
  prescription?: string
  approved_by?: string
  created_at: string
}

export interface DoctorStats {
  totalConsultations: number
  approvedConsultations: number
  pendingConsultations: number
  totalPoints: number
}

export interface Donation {
  id: string
  consultation_id: string
  fundraiser_id: string
  amount: number
  donor_name?: string
  donor_email?: string
  notes?: string
  created_at: string
}

export interface FundraiserStats {
  totalRaised: number
  totalDonations: number
  activeCampaigns: number
  consultationsHelped: number
}

