export interface Attendee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  ticketType: string;
  checkedIn: boolean;
  checkInTime?: string; // ISO string
  purchaseDate?: string; // Purchase date
  country?: string; // Where you live or where you're from
  severeAllergy?: string; // Severe allergy answer
  accessibilityNeeds?: string; // Accessibility needs answer
  firstTimeAttending?: string; // First Time Attending answer
  notes?: string; // Notes field
}

export interface TicketConfig {
  activeTypes: string[];
}

export type ViewMode = 'user' | 'admin';

export interface CheckInResult {
  success: boolean;
  message: string;
  attendee?: Attendee;
  checkedInTypes?: string[];
  alreadyCheckedIn?: boolean;
}
