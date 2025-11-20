import { GoogleGenAI } from "@google/genai";
import { Person, Shift, TaskTemplate, Role } from "../types";

const apiKey = process.env.API_KEY || '';

// Helper to safe-guard against missing API key
const getAI = () => {
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateAssignmentExplanation = async (
  shift: Shift,
  assignedPerson: Person,
  task: TaskTemplate,
  allPeople: Person[],
  roles: Role[]
): Promise<string> => {
  const ai = getAI();
  if (!ai) return "מפתח API לא מוגדר. לא ניתן לייצר הסבר.";

  const personRoles = assignedPerson.roleIds.map(rid => roles.find(r => r.id === rid)?.name).join(', ');

  const prompt = `
    אתה קצין מבצעים חכם במערכת שיבוץ.
    הסבר בקצרה (עד 2 משפטים בעברית) מדוע ${assignedPerson.name} שובץ למשימה "${task.name}" בתאריך ${new Date(shift.startTime).toLocaleString('he-IL')}.
    
    נתונים:
    - תפקידים נדרשים למשימה: ${task.requiredRoleIds.map(rid => roles.find(r => r.id === rid)?.name).join(', ')}
    - תפקידי/הכשרות האדם: ${personRoles}
    - העדפות האדם: ${assignedPerson.preferences.preferNight ? 'מעדיף לילה' : 'רגיל'}, ${assignedPerson.preferences.avoidWeekends ? 'נמנע מסופ"ש' : ''}
    - קושי המשימה: ${task.difficulty}/5
    
    התייחס להתאמה בתפקידים ולזמינות.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "לא התקבל הסבר.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "אירעה שגיאה ביצירת ההסבר.";
  }
};

export const analyzeScheduleHealth = async (
  shifts: Shift[],
  people: Person[],
  tasks: TaskTemplate[]
): Promise<string> => {
    const ai = getAI();
    if (!ai) return "מפתח API לא מוגדר.";

    const dataSummary = {
        totalShifts: shifts.length,
        unassigned: shifts.filter(s => s.assignedPersonIds.length < (tasks.find(t => t.id === s.taskId)?.requiredPeople || 1)).length,
        peopleCount: people.length
    };

    const prompt = `
      נתח את בריאות השיבוץ הנוכחי על סמך הנתונים הבאים:
      ${JSON.stringify(dataSummary)}
      
      תן 3 נקודות לשיפור או לשימור בעברית.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "לא התקבל ניתוח.";
    } catch (e) {
        return "שגיאה בניתוח.";
    }
}