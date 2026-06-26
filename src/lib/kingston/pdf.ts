type PdfOptions = {
  filename: string;
  title: string;
  lines: string[];
};

type PdfImage = {
  data: string;
  width: number;
  height: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 48;
const CONTENT_TOP = 598;
const CONTENT_BOTTOM = 104;
const LINE_HEIGHT = 15;
const REPORT_LINES_PER_PAGE = Math.floor((CONTENT_TOP - CONTENT_BOTTOM) / LINE_HEIGHT);

function sanitizePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapPdfText(value: string, maxLength = 92) {
  const cleanValue = sanitizePdfText(value);

  if (!cleanValue) {
    return [""];
  }

  const words = cleanValue.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxLength) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word.length > maxLength ? word.slice(0, maxLength) : word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function prepareReportPages(lines: string[]) {
  const normalizedLines = lines.length > 0 ? lines : ["Sin datos para exportar."];
  const wrappedLines = normalizedLines.flatMap((line) => wrapPdfText(line));
  const pages: string[][] = [];

  for (let index = 0; index < wrappedLines.length; index += REPORT_LINES_PER_PAGE) {
    pages.push(wrappedLines.slice(index, index + REPORT_LINES_PER_PAGE));
  }

  return pages.length > 0 ? pages : [["Sin datos para exportar."]];
}

function toPdfBytes(value: string) {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }

  return bytes;
}

function getAssetUrl(path: string) {
  return `${window.location.origin}${path}`;
}

function readImage(image: HTMLImageElement) {
  return new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No pude cargar el recurso de membrete."));
  });
}

async function loadImageAsJpeg(path: string): Promise<PdfImage | null> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const loaded = readImage(image);
    image.src = getAssetUrl(path);
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext("2d");
    if (!context || canvas.width === 0 || canvas.height === 0) {
      return null;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const base64 = dataUrl.split(",")[1];

    if (!base64) {
      return null;
    }

    return {
      data: atob(base64),
      width: canvas.width,
      height: canvas.height
    };
  } catch {
    return null;
  }
}

async function loadLetterheadImages() {
  const [anyx, kingston] = await Promise.all([
    loadImageAsJpeg("/report-letterhead-anyx.png"),
    loadImageAsJpeg("/report-letterhead-kingston.jpg")
  ]);

  return { anyx, kingston };
}

function drawImageCommand(name: string, x: number, y: number, width: number, height: number) {
  return `q\n${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/${name} Do\nQ`;
}

function drawTextCommand(options: {
  text: string;
  x: number;
  y: number;
  font?: "F1" | "F2";
  size?: number;
  color?: string;
}) {
  const font = options.font ?? "F1";
  const size = options.size ?? 10;
  const color = options.color ?? "0.08 0.11 0.18";

  return [
    "BT",
    `/${font} ${size} Tf`,
    `${color} rg`,
    `${options.x} ${options.y} Td`,
    `(${sanitizePdfText(options.text)}) Tj`,
    "ET"
  ].join("\n");
}

function buildPageContent(args: {
  title: string;
  pageLines: string[];
  pageIndex: number;
  pageCount: number;
  imageNames: {
    anyx?: string;
    kingston?: string;
  };
}) {
  const generatedAt = new Date().toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const headerCommands: string[] = [];

  if (args.imageNames.anyx) {
    headerCommands.push(drawImageCommand(args.imageNames.anyx, MARGIN_X, 698, 178, 58));
  } else {
    headerCommands.push(drawTextCommand({ text: "ANYX", x: MARGIN_X, y: 728, font: "F2", size: 22, color: "0.22 0.42 0.16" }));
  }

  if (args.imageNames.kingston) {
    headerCommands.push(drawImageCommand(args.imageNames.kingston, 496, 704, 64, 64));
  } else {
    headerCommands.push(drawTextCommand({ text: "Kingston", x: 492, y: 732, font: "F2", size: 18, color: "0.12 0.12 0.12" }));
  }

  const bodyCommands = args.pageLines.flatMap((line, index) => {
    const y = CONTENT_TOP - index * LINE_HEIGHT;
    const isSection = line.endsWith(":");

    if (!line) {
      return [];
    }

    return [
      drawTextCommand({
        text: line,
        x: MARGIN_X,
        y,
        font: isSection ? "F2" : "F1",
        size: isSection ? 10.5 : 9.5,
        color: isSection ? "0.02 0.13 0.28" : "0.12 0.16 0.24"
      })
    ];
  });

  return [
    "1 1 1 rg",
    "0 0 612 792 re",
    "f",
    ...headerCommands,
    "0.72 0.78 0.86 RG",
    "1.2 w",
    "48 682 m 564 682 l",
    "S",
    drawTextCommand({
      text: "ANYX SRL | Gestion interna de RMA Kingston",
      x: MARGIN_X,
      y: 662,
      font: "F2",
      size: 9,
      color: "0.34 0.42 0.54"
    }),
    drawTextCommand({
      text: args.title,
      x: MARGIN_X,
      y: 632,
      font: "F2",
      size: 20,
      color: "0.04 0.07 0.13"
    }),
    drawTextCommand({
      text: `Emitido: ${generatedAt}`,
      x: 416,
      y: 635,
      font: "F1",
      size: 8.5,
      color: "0.36 0.43 0.53"
    }),
    "0.87 0.91 0.96 RG",
    "0.8 w",
    "48 616 m 564 616 l",
    "S",
    ...bodyCommands,
    "0.72 0.78 0.86 RG",
    "0.8 w",
    "48 76 m 564 76 l",
    "S",
    drawTextCommand({
      text: "ANYX SRL - Av. San Isidro Labrador 4471 - CABA (C1429ADF) - comercial2@anyx.com.ar - Tel: +54-11-4815-4614",
      x: MARGIN_X,
      y: 55,
      size: 7.6,
      color: "0.32 0.38 0.48"
    }),
    drawTextCommand({
      text: `Pagina ${args.pageIndex + 1} de ${args.pageCount}`,
      x: 490,
      y: 36,
      size: 8,
      color: "0.32 0.38 0.48"
    })
  ].join("\n");
}

function buildImageObject(image: PdfImage) {
  return [
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`,
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>`,
    "stream",
    image.data,
    "endstream"
  ].join("\n");
}

function downloadBlob(data: Uint8Array, filename: string) {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPdfReport({ filename, title, lines }: PdfOptions) {
  const preparedLines = prepareReportPages(lines);
  const objects: string[] = [];
  const pageRefs: string[] = [];
  const { anyx, kingston } = await loadLetterheadImages();

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let nextObjectId = 5;
  const xObjects: string[] = [];
  const imageNames: { anyx?: string; kingston?: string } = {};

  if (anyx) {
    const objectId = nextObjectId;
    nextObjectId += 1;
    imageNames.anyx = "ImAnyx";
    xObjects.push(`/ImAnyx ${objectId} 0 R`);
    objects[objectId] = buildImageObject(anyx);
  }

  if (kingston) {
    const objectId = nextObjectId;
    nextObjectId += 1;
    imageNames.kingston = "ImKingston";
    xObjects.push(`/ImKingston ${objectId} 0 R`);
    objects[objectId] = buildImageObject(kingston);
  }

  preparedLines.forEach((pageLines, pageIndex) => {
    const pageObjectId = nextObjectId;
    const contentObjectId = nextObjectId + 1;
    nextObjectId += 2;
    pageRefs.push(`${pageObjectId} 0 R`);

    const content = buildPageContent({
      title,
      pageLines,
      pageIndex,
      pageCount: preparedLines.length,
      imageNames
    });
    const xObjectResource = xObjects.length > 0 ? `/XObject << ${xObjects.join(" ")} >>` : "";

    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xObjectResource} >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 1; index < objects.length; index += 1) {
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

  downloadBlob(toPdfBytes(pdf), filename);
}
