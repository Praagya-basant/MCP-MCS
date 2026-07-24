import * as XLSX from 'xlsx';

/**
 * Builds and downloads an .xlsx workbook from one or more named sheets.
 * @param {{ sheetName: string, rows: object[] }[]} sheets
 * @param {string} fileName
 */
export function exportToExcel(sheets, fileName) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ sheetName, rows }) => {
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  });

  XLSX.writeFile(workbook, fileName);
}
