import ExcelJS from 'exceljs';
import { AuditLog } from '../services/auditService';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const translateStatus = (status: any, log: AuditLog) => {
    if (typeof status !== 'string') return JSON.stringify(status);
    const map: Record<string, string> = {
        'base': 'בסיס', 
        'home': 'בית', 
        'full': 'בסיס (יום שלם)', 
        'arrival': 'הגעה', 
        'departure': 'יציאה',
        'unavailable': 'אילוץ', 
        'leave_shamp': 'חופשה בשמפ', 
        'gimel': "ג'", 
        'absent': 'נפקד',
        'organization_days': 'ימי התארגנות', 
        'not_in_shamp': 'לא בשמ"פ'
    };
    
    if (map[status]) return map[status];
    
    let translated = status;
    const hType = log.metadata?.homeStatusType;
    if (hType && (status === 'home' || status === 'בית')) return `בית (${map[hType] || hType})`;
    
    translated = translated.replace(/\(([^)]+)\)/g, (match: string, p1: string) => {
        const key = p1.trim();
        return `(${map[key] || key})`;
    });
    
    Object.entries(map).forEach(([key, val]) => {
        if (translated === key) translated = val;
    });
    
    return translated;
};

const getReadableLogAction = (log: AuditLog): string => {
    if (log.entity_type === 'shift') {
        const personName = log.metadata?.personName || 'חייל';
        const action = log.event_type;
        const taskName = log.metadata?.taskName || 'משמרת';
        const timeStr = (log.metadata?.startTime && log.metadata?.endTime) 
            ? ` (${format(new Date(log.metadata.startTime), 'dd/MM HH:mm')} - ${format(new Date(log.metadata.endTime), 'HH:mm')})`
            : '';

        if (action === 'ASSIGN') {
            return `שיבץ את ${personName} למשימה: ${taskName}${timeStr}`;
        } else if (action === 'UNASSIGN') {
            return `הסיר את ${personName} מהמשימה: ${taskName}${timeStr}`;
        }
        return log.action_description || log.event_type;
    }

    if (log.entity_type === 'attendance' || log.entity_type === 'person') {
        const soldierName = log.entity_name || log.metadata?.entity_name || 'חייל';
        const oldVal = translateStatus(log.before_data, log);
        const newVal = translateStatus(log.after_data, log);
        const dateStr = log.metadata?.date ? ` בתאריך ${log.metadata.date}` : '';
        
        if (log.before_data !== undefined && log.after_data !== undefined) {
            return `שינה את הסטטוס של ${soldierName} מ-"${oldVal}" ל-"${newVal}"${dateStr}`;
        }
    }

    return log.action_description || log.event_type;
};

export const generateAuditExcel = async (logs: AuditLog[], fileName: string = 'לוח_שיבוצים_היסטוריה.xlsx') => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Miuim System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('היסטוריית שיבוצים', { views: [{ rightToLeft: true }] });

    // Define columns
    worksheet.columns = [
        { header: 'תאריך ושעה', key: 'timestamp', width: 20 },
        { header: 'מבצע הפעולה', key: 'user', width: 25 },
        { header: 'פעולה שבוצעה', key: 'action', width: 60 },
        { header: 'סוג ישות', key: 'entityType', width: 15 },
    ];

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' } // Blue-600
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 30;

    // Add data
    logs.forEach(log => {
        worksheet.addRow({
            timestamp: format(new Date(log.created_at), 'HH:mm dd/MM/yyyy', { locale: he }),
            user: log.user_name || log.user_email || 'מערכת',
            action: getReadableLogAction(log),
            entityType: log.entity_type === 'shift' ? 'שיבוץ' : (log.entity_type === 'attendance' ? 'נוכחות' : log.entity_type),
        });
    });

    // Auto-filter and freeze top row
    worksheet.autoFilter = 'A1:D1';
    worksheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];

    // Styling rows
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        
        row.height = 25;
        row.eachCell((cell) => {
            cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
            cell.font = { size: 11, color: { argb: 'FF1E293B' } };
        });

        // Alternating row colors
        if (rowNumber % 2 === 0) {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF8FAFC' }
            };
        }
    });

    // Write to buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
};
