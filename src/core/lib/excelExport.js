import ExcelJS from 'exceljs';

const FONT_NAME = 'Calibri';
const HEADER_FILL = 'FF1A1A1A';
const HEADER_FONT = 'FFFFFFFF';
const ALT_ROW_FILL = 'FFF5F5F4';
const BORDER_COLOR = 'FFE0E0DE';
const MUTED_FONT = 'FF6B6B68';

const thinBorder = { style: 'thin', color: { argb: BORDER_COLOR } };

async function loadLogoBuffer() {
  try {
    const res = await fetch('/logo-black.png');
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function autoFitColumns(worksheet, colCount, headerRowIndex) {
  for (let c = 1; c <= colCount; c += 1) {
    let maxLen = 10;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < headerRowIndex) return;
      const val = row.getCell(c).value;
      const len = val == null ? 0 : String(val).length;
      if (len > maxLen) maxLen = len;
    });
    worksheet.getColumn(c).width = Math.min(maxLen + 2, 42);
  }
}

/**
 * Builds and downloads a styled .xlsx workbook from one or more named
 * sheets — logo top-left, report title/subtitle/date-generated header
 * block, dark header row, alternating row shading, thin borders,
 * auto-fit columns, print-ready A4 landscape.
 * @param {{ sheetName: string, rows: object[] }[]} sheets
 * @param {string} fileName
 * @param {{ title?: string, subtitle?: string }} meta
 */
export async function exportToExcel(sheets, fileName, meta = {}) {
  const { title = 'BASANT SSM', subtitle = '' } = meta;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BASANT SSM';
  workbook.created = new Date();

  const logoBuffer = await loadLogoBuffer();
  const logoImageId = logoBuffer ? workbook.addImage({ buffer: logoBuffer, extension: 'png' }) : null;

  const dateGenerated = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  sheets.forEach(({ sheetName, rows }) => {
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const colCount = Math.max(columns.length, 1);
    const worksheet = workbook.addWorksheet((sheetName || 'Sheet').slice(0, 31), {
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
      views: [{ state: 'frozen', ySplit: 6 }],
    });

    worksheet.getColumn(1).width = 16;
    if (logoImageId) {
      worksheet.addImage(logoImageId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 120, height: 34 } });
    }
    worksheet.getRow(1).height = 20;
    worksheet.getRow(2).height = 18;
    worksheet.getRow(3).height = 16;
    worksheet.getRow(4).height = 8;

    worksheet.mergeCells(1, 2, 1, colCount + 1);
    const titleCell = worksheet.getCell(1, 2);
    titleCell.value = title;
    titleCell.font = { name: FONT_NAME, size: 14, bold: true };

    if (subtitle) {
      worksheet.mergeCells(2, 2, 2, colCount + 1);
      const subtitleCell = worksheet.getCell(2, 2);
      subtitleCell.value = subtitle;
      subtitleCell.font = { name: FONT_NAME, size: 12 };
    }

    worksheet.mergeCells(3, 2, 3, colCount + 1);
    const dateCell = worksheet.getCell(3, 2);
    dateCell.value = `Generated: ${dateGenerated}`;
    dateCell.font = { name: FONT_NAME, size: 10, color: { argb: MUTED_FONT } };

    if (!rows.length) {
      const emptyCell = worksheet.getCell(6, 1);
      emptyCell.value = 'No data for this sheet.';
      emptyCell.font = { name: FONT_NAME, size: 12, italic: true, color: { argb: MUTED_FONT } };
      return;
    }

    const headerRow = worksheet.getRow(5);
    columns.forEach((key, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = key;
      cell.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: HEADER_FONT } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
      cell.alignment = { vertical: 'middle' };
    });
    headerRow.height = 22;
    worksheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: colCount } };

    rows.forEach((row, rowIndex) => {
      const excelRow = worksheet.getRow(6 + rowIndex);
      columns.forEach((key, colIndex) => {
        const cell = excelRow.getCell(colIndex + 1);
        cell.value = row[key] ?? '';
        cell.font = { name: FONT_NAME, size: 12 };
        cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
        if (rowIndex % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_FILL } };
        }
      });
    });

    worksheet.pageSetup.printTitlesRow = '5:5';
    autoFitColumns(worksheet, colCount, 5);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
