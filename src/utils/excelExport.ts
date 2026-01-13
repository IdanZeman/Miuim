
import ExcelJS from 'exceljs';
import { PersonLocation } from '../types';

/**
 * Generates and downloads an Excel file for the Location Report.
 * Supports both standard LocationReport and BattalionLocationReport format.
 * 
 * @param data Array of PersonLocation objects
 * @param filename Name of the file to download (without extension)
 * @param isBattalionReport Whether to include organization columns
 */
export const generateLocationReportExcel = async (
    data: PersonLocation[],
    filename: string,
    isBattalionReport: boolean = false
) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(isBattalionReport ? 'דוח מיקום גדודי' : 'דוח מיקום');
    const statusMap: Record<string, string> = { mission: 'במשימה', base: 'בבסיס', home: 'בבית' };

    // Define columns based on report type
    if (isBattalionReport) {
        worksheet.columns = [
            { header: 'פלוגה', key: 'org', width: 20 },
            { header: 'שם', key: 'name', width: 20 },
            { header: 'סטטוס', key: 'status', width: 15 },
            { header: 'פירוט', key: 'details', width: 30 },
            { header: 'שעות', key: 'time', width: 20 },
        ];
    } else {
        worksheet.columns = [
            { header: 'שם', key: 'name', width: 20 },
            { header: 'צוות', key: 'team', width: 15 },
            { header: 'סטטוס', key: 'status', width: 15 },
            { header: 'פירוט', key: 'details', width: 30 },
            { header: 'שעות', key: 'time', width: 20 },
        ];
    }

    // Format data rows
    const rows = data.map(r => {
        const baseData = {
            name: r.person.name,
            status: statusMap[r.status],
            details: r.details,
            time: r.time
        };

        if (isBattalionReport) {
            return {
                org: r.orgName || '',
                ...baseData
            };
        } else {
            return {
                team: r.orgName || (r.person.teamId || ''), // Reusing orgName field for team name if needed, but clearer to handle separately
                ...baseData
            };
        }
    });
    
    // Note: for standard report we need team name. 
    // The shared interface usually has orgName for battalion report. 
    // In standard report, `r.person.teamId` is available but we might want the resolved name.
    // To make this utility strictly pure, we should rely on the caller to potentially map data if needed, or better:
    // We adjust the mapping logic above. 
    // Actually, let's make the mapped rows slightly more generic or let the components handle mapping?
    // No, the goal is to reduce duplication. 
    // In `LocationReport.tsx`, we have resolved team names. 
    // Let's rely on `r.orgName` passing the team name for standard reports if we can, OR simply check `person.teamId` if `orgName` is missing.
    // However, `LocationReport` was calculating team names.
    // Let's refine the utility to better handle the difference.
    
    // RE-THINKING UTILITY MAPPING:
    const excelRows = data.map(r => {
        const row: any = {
            name: r.person.name,
            status: statusMap[r.status],
            details: r.details,
            time: r.time
        };

        if (isBattalionReport) {
            row.org = r.orgName || '';
        } else {
            // For standard report, we ideally want the resolved team name. 
            // `r.orgName` is usually undefined in standard report unless we pass it.
            // But `LocationReport` uses `getTeamName(r.person.teamId)`. 
            // We can add an optional `teamName` property to `PersonLocation` or pass it in `r.orgName` for the utility.
            // Let's assume the caller hydrates `orgName` with the Team Name for standard reports to avoid passing extra maps.
            row.team = r.orgName || r.person.teamId || '';
        }
        return row;
    });

    worksheet.addRows(excelRows);

    // Add Table structure
    if (excelRows.length > 0) {
        const tableColumns = isBattalionReport 
            ? [
                { name: 'פלוגה', filterButton: true },
                { name: 'שם', filterButton: true },
                { name: 'סטטוס', filterButton: true },
                { name: 'פירוט', filterButton: true },
                { name: 'שעות', filterButton: true },
              ]
            : [
                { name: 'שם', filterButton: true },
                { name: 'צוות', filterButton: true },
                { name: 'סטטוס', filterButton: true },
                { name: 'פירוט', filterButton: true },
                { name: 'שעות', filterButton: true },
              ];

        // Need to create array of arrays for the rows data based on columns order
        const tableRows = excelRows.map(row => {
            if (isBattalionReport) return [row.org, row.name, row.status, row.details, row.time];
            return [row.name, row.team, row.status, row.details, row.time];
        });

        worksheet.addTable({
            name: 'LocationReportTable',
            ref: 'A1',
            headerRow: true,
            totalsRow: false,
            style: {
                theme: 'TableStyleMedium2',
                showRowStripes: true,
            },
            columns: tableColumns,
            rows: tableRows
        });
    }

    // Right-to-Left sheet view
    worksheet.views = [{ rightToLeft: true }];

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Save file
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
