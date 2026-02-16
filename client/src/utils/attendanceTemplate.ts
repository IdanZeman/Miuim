import ExcelJS from 'exceljs';

/**
 * Generates an Excel template for attendance import with dropdowns and examples.
 */
export const generateAttendanceImportTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Miuim System';
    workbook.created = new Date();

    // 1. Create the template worksheet
    const worksheet = workbook.addWorksheet('תבנית לייבוא', {
        views: [{ rightToLeft: true, showGridLines: true }],
        properties: { defaultColWidth: 15 }
    });

    // Determine target dates: Current month and the next month
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0); // End of next month

    // Header Row: Name, Team, Dates
    const headers = ['שם הלוחם (חובה)', 'צוות (מומלץ)'];
    const dateKeys: string[] = [];

    // Iterate through all days from startDate to endDate
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
        dateKeys.push(dateKey);
        const dayStr = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][d.getDay()];
        headers.push(`${d.getDate()}.${d.getMonth() + 1}\n(יום ${dayStr})`);
    }

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 35;
    headerRow.font = { bold: true, size: 11 };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    // Style headers
    headerRow.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Slate-200
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
    });

    // 2. Add Example Rows
    const examples = [
        ['ישראל ישראלי', 'צוות א', 'בסיס', '10:00 הגעה', 'יציאה 14:00', 'חופשה', 'ג'],
        ['משה כהן', 'צוות ב', 'v', 'נוכח', 'בית', 'גימלים', 'נפקד']
    ];

    examples.forEach(ex => {
        const row = worksheet.addRow(ex);
        row.font = { italic: true, color: { argb: 'FF64748B' } }; // Slate-500
        row.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // 3. Add Empty Rows with Data Validation
    const VALID_STATUSES = [
        'בסיס',
        'נוכח',
        'הגעה 10:00',
        'יציאה 14:00',
        'חופשה',
        'גימלים',
        'התארגנות',
        'נפקד',
        'לא בשמ"פ',
        'v',
        'x'
    ];

    // Add 50 empty rows
    for (let i = 0; i < 50; i++) {
        const row = worksheet.addRow([]);
        row.height = 25;
        // Add borders to first 50 columns or so
        for (let col = 1; col <= headers.length; col++) {
            const cell = row.getCell(col);
            cell.border = {
                top: { style: 'hair' },
                left: { style: 'thin' },
                bottom: { style: 'hair' },
                right: { style: 'thin' }
            };

            // Add Data Validation for date columns (starting from col 3)
            if (col >= 3) {
                cell.dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${VALID_STATUSES.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'ערך לא תקין',
                    error: 'אנא בחר ערך מהרשימה או הזן פורמט תקין (למשל: הגעה 09:00)'
                };
            }
        }
    }

    // 4. Create Instructions Sheet
    const infoSheet = workbook.addWorksheet('הסברים והנחיות', { views: [{ rightToLeft: true }] });
    infoSheet.getColumn(1).width = 30;
    infoSheet.getColumn(2).width = 80;

    const instructions = [
        ['נושא', 'הסבר'],
        ['שם הלוחם', 'חובה להזין שם כפי שמופיע במערכת. המערכת תנסה לבצע התאמה אוטומטית.'],
        ['צוות', 'עוזר למערכת להבדיל בין לוחמים עם שמות דומים.'],
        ['נוכחות (v / בסיס)', 'מסמן שהלוחם נמצא בבסיס יום שלם.'],
        ['הגעה / יציאה', 'ניתן להזין "הגעה HH:MM" או "יציאה HH:MM" כדי לסמן הגעה או יציאה בשעה ספציפית.'],
        ['חופשה (x / בית)', 'מסמן שהלוחם בבית (חופשת שמ"פ).'],
        ['גימלים', 'מסמן שהלוחם בגימלים.'],
        ['נפקד', 'מסמן שהלוחם נפקד.'],
        ['לא בשמ"פ', 'מסמן שהלוחם לא נמצא בשירות מילואים פעיל באותו יום.'],
    ];

    instructions.forEach((ins, idx) => {
        const row = infoSheet.addRow(ins);
        if (idx === 0) {
            row.font = { bold: true, size: 12 };
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        }
        row.alignment = { vertical: 'middle', wrapText: true };
        row.height = 30;
    });

    // 5. Finalize and Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_template_${today.getFullYear()}_${today.getMonth() + 1}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
};
