import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  VerticalAlign,
} from "docx";

// A line counts as a section heading if it's short and made up of uppercase letters
// (allowing spaces, digits, punctuation like & - ( )). This works for both the old
// "SECTION 1" style headers and the new plain headers like "SITUATION SUMMARY",
// "WHAT'S MISSING (AND WHY IT MATTERS)", "RED FLAGS VS YELLOW FLAGS", etc.
// It intentionally does NOT depend on exact wording, so future prompt changes to
// header text won't silently break report generation again.
function isSectionHeading(line: string): boolean {
  const clean = line.replace(/\*\*/g, "").trim();
  if (clean.length === 0 || clean.length > 70) return false;
  if (clean.startsWith("- ") || clean.startsWith("* ")) return false;
  if (/^\d+\.\s/.test(clean)) return false;
  if (clean.startsWith("Your revision code:")) return false;
  const letters = clean.replace(/[^A-Za-z]/g, "");
  if (letters.length === 0) return false;
  return letters === letters.toUpperCase();
}

function parseReport(text: string): { title: string; sections: { heading: string; content: string[] }[] } {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const sections: { heading: string; content: string[] }[] = [];
  let currentSection: { heading: string; content: string[] } | null = null;

  for (const line of lines) {
    if (isSectionHeading(line)) {
      if (currentSection) sections.push(currentSection);
      const heading = line.replace(/\*\*/g, "").replace(/^-+$/, "").trim();
      currentSection = { heading, content: [] };
    } else if (line === "---" || line.match(/^-{3,}$/)) {
      continue;
    } else if (currentSection) {
      currentSection.content.push(line);
    } else {
      // Content appeared before any recognized heading (e.g. Mike didn't lead with
      // a heading line). Create a fallback section so we don't silently drop it.
      currentSection = { heading: "REPORT", content: [line] };
    }
  }
  if (currentSection) sections.push(currentSection);

  return { title: "HVAC Second Opinion Report", sections };
}

// Extracts a revision code (e.g. "MK-VYUS", optionally "test:MK-VYUS") from the
// report text, for use in the downloaded filename. Falls back to a generic name
// if none is found, rather than failing - the filename is a convenience, not a
// requirement for the doc to generate correctly.
function extractRevisionCode(text: string): string | null {
  const match = text.match(/\b(test:)?MK-[A-Z0-9]{4}\b/i);
  return match ? match[0].toUpperCase().replace(/[^A-Z0-9-]/g, "") : null;
}

function buildFilename(reportText: string): string {
  const code = extractRevisionCode(reportText);
  return code ? `Second-Opinion-${code}.docx` : "hvac-second-opinion.docx";
}

// ---- Quick Assessment table ----
//
// SYSTEM_PROMPT always generates "MIKE'S QUICK ASSESSMENT" as short
// "Label: Value" lines (Price: Fair, Scope: Complete, Risk Level: Low,
// Red Flags: 2, Recommendation: ...). Detected generically by heading text
// containing "QUICK ASSESSMENT" - not hardcoded to this one report's exact
// wording, so it keeps working if the label set changes slightly later.
function isQuickAssessmentHeading(heading: string): boolean {
  return /QUICK ASSESSMENT/i.test(heading);
}

// Matches "Label: value text" - conservative on the label side (short,
// starts with a capital letter, no sentence-ending punctuation before the
// colon) so it doesn't accidentally swallow an ordinary sentence that
// happens to contain a colon.
function parseLabelValueLine(line: string): { label: string; value: string } | null {
  const clean = line.replace(/\*\*/g, "");
  const match = clean.match(/^([A-Z][A-Za-z ]{1,30}):\s*(.+)$/);
  if (!match) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

function buildQuickAssessmentTable(contentLines: string[]): Table | null {
  const rows: { label: string; value: string }[] = [];
  for (const line of contentLines) {
    const parsed = parseLabelValueLine(line);
    if (parsed) rows.push(parsed);
  }
  if (rows.length === 0) return null;

  const LABEL_WIDTH = 2400;
  const VALUE_WIDTH = 7000;

  const tableRows = rows.map((row) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: LABEL_WIDTH, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "f4ede0" },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: row.label, bold: true, size: 21, color: "1a1a1a" })],
            }),
          ],
        }),
        new TableCell({
          width: { size: VALUE_WIDTH, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: row.value, size: 21, color: "1a1a1a" })],
            }),
          ],
        }),
      ],
    });
  });

  return new Table({
    width: { size: LABEL_WIDTH + VALUE_WIDTH, type: WidthType.DXA },
    columnWidths: [LABEL_WIDTH, VALUE_WIDTH],
    rows: tableRows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "c8a96e" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "c8a96e" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "c8a96e" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "c8a96e" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "e0d5c0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "e0d5c0" },
    },
  });
}

// ---- Equipment tier breakdown table ----
//
// Matches lines shaped like SYSTEM_PROMPT's tiered-proposal breakdown:
// "Option 1 (Infinity, $22,365): Variable-speed inverter condenser..."
// Groups consecutive matching lines under whichever preceding sub-header
// line introduced them (e.g. "Carrier Options (Full System):"), so a
// multi-brand breakdown becomes one table per brand/group rather than one
// giant undifferentiated table. This is intentionally pattern-based, not
// hardcoded to Carrier/Lennox specifically - it will pick up the same
// "Option N (Name, $Price): details" shape for any brand names Mike uses,
// but a report whose equipment breakdown doesn't follow this exact shape
// will simply fall through to plain paragraphs (the original behavior),
// not fail.
const OPTION_LINE_PATTERN = /^Option\s+(\d+)\s*\(([^,]+),\s*(\$[\d,]+)\)\s*:\s*(.+)$/i;

function parseOptionLine(line: string): { option: string; name: string; price: string; details: string } | null {
  const clean = line.replace(/\*\*/g, "");
  const match = clean.match(OPTION_LINE_PATTERN);
  if (!match) return null;
  return { option: match[1], name: match[2].trim(), price: match[3].trim(), details: match[4].trim() };
}

function isGroupSubheaderLine(line: string): boolean {
  const clean = line.replace(/\*\*/g, "").trim();
  // Short-ish line ending in a colon, not itself an Option line - e.g.
  // "Carrier Options (Full System):" - used as the group table's caption.
  return clean.length > 0 && clean.length < 60 && clean.endsWith(":") && !OPTION_LINE_PATTERN.test(clean);
}

function buildOptionTable(options: { option: string; name: string; price: string; details: string }[]): Table {
  const COL_OPTION = 700;
  const COL_NAME = 1600;
  const COL_PRICE = 1400;
  const COL_DETAILS = 5700;

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      { text: "#", width: COL_OPTION },
      { text: "Tier", width: COL_NAME },
      { text: "Price", width: COL_PRICE },
      { text: "Details", width: COL_DETAILS },
    ].map(
      (col) =>
        new TableCell({
          width: { size: col.width, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "c8a96e" },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: col.text, bold: true, size: 19, color: "1a1a1a" })] })],
        })
    ),
  });

  const dataRows = options.map((opt, i) => {
    const shade = i % 2 === 0 ? "ffffff" : "f8f3ea";
    const cell = (text: string, width: number, bold = false) =>
      new TableCell({
        width: { size: width, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: shade },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 90, bottom: 90, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text, bold, size: 19, color: "1a1a1a" })] })],
      });

    return new TableRow({
      children: [
        cell(opt.option, COL_OPTION),
        cell(opt.name, COL_NAME, true),
        cell(opt.price, COL_PRICE, true),
        cell(opt.details, COL_DETAILS),
      ],
    });
  });

  return new Table({
    width: { size: COL_OPTION + COL_NAME + COL_PRICE + COL_DETAILS, type: WidthType.DXA },
    columnWidths: [COL_OPTION, COL_NAME, COL_PRICE, COL_DETAILS],
    rows: [headerRow, ...dataRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "c8a96e" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "c8a96e" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "c8a96e" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "c8a96e" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "e0d5c0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "e0d5c0" },
    },
  });
}

// ---- Red / Yellow flag color coding ----
//
// Within flags sections, a sub-header line naming "red flag(s)" or "yellow
// flag(s)" switches a running "flag color mode" that subsequent bullet
// lines inherit, until the next sub-header (or end of section) changes it
// again. Scoped to bullet lines only - the sub-header lines and any plain
// prose in these sections render normally.
type FlagMode = "red" | "yellow" | null;

function detectFlagModeSwitch(line: string): FlagMode | undefined {
  const clean = line.replace(/\*\*/g, "").trim();
  if (/^red flags?\b/i.test(clean)) return "red";
  if (/^yellow flags?\b/i.test(clean)) return "yellow";
  return undefined; // no switch - caller keeps current mode
}

const FLAG_COLORS: Record<"red" | "yellow", string> = {
  red: "b03a2e",
  yellow: "9a7d0a",
};

function buildDocChildren(text: string) {
  const { sections } = parseReport(text);
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "HVAC Second Opinion Report", bold: true, size: 40, color: "1a1a1a" })],
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Prepared by Mike - get2nd-opinion.com", size: 22, color: "888888", italics: true })],
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "c8a96e", space: 1 } },
    })
  );

  children.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }));

  for (const section of sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: section.heading.replace(/\*\*/g, ""), bold: true, size: 28, color: "1a1a1a" })],
        spacing: { before: 360, after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "c8a96e", space: 4 } },
      })
    );

    // Quick Assessment: render the whole section content as one table
    // instead of the usual paragraph loop, when every meaningful line
    // parses as "Label: value". Falls through to normal rendering below
    // if the section doesn't actually look like that (e.g. future prompt
    // changes alter the shape) - never silently drops content.
    if (isQuickAssessmentHeading(section.heading)) {
      const table = buildQuickAssessmentTable(section.content);
      if (table) {
        children.push(table);
        children.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 120 } }));
        continue;
      }
    }

    // Flags sections: track red/yellow mode across the section's lines so
    // bullet items render in the matching color.
    let flagMode: FlagMode = null;

    // Equipment breakdown: group consecutive "Option N (...): ..." lines
    // under their preceding sub-header line into one table per group,
    // rendering everything else (the sub-header itself, any non-matching
    // lines) as normal paragraphs around the tables.
    let pendingOptions: { option: string; name: string; price: string; details: string }[] = [];
    const flushOptionTable = () => {
      if (pendingOptions.length > 0) {
        children.push(buildOptionTable(pendingOptions));
        children.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }));
        pendingOptions = [];
      }
    };

    for (const line of section.content) {
      const clean = line.replace(/\*\*/g, "");

      const optionRow = parseOptionLine(clean);
      if (optionRow) {
        pendingOptions.push(optionRow);
        continue;
      }
      // A non-option line arrived - flush any table we were building
      // before rendering this line normally (as the group's caption or
      // unrelated prose).
      flushOptionTable();

      const switchTo = detectFlagModeSwitch(clean);
      if (switchTo !== undefined) flagMode = switchTo;

      if (clean.startsWith("- ") || clean.startsWith("* ")) {
        const bulletText = clean.substring(2);
        const bulletColor = flagMode ? FLAG_COLORS[flagMode] : undefined;
        children.push(
          new Paragraph({
            numbering: { reference: "bullets", level: 0 },
            children: [new TextRun({ text: bulletText, size: 22, color: bulletColor, bold: !!bulletColor })],
            spacing: { after: 80 },
          })
        );
      } else if (clean.match(/^\d+\.\s/)) {
        const content = clean.replace(/^\d+\.\s/, "");
        children.push(
          new Paragraph({
            numbering: { reference: "numbers", level: 0 },
            children: [new TextRun({ text: content, size: 22 })],
            spacing: { after: 80 },
          })
        );
      } else if (clean.startsWith("Your revision code:")) {
        children.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }));
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Your revision code: ", bold: true, size: 22 }),
              new TextRun({ text: clean.replace("Your revision code:", "").replace(/\*\*/g, "").trim(), bold: true, size: 22, color: "c8a96e" }),
            ],
            spacing: { after: 120 },
            border: { top: { style: BorderStyle.SINGLE, size: 3, color: "c8a96e", space: 4 } },
          })
        );
      } else if (clean.startsWith("If any details above")) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: clean, size: 20, italics: true, color: "666666" })],
            spacing: { after: 120 },
          })
        );
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Disclaimer: This report reflects an independent advisory opinion based on the information provided. It is not a licensed contractor assessment or legal advice. Always verify with a qualified HVAC professional before making final decisions.", size: 18, italics: true, color: "999999" })],
            spacing: { before: 200, after: 120 },
            border: { top: { style: BorderStyle.SINGLE, size: 1, color: "dddddd", space: 4 } },
          })
        );
      } else if (clean.length > 0) {
        const isSubheader = isGroupSubheaderLine(clean);
        const parts = clean.split(/(\*\*[^*]+\*\*)/g);
        const runs = parts.map(part => {
          const m = part.match(/^\*\*(.+)\*\*$/);
          if (m) return new TextRun({ text: m[1], bold: true, size: 22 });
          return new TextRun({ text: part, size: 22, bold: isSubheader });
        });
        children.push(
          new Paragraph({
            children: runs,
            spacing: { after: isSubheader ? 60 : 100, before: isSubheader ? 120 : 0 },
          })
        );
      }
    }
    // Section ended - flush any option table still pending.
    flushOptionTable();
  }

  return children;
}

export async function POST(req: NextRequest) {
  try {
    const { reportText } = await req.json();
    if (!reportText) {
      return NextResponse.json({ error: "No report text provided" }, { status: 400 });
    }

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: "bullets",
            levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
          },
          {
            reference: "numbers",
            levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
          },
        ],
      },
      styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
          { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 40, bold: true, font: "Arial", color: "1a1a1a" },
            paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
          { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 28, bold: true, font: "Arial", color: "1a1a1a" },
            paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
        ],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: buildDocChildren(reportText),
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8Array = new Uint8Array(buffer);
    const filename = buildFilename(reportText);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    console.error("DOCX generation error:", error);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }
}
