/**
 * Coast Guard SAR Report Generator
 * Generates a formatted report for overdue vessels that can be shared with the Coast Guard
 */

import type { FloatPlan, Boat, BoatDevice, Contact, TankLogEntry, CrewMember } from '../types'

interface ReportData {
  plan: FloatPlan
  boat: Boat | null
  devices: BoatDevice[]
  contacts: Contact[]
  tankLog: TankLogEntry | null
}

/**
 * Generate a formatted Coast Guard SAR report for an overdue vessel
 */
export function generateCoastGuardReport(data: ReportData): string {
  const { plan, boat, devices, contacts, tankLog } = data
  const now = new Date()
  const deadline = new Date(plan.checkInDeadline)
  const overdueMs = now.getTime() - deadline.getTime()
  const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60))
  const overdueMinutes = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60))
  
  const primaryContact = contacts.find(c => c.id === plan.primaryEmergencyContactId)
  const secondaryContact = contacts.find(c => c.id === plan.secondaryEmergencyContactId)
  
  // Calculate fuel/water remaining in gallons
  const fuelGallons = tankLog?.fuel != null && boat?.fuelCapacityGallons 
    ? Math.round((tankLog.fuel / 100) * boat.fuelCapacityGallons)
    : null
  const waterGallons = tankLog?.water != null && boat?.waterCapacityGallons
    ? Math.round((tankLog.water / 100) * boat.waterCapacityGallons)
    : null

  // Format crew list
  const crewList = (plan.crew as CrewMember[]).map((c, i) => {
    const agePart = c.age ? `, Age ${c.age}` : ''
    const medicalPart = c.medicalNotes || 'None noted'
    return `${i + 1}. ${c.name}${agePart}\n   Medical: ${medicalPart}`
  }).join('\n\n')

  // Format devices list
  const devicesList = devices.length > 0 
    ? devices.map(d => {
        const idLabel = d.type === 'dsc_radio' || d.type === 'ais' ? 'MMSI' : 
                        d.type === 'epirb' || d.type === 'plb' ? 'HEX ID' : 'ID'
        return `• ${d.name}${d.deviceId ? ` - ${idLabel}: ${d.deviceId}` : ''}`
      }).join('\n')
    : '• VHF Radio - Monitoring Ch. 16 (assumed)'

  // Format expected return
  let expectedReturn = 'Not specified'
  if (plan.expectedReturnTime) {
    expectedReturn = new Date(plan.expectedReturnTime).toLocaleString()
  } else if (plan.tripDurationHours) {
    expectedReturn = `${plan.tripDurationHours} hours from departure`
  }

  // Format coordinates
  const departureCoords = plan.departureCoords 
    ? `(${plan.departureCoords.latitude.toFixed(4)}, ${plan.departureCoords.longitude.toFixed(4)})`
    : ''
  const destinationCoords = plan.destinationCoords
    ? `(${plan.destinationCoords.latitude.toFixed(4)}, ${plan.destinationCoords.longitude.toFixed(4)})`
    : ''

  // Generate report ID
  const reportId = `FP-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${plan.id.slice(0,4).toUpperCase()}`

  return `
══════════════════════════════════════════════════════════════
           OVERDUE VESSEL REPORT - FOR COAST GUARD
══════════════════════════════════════════════════════════════
Generated: ${now.toLocaleString()}
Report ID: ${reportId}

VESSEL INFORMATION
───────────────────────────────────────────────────
Name:         ${plan.vesselName}
Type:         ${boat?.type || plan.vesselType || 'Not specified'}
Length:       ${boat?.length || 'Not specified'}
Color:        ${boat?.color || 'Not specified'}
Registration: ${boat?.registration || 'Not specified'}
Photo:        ${boat?.photoUrl || 'Not available'}

COMMUNICATION EQUIPMENT
───────────────────────────────────────────────────
${devicesList}

TRIP DETAILS
───────────────────────────────────────────────────
Departed From:    ${plan.departure}
                  ${departureCoords}
Destination:      ${plan.destination}
                  ${destinationCoords}
Expected Return:  ${expectedReturn}
Route Notes:      ${plan.route || 'None provided'}

FUEL & WATER SUSTAINABILITY
───────────────────────────────────────────────────
Fuel at Departure:   ${tankLog?.fuel != null ? `${tankLog.fuel}%` : 'Not logged'}${fuelGallons != null ? ` (~${fuelGallons} gallons of ${boat?.fuelCapacityGallons} gal capacity)` : ''}
Water at Departure:  ${tankLog?.water != null ? `${tankLog.water}%` : 'Not logged'}${waterGallons != null ? ` (~${waterGallons} gallons of ${boat?.waterCapacityGallons} gal capacity)` : ''}
Levels Logged:       ${tankLog ? new Date(tankLog.timestamp).toLocaleString() : 'N/A'}

PERSONS ON BOARD (${plan.crew.length})
───────────────────────────────────────────────────
${crewList || 'No crew information available'}

EMERGENCY CONTACTS
───────────────────────────────────────────────────
PRIMARY:    ${primaryContact?.name || 'Not specified'}
            Phone: ${primaryContact?.phone || 'N/A'}

SECONDARY:  ${secondaryContact?.name || 'Not specified'}
            Phone: ${secondaryContact?.phone || 'N/A'}
            
Escalation: Contact secondary if primary unreachable after ${plan.escalationWaitMinutes || 30} min

CURRENT STATUS
───────────────────────────────────────────────────
Last Check-In:     ${plan.lastCheckIn ? new Date(plan.lastCheckIn).toLocaleString() : 'None'}
Check-In Deadline: ${deadline.toLocaleString()}
Grace Period:      ${plan.gracePeriod} minutes
OVERDUE BY:        ${overdueHours > 0 ? `${overdueHours} hours ` : ''}${overdueMinutes} minutes

══════════════════════════════════════════════════════════════
         END OF REPORT - GENERATED BY FLOAT PLAN APP
══════════════════════════════════════════════════════════════
`.trim()
}

/**
 * Format a phone number for display
 */
export function formatPhoneForReport(phone: string): string {
  // Simple formatting - can be enhanced
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`
  }
  return phone
}

/**
 * Calculate estimated fuel remaining based on trip duration
 * This is a rough estimate - actual consumption varies widely
 */
export function estimateFuelRemaining(
  startPercentage: number,
  capacityGallons: number,
  hoursElapsed: number,
  consumptionGPH: number = 5 // Default assumption for moderate cruising
): { percentage: number; gallons: number } {
  const startGallons = (startPercentage / 100) * capacityGallons
  const usedGallons = hoursElapsed * consumptionGPH
  const remainingGallons = Math.max(0, startGallons - usedGallons)
  const remainingPercentage = (remainingGallons / capacityGallons) * 100
  
  return {
    percentage: Math.round(remainingPercentage),
    gallons: Math.round(remainingGallons)
  }
}
