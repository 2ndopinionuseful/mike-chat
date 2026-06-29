import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, TableOfContents, BorderStyle } from "docx";

function parseReport(text: string): { title: string; sections: { heading: string; content: string[] }[] } {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const sections: { heading: string; content: string[] }[] = [];
  let currentSection: { heading: string; content: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith("SECTION") || line.startsWith("**SECTION")) {
      if (currentSection) sections.push(currentSection);
      const heading = line.replace(/\*\*/g, "").replace(/^-+$/, "").trim();
      currentSection = { heading, content: [] };
    } else if (line.startsWith("ASSUMPTIONS") || line.startsWith("**ASSUMPTIONS")) {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: "ASSUMPTIONS", content: [] };
    } else if (line === "---" || line.match(/^-{3,}$/)) {
      continue;
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }
  if (currentSection) sections.push(currentSection);

  return { title: "HVAC Second Opinion Report", sections };
}

function buildDocChildren(text: string) {
  const { sections } = parseReport(text);
  const children: Paragraph[] = [];

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

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Contents", bold: true, size: 28 })],
      spacing: { before: 200, after: 120 },
    })
  );

  children.push(new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-2",
  }));

  children.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 400 } }));

  for (const section of sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: section.heading.replace(/\*\*/g, ""), bold: true, size: 28, color: "1a1a1a" })],
        spacing: { before: 360, after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "c8a96e", space: 4 } },
      })
    );

    for (const line of section.content) {
      const clean = line.replace(/\*\*/g, "");

      if (clean.startsWith("- ") || clean.startsWith("* ")) {
        children.push(
          new Paragraph({
            numbering: { reference: "bullets", level: 0 },
            children: [new TextRun({ text: clean.substring(2), size: 22 })],
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
      } else if (clean.length > 0) {
        const parts = clean.split(/(\*\*[^*]+\*\*)/g);
        const runs = parts.map(part => {
          const m = part.match(/^\*\*(.+)\*\*$/);
          return m ? new TextRun({ text: m[1], bold: true, size: 22 }) : new TextRun({ text: part, size: 22 });
        });
        children.push(
          new Paragraph({
            children: runs,
            spacing: { after: 100 },
          })
        );
      }
    }
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

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": "attachment; filename=hvac-second-opinion.docx",
      },
    });
  } catch (error) {
    console.error("DOCX generation error:", error);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }
}
