type PdfOptions = {
  filename: string;
  title: string;
  lines: string[];
};

function sanitizePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function splitIntoPages(lines: string[], pageSize: number) {
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }

  return pages.length > 0 ? pages : [["Sin datos para exportar."]];
}

function toAsciiBytes(value: string) {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }

  return bytes;
}

export function downloadPdfReport({ filename, title, lines }: PdfOptions) {
  const sanitizedTitle = sanitizePdfText(title);
  const preparedLines = splitIntoPages(lines.map(sanitizePdfText), 38);
  const objects: string[] = [];
  const pageRefs: string[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let nextObjectId = 4;

  preparedLines.forEach((pageLines, pageIndex) => {
    const pageObjectId = nextObjectId;
    const contentObjectId = nextObjectId + 1;
    nextObjectId += 2;
    pageRefs.push(`${pageObjectId} 0 R`);

    const content = [
      "BT",
      "/F1 16 Tf",
      "48 760 Td",
      `(${sanitizedTitle}) Tj`,
      "0 -24 Td",
      "/F1 10 Tf",
      ...pageLines.flatMap((line, index) => {
        if (index === 0) {
          return [`(${line}) Tj`];
        }

        return ["0 -15 Td", `(${line}) Tj`];
      }),
      "0 -24 Td",
      `(${sanitizePdfText(`Pagina ${pageIndex + 1} de ${preparedLines.length}`)}) Tj`,
      "ET"
    ].join("\n");

    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 1; index < objects.length; index += 1) {
    if (!objects[index]) continue;
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < objects.length; index += 1) {
    const offset = offsets[index] ?? 0;
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([toAsciiBytes(pdf)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
