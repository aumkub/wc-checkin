import { GoogleGenAI } from "@google/genai";
import { Attendee } from "../types";

const getSystemInstruction = () => `
  You are an Event Analysis AI. 
  Your role is to analyze event attendance data and provide a concise, professional summary for the event organizer.
  Focus on:
  1. Overall attendance percentage.
  2. Breakdown by ticket type (which groups are arriving fastest).
  3. Any notable observations (e.g., "VIPs are running late").
  Keep the tone helpful and operational.
`;

export const generateDailyReport = async (attendees: Attendee[]) => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key missing");
    return "API Key not configured. Please check your environment variables.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Prepare data summary for the prompt
  const total = attendees.length;
  const checkedIn = attendees.filter(a => a.checkedIn).length;
  const byType = attendees.reduce((acc, curr) => {
    if (!acc[curr.ticketType]) acc[curr.ticketType] = { total: 0, checkedIn: 0 };
    acc[curr.ticketType].total++;
    if (curr.checkedIn) acc[curr.ticketType].checkedIn++;
    return acc;
  }, {} as Record<string, { total: number; checkedIn: number }>);

  const dataString = JSON.stringify({
    totalAttendees: total,
    totalCheckedIn: checkedIn,
    breakdownByType: byType
  }, null, 2);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Here is the current event data:\n${dataString}\n\nPlease provide a short status report (max 3 sentences) and 3 bullet points of key insights.`,
      config: {
        systemInstruction: getSystemInstruction(),
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate AI report at this time.";
  }
};
