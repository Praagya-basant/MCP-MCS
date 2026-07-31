import JSZip from 'jszip';

function resolveRelativePath(baseDir, target) {
  const parts = baseDir.replace(/\/$/, '').split('/');
  target.split('/').forEach((seg) => {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  });
  return parts.join('/');
}

function extensionFromPath(path) {
  const match = path.match(/\.(png|jpe?g|gif|bmp)$/i);
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
}

/**
 * Extracts every image embedded in the first worksheet of an .xlsx file
 * (an .xlsx is a zip of XML parts — `xl/worksheets/_rels/sheet1.xml.rels`
 * points at the sheet's drawing part, `xl/drawings/drawingN.xml` anchors
 * each picture to a 0-indexed row via `<xdr:from><xdr:row>`, and
 * `xl/drawings/_rels/drawingN.xml.rels` maps that picture's `r:embed`
 * relationship id to the actual file under `xl/media/`), keyed by
 * data-row index (0 = the first row after the header, matching how
 * UploadSamplesModal indexes `sheetRows.slice(1)`) — since a drawing's
 * `<xdr:row>` is 0-indexed against the whole sheet including the header
 * row, `dataRowIndex = xdrRow - 1`.
 *
 * Returns a Map<number, { blob: Blob, extension: string }>, empty if the
 * workbook has no worksheet drawing at all (plain files with no images
 * are the common case, not an error).
 */
export async function extractSpreadsheetImages(file) {
  const results = new Map();

  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return results;
  }

  const sheetRelsFile = zip.file('xl/worksheets/_rels/sheet1.xml.rels');
  if (!sheetRelsFile) return results;

  const sheetRelsXml = await sheetRelsFile.async('string');
  const drawingRelMatch = sheetRelsXml.match(/<Relationship[^>]*Type="[^"]*\/drawing"[^>]*Target="([^"]+)"/);
  if (!drawingRelMatch) return results;

  const drawingPath = resolveRelativePath('xl/worksheets/', drawingRelMatch[1]);
  const drawingFile = zip.file(drawingPath);
  if (!drawingFile) return results;

  const drawingDir = drawingPath.slice(0, drawingPath.lastIndexOf('/'));
  const drawingName = drawingPath.slice(drawingPath.lastIndexOf('/') + 1);
  const drawingRelsFile = zip.file(`${drawingDir}/_rels/${drawingName}.rels`);

  const embedMap = new Map();
  if (drawingRelsFile) {
    const drawingRelsXml = await drawingRelsFile.async('string');
    const relRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
    let relMatch;
    while ((relMatch = relRegex.exec(drawingRelsXml))) {
      embedMap.set(relMatch[1], resolveRelativePath(`${drawingDir}/`, relMatch[2]));
    }
  }
  if (embedMap.size === 0) return results;

  const drawingXml = await drawingFile.async('string');
  const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
  let anchorMatch;
  while ((anchorMatch = anchorRegex.exec(drawingXml))) {
    const block = anchorMatch[1];
    const rowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    const embedMatch = block.match(/r:embed="(rId\d+)"/);
    if (!rowMatch || !embedMatch) continue;

    const mediaPath = embedMap.get(embedMatch[1]);
    if (!mediaPath) continue;
    const mediaFile = zip.file(mediaPath);
    if (!mediaFile) continue;

    const dataRowIndex = parseInt(rowMatch[1], 10) - 1;
    if (dataRowIndex < 0) continue;

    const blob = await mediaFile.async('blob');
    results.set(dataRowIndex, { blob, extension: extensionFromPath(mediaPath) });
  }

  return results;
}
