export interface Attendee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  ticketType: string;
  checkedIn: boolean;
  checkInTime?: string; // ISO string
  purchaseDate?: string; // Purchase date
  tShirtSize?: string; // T-Shirt size
  country?: string; // Where you live or where you're from
  severeAllergy?: string; // Severe allergy answer
  accessibilityNeeds?: string; // Accessibility needs answer
  firstTimeAttending?: string; // First Time Attending answer
  notes?: string; // Notes field
  swagReceived?: boolean; // Whether the user has received swag
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
