import ExcelJS from 'exceljs';
import { Person, Team, Absence, TeamRotation, HourlyBlockage, OrganizationSettings } from '@/types';
import { getEffectiveAvailability, getAttendanceDisplayInfo } from './attendanceUtils';

/**
 * Shared logic to generate a formatted Attendance Report Excel file
 */

/**
 * Core logic to populate a worksheet with the attendance report format
 */
export const populateAttendanceSheet = ({
    worksheet,
    people,
    teams,
    absences = [],
    rotations = [],
    blockages = [],
    startDate,
    endDate
}: {
    worksheet: ExcelJS.Worksheet;
    people: Person[];
    teams: Team[];
    absences?: Absence[];
    rotations?: TeamRotation[];
    blockages?: HourlyBlockage[];
    startDate: Date;
    endDate: Date;
}) => {
    // Calculate days difference
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Home status type labels
    const homeStatusLabels: Record<string, string> = {
        'leave_shamp': 'חופשה בשמפ',
        'gimel': 'ג\'',
        'absent': 'נפקד',
        'organization_days': 'ימי התארגנות',
        'not_in_shamp': 'לא בשמ"פ'
    };

    // Build headers: Name, Team, then all dates
    const headers = ['שם מלא (מ.א.)', 'צוות'];
    const dayDates: Date[] = [];
    for (let i = 0; i < diffDays; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        dayDates.push(date);
        const dayName = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][date.getDay()];
        headers.push(`${date.getDate()}.${date.getMonth() + 1}\n${dayName}`);
    }

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 30;
    headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Sort people by team and name
    const sortedPeople = [...people].sort((a, b) => {
        const teamA = teams.find(t => t.id === a.teamId)?.name || '';
        const teamB = teams.find(t => t.id === b.teamId)?.name || '';
        const teamComp = teamA.localeCompare(teamB, 'he');
        if (teamComp !== 0) return teamComp;
        return a.name.localeCompare(b.name, 'he');
    });

    // Add rows for each person
    sortedPeople.forEach(person => {
        const teamName = teams.find(t => t.id === person.teamId)?.name || 'ללא צוות';
        
        // Try to find personal ID in custom fields or root property
        const pid = (person as any).personalId || (person as any).personal_id || person.customFields?.['personal_id'] || person.customFields?.['personalId'];
        const nameDisplay = `${person.name || 'ללא שם'}${pid ? ` (${pid})` : ''}`;

        const rowData: any[] = [nameDisplay, teamName];

        // Add cell data for each day
        dayDates.forEach((date, i) => {
            const dateKey = date.toLocaleDateString('en-CA');
            // Use unified display info
            const displayInfo = getAttendanceDisplayInfo(person, date, rotations, absences, blockages);
            const avail = displayInfo.availability;

            const relevantAbsence = absences.find(a =>
                a.person_id === person.id &&
                dateKey >= a.start_date &&
                dateKey <= a.end_date
            );

            let cellText = displayInfo.label;
            
            // Append formatted times if needed, matching the logic in displayInfo construction
            // Note: displayInfo.label usually already contains times if they are relevant, 
            // but for Excel we might want to ensure formatting.
            // Actually, displayInfo.label is "Arrival 10:00" or similar, so it's good.

            if (relevantAbsence) {
                const statusDesc = relevantAbsence.status === 'approved' ? '✓' :
                    (relevantAbsence.status === 'pending' ? '⏳' : '✗');
                
                // Add absence details. 
                // If it's home, we just append.
                // If it's arrival/departure, we ALSO append.
                const absenceText = `\n${statusDesc} ${relevantAbsence.reason || 'בקשה'}`;
                
                if (displayInfo.displayStatus === 'home') {
                    cellText += absenceText;
                } else if (displayInfo.displayStatus === 'arrival' || displayInfo.displayStatus === 'departure') {
                    // For arrival/departure, we might overwrite cellText below, so we need to handle it there or append now.
                    // Let's store it to append after standard text.
                }
            }
            
            // Format newlines for excel if the label is long or composite
            cellText = cellText.replace(' ', '\n');
            
            // Explicit overrides if needed to match old format exactly:
            if (displayInfo.displayStatus === 'arrival') {
                cellText = `הגעה\n${avail.startHour || '00:00'}`;
            } else if (displayInfo.displayStatus === 'departure') {
                cellText = `יציאה\n${avail.endHour || '23:59'}`;
            } else if (displayInfo.displayStatus === 'missing_departure') {
                cellText = displayInfo.isArrival ? `הגעה\n(חסר יציאה)` : `בסיס\n(חסר יציאה)`;
            }

            // Append absence info for arrival/departure if it exists
            if (relevantAbsence && (displayInfo.displayStatus === 'arrival' || displayInfo.displayStatus === 'departure')) {
                 const statusDesc = relevantAbsence.status === 'approved' ? '✓' : (relevantAbsence.status === 'pending' ? '⏳' : '✗');
                 cellText += `\n${statusDesc} ${relevantAbsence.reason || 'בקשה'}`;
            }
 
            rowData.push(cellText);
        });

        const row = worksheet.addRow(rowData);
        row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        row.height = 40;

        // Style cells
        dayDates.forEach((date, i) => {
            const cell = row.getCell(i + 3); // +1 index, +2 for name/team
            const displayInfo = getAttendanceDisplayInfo(person, date, rotations, absences, blockages);

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.font = { size: 9 };

            if (displayInfo.displayStatus === 'home') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                cell.font = { color: { argb: 'FF991B1B' }, size: 9 };
            } else if (displayInfo.isBase) {
                if (displayInfo.displayStatus === 'missing_departure') {
                    // Special warning style
                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Base green
                     cell.font = { color: { argb: 'FFDC2626' }, bold: true, size: 9 }; // Red text
                } else if (displayInfo.displayStatus === 'arrival') {
                    // Arrival -> Green (Requested by user)
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Green-100/200
                    cell.font = { color: { argb: 'FF166534' }, size: 9 }; // Green-800
                } else if (displayInfo.displayStatus === 'departure') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Amber
                    cell.font = { color: { argb: 'FF92400E' }, size: 9 };
                } else {
                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                     cell.font = { color: { argb: 'FF065F46' }, size: 9 };
                }
            } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
                cell.font = { color: { argb: 'FF6B7280' }, size: 9 };
            }
        });
    });

    // Set column widths
    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 15;
    for (let i = 0; i < diffDays; i++) {
        worksheet.getColumn(i + 3).width = 12;
    }
};

/**
 * Shared logic to generate and download a formatted Attendance Report Excel file
 */
export const generateAttendanceExcel = async ({
    people,
    teams,
    absences = [],
    rotations = [],
    blockages = [],
    startDate,
    endDate,
    fileName = 'attendance_report.xlsx'
}: {
    people: Person[];
    teams: Team[];
    absences?: Absence[];
    rotations?: TeamRotation[];
    blockages?: HourlyBlockage[];
    startDate: Date;
    endDate: Date;
    fileName?: string;
    organizationSettings?: OrganizationSettings | null;
}) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Miuim System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('דוח נוכחות', { views: [{ rightToLeft: true }] });

    populateAttendanceSheet({
        worksheet,
        people,
        teams,
        absences,
        rotations,
        blockages,
        startDate,
        endDate
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

