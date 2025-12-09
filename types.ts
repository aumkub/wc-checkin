export interface Attendee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  ticketType: string;
  checkedIn: boolean;
  checkInTime?: string; // ISO string
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
}
