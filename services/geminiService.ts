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

/**
 * Analyze schedule health without requiring AI/API
 * Provides simple deterministic feedback based on coverage statistics
 */
export const analyzeScheduleHealth = async (
  shifts: Shift[],
  people: Person[],
  tasks: TaskTemplate[]
): Promise<string> => {
  // Simple deterministic analysis without AI
  const totalShifts = shifts.length;
  const unassignedCount = shifts.filter(s => {
    const task = tasks.find(t => t.id === s.taskId);
    const required = task?.requiredPeople || 1;
    return s.assignedPersonIds.length < required;
  }).length;

  const fullyAssignedCount = totalShifts - unassignedCount;
  const coveragePercent = totalShifts > 0 ? Math.round((fullyAssignedCount / totalShifts) * 100) : 0;

  let feedback = `✅ **שיבוץ הושלם!**\n\n`;
  feedback += `📊 **סיכום:**\n`;
  feedback += `- סה"כ משמרות: ${totalShifts}\n`;
  feedback += `- משמרות מאוישות: ${fullyAssignedCount} (${coveragePercent}%)\n`;
  feedback += `- משמרות חסרות: ${unassignedCount}\n\n`;

  if (coveragePercent === 100) {
    feedback += `🎉 מצוין! כל המשמרות מאוישות במלואן.`;
  } else if (coveragePercent >= 80) {
    feedback += `👍 טוב! רוב המשמרות מאוישות. נותרו ${unassignedCount} משמרות לאיוש ידני.`;
  } else if (coveragePercent >= 50) {
    feedback += `⚠️ חלקי. יש צורך באיוש ידני של ${unassignedCount} משמרות נוספות.`;
  } else {
    feedback += `❌ נמוך. רק ${fullyAssignedCount} משמרות אוישו. בדוק זמינות כוח אדם ותפקידים נדרשים.`;
  }

  return feedback;
};