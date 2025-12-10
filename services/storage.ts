import { Attendee, TicketConfig } from '../types';
import { supabase } from './supabaseClient';

const TABLE_ATTENDEES = 'attendees';
const TABLE_TICKET_CONFIG = 'ticket_config';

const normalizeEmail = (email: string) => email.toLowerCase().trim();

export const getAttendees = async (): Promise<Attendee[]> => {
  const { data, error } = await supabase
    .from(TABLE_ATTENDEES)
    .select('*')
    .order('lastName', { ascending: true });

  if (error) {
    console.error('Supabase getAttendees error', error);
    return [];
  }

  return data ?? [];
};

export const getAttendeesByEmail = async (email: string): Promise<Attendee[]> => {
  const normalized = normalizeEmail(email);
  const { data, error } = await supabase
    .from(TABLE_ATTENDEES)
    .select('*')
    .eq('email', normalized);

  if (error) {
    console.error('Supabase getAttendeesByEmail error', error);
    return [];
  }

  return data ?? [];
};

export const upsertAttendees = async (newAttendees: Attendee[]) => {
  const sanitized = newAttendees.map(att => ({
    ...att,
    email: normalizeEmail(att.email),
  }));

  const { error } = await supabase
    .from(TABLE_ATTENDEES)
    .upsert(sanitized, { onConflict: 'id' });

  if (error) {
    console.error('Supabase upsertAttendees error', error);
    return false;
  }

  return true;
};

export const checkInAttendee = async (id: string, checkedIn: boolean, checkInTime?: string) => {
  const { error } = await supabase
    .from(TABLE_ATTENDEES)
    .update({ checkedIn, checkInTime })
    .eq('id', id);

  if (error) {
    console.error('Supabase checkInAttendee error', error);
    return false;
  }

  return true;
};

// Batch check-in for user view (checks in all valid tickets for the email)
export const checkInUserTickets = async (email: string, validTypes: string[]) => {
  const normalized = normalizeEmail(email);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from(TABLE_ATTENDEES)
    .update({ checkedIn: true, checkInTime: now })
    .eq('email', normalized)
    .in('ticketType', validTypes)
    .eq('checkedIn', false);

  if (error) {
    console.error('Supabase checkInUserTickets error', error);
    return false;
  }

  return true;
};

export const getTicketConfig = async (): Promise<TicketConfig> => {
  const { data, error } = await supabase
    .from(TABLE_TICKET_CONFIG)
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase getTicketConfig error', error);
  }

  if (data) {
    return { activeTypes: data.activeTypes || [] };
  }

  // Fallback: derive from attendee data if no config row exists yet
  const attendees = await getAttendees();
  const allTypes = Array.from(new Set(attendees.map(a => a.ticketType)));
  return { activeTypes: allTypes };
};

export const saveTicketConfig = async (config: TicketConfig) => {
  const { error } = await supabase
    .from(TABLE_TICKET_CONFIG)
    .upsert({ id: 1, activeTypes: config.activeTypes });

  if (error) {
    console.error('Supabase saveTicketConfig error', error);
    return false;
  }

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