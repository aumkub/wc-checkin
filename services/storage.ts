import { Attendee, TicketConfig } from '../types';

const STORAGE_KEY_ATTENDEES = 'eventflow_attendees';
const STORAGE_KEY_CONFIG = 'eventflow_config';

// Helper to simulate network delay for realistic UI feedback
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getAttendees = async (): Promise<Attendee[]> => {
  await delay(300); 
  const stored = localStorage.getItem(STORAGE_KEY_ATTENDEES);
  return stored ? JSON.parse(stored) : [];
};

export const getAttendeesByEmail = async (email: string): Promise<Attendee[]> => {
  await delay(300);
  const attendees = await getAttendees();
  return attendees.filter(a => a.email.toLowerCase().trim() === email.toLowerCase().trim());
};

export const upsertAttendees = async (newAttendees: Attendee[]) => {
  await delay(500);
  const current = await getAttendees();
  const currentMap = new Map(current.map(a => [a.id, a]));

  for (const att of newAttendees) {
    // If ID exists, we keep the existing check-in status unless explicitly overridden (which CSV usually doesn't have)
    const existing = currentMap.get(att.id);
    if (existing) {
      currentMap.set(att.id, { 
        ...att, 
        checkedIn: existing.checkedIn, 
        checkInTime: existing.checkInTime 
      });
    } else {
      currentMap.set(att.id, att);
    }
  }

  const updatedList = Array.from(currentMap.values());
  localStorage.setItem(STORAGE_KEY_ATTENDEES, JSON.stringify(updatedList));
  return true;
};

export const checkInAttendee = async (id: string, checkedIn: boolean, checkInTime?: string) => {
  await delay(200);
  const attendees = await getAttendees();
  const index = attendees.findIndex(a => a.id === id);
  
  if (index !== -1) {
    attendees[index].checkedIn = checkedIn;
    attendees[index].checkInTime = checkInTime;
    localStorage.setItem(STORAGE_KEY_ATTENDEES, JSON.stringify(attendees));
    return true;
  }
  return false;
};

// Batch check-in for user view (checks in all valid tickets for the email)
export const checkInUserTickets = async (email: string, validTypes: string[]) => {
  await delay(400);
  const attendees = await getAttendees();
  let updated = false;
  const now = new Date().toISOString();

  const newAttendees = attendees.map(a => {
    // Check if email matches AND ticket type is valid AND not already checked in
    if (
      a.email.toLowerCase().trim() === email.toLowerCase().trim() && 
      validTypes.includes(a.ticketType) &&
      !a.checkedIn
    ) {
      updated = true;
      return { ...a, checkedIn: true, checkInTime: now };
    }
    return a;
  });

  if (updated) {
    localStorage.setItem(STORAGE_KEY_ATTENDEES, JSON.stringify(newAttendees));
  }
  // Return true to indicate process completed (even if no records needed updating)
  return true;
};

export const getTicketConfig = async (): Promise<TicketConfig> => {
  await delay(200);
  const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
  
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Fallback: If no config exists, enable all existing types from attendees
  const attendees = await getAttendees();
  const allTypes = Array.from(new Set(attendees.map(a => a.ticketType)));
  return { activeTypes: allTypes };
};

export const saveTicketConfig = async (config: TicketConfig) => {
  await delay(200);
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  return true;
};

export const parseCSV = (csvText: string): Attendee[] => {
  const lines = csvText.trim().split('\n');
  
  const attendees: Attendee[] = [];
  
  const splitCSVLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i];
    if (!currentLine) continue;
    const values = splitCSVLine(currentLine);
    
    // Default format: ID, Ticket Type, First Name, Last Name, Email
    if (values.length >= 5) {
      attendees.push({
        id: values[0] || Math.random().toString(36).substr(2, 9),
        ticketType: values[1].replace(/^"|"$/g, ''), 
        firstName: values[2],
        lastName: values[3],
        email: values[4],
        checkedIn: false
      });
    }
  }
  return attendees;
};