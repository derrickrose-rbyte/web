import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

interface Dimension {
  score: number;
  feedback: string;
}

interface Analysis {
  overall_score: number;
  dimensions: {
    headline: Dimension;
    about: Dimension;
    positioning: Dimension;
    conversion: Dimension;
  };
  top_weaknesses: string[];
  summary: string;
  rewrite: {
    headline: string;
    about: string;
  };
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic import avoids pdf-parse loading its test files at module init
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function analyzeProfile(profileText: string): Promise<Analysis> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `You are an expert LinkedIn ghostwriter who helps B2B personal brands attract inbound leads.
Analyze the LinkedIn profile text and return ONLY a valid JSON object with this exact shape:

{
  "overall_score": <integer 0-100>,
  "dimensions": {
    "headline": { "score": <integer 0-25>, "feedback": "<one concise sentence>" },
    "about": { "score": <integer 0-25>, "feedback": "<one concise sentence>" },
    "positioning": { "score": <integer 0-25>, "feedback": "<one concise sentence>" },
    "conversion": { "score": <integer 0-25>, "feedback": "<one concise sentence>" }
  },
  "top_weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "summary": "<2-sentence plain-English verdict a busy founder would understand>",
  "rewrite": {
    "headline": "<improved headline, max 220 chars, punchy value proposition>",
    "about": "<improved About section, 1200-1800 chars, first person, conversational. Open with a hook. Build credibility. Close with a clear CTA.>"
  }
}

Return only the JSON. No markdown, no explanation.`,
    messages: [
      {
        role: "user",
        content: `Here is the LinkedIn profile to analyze:\n\n${profileText}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  return JSON.parse(raw) as Analysis;
}

function buildEmailHtml(email: string, analysis: Analysis): string {
  const { overall_score, dimensions, top_weaknesses, rewrite } = analysis;
  const grade =
    overall_score >= 80
      ? "Strong"
      : overall_score >= 60
      ? "Average"
      : overall_score >= 40
      ? "Weak"
      : "Critical";

  const dimRows = (
    [
      ["Headline", dimensions.headline],
      ["About Section", dimensions.about],
      ["Positioning", dimensions.positioning],
      ["Conversion", dimensions.conversion],
    ] as [string, Dimension][]
  )
    .map(
      ([label, d]) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EBEBEA;font-size:14px;">${label}</td>
        <td style="padding:10px 0;border-bottom:1px solid #EBEBEA;font-size:14px;font-weight:700;text-align:right;">${d.score}/25</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:4px 0 12px;font-size:12px;color:#6B6B66;">${d.feedback}</td>
      </tr>`
    )
    .join("");

  const weaknessList = top_weaknesses
    .map((w) => `<li style="margin-bottom:8px;font-size:14px;">${w}</li>`)
    .join("");

  const aboutFormatted = rewrite.about.replace(/\n/g, "<br>");

  const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL || "#";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;color:#0A0A0A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F3;padding:40px 20px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;">

        <!-- Header -->
        <tr>
          <td style="padding:40px 48px 32px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 16px;">LinkedIn Profile Audit</p>
            <h1 style="font-size:32px;font-weight:900;line-height:1.1;margin:0;">Your score:<br>${overall_score}<span style="font-size:18px;font-weight:400;color:#8A8A85;">/100</span></h1>
            <span style="display:inline-block;margin-top:16px;border:1px solid #0A0A0A;padding:4px 12px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${grade}</span>
          </td>
        </tr>

        <!-- Breakdown -->
        <tr>
          <td style="padding:32px 48px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 20px;">Score breakdown</p>
            <table width="100%" cellpadding="0" cellspacing="0">${dimRows}</table>
          </td>
        </tr>

        <!-- Weaknesses -->
        <tr>
          <td style="padding:32px 48px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 16px;">Top 3 things to fix</p>
            <ul style="margin:0;padding-left:20px;">${weaknessList}</ul>
          </td>
        </tr>

        <!-- Rewritten headline -->
        <tr>
          <td style="padding:32px 48px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 12px;">Rewritten headline</p>
            <p style="font-size:15px;font-weight:700;line-height:1.4;margin:0;background:#F5F5F3;padding:16px;">${rewrite.headline}</p>
          </td>
        </tr>

        <!-- Rewritten About -->
        <tr>
          <td style="padding:32px 48px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 12px;">Rewritten About section</p>
            <div style="font-size:14px;line-height:1.7;background:#F5F5F3;padding:20px;">${aboutFormatted}</div>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:40px 48px;text-align:center;">
            <p style="font-size:15px;font-weight:600;margin:0 0 8px;">Want us to implement this for you?</p>
            <p style="font-size:13px;color:#6B6B66;margin:0 0 24px;">We write your LinkedIn content every week so you can focus on closing.</p>
            <a href="${bookingUrl}" style="display:inline-block;background:#0A0A0A;color:#FFFFFF;text-decoration:none;padding:14px 32px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Book a free call →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 48px;border-top:1px solid #EBEBEA;font-size:11px;color:#8A8A85;">
            Sent to ${email} · Krist Pjetraj LinkedIn Ghostwriting
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const email = form.get("email") as string | null;
    const pdfFile = form.get("pdf") as File | null;
    const pastedText = form.get("text") as string | null;

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    let profileText = "";

    if (pdfFile) {
      const buffer = Buffer.from(await pdfFile.arrayBuffer());
      profileText = await extractTextFromPdf(buffer);
    } else if (pastedText?.trim()) {
      profileText = pastedText.trim();
    } else {
      return NextResponse.json(
        { error: "Please upload a PDF or paste your profile text." },
        { status: 400 }
      );
    }

    if (profileText.length < 50) {
      return NextResponse.json(
        { error: "Profile text is too short to analyse." },
        { status: 400 }
      );
    }

    const analysis = await analyzeProfile(profileText);

    const html = buildEmailHtml(email, analysis);

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "audit@example.com",
      to: email,
      subject: `Your LinkedIn Profile Score: ${analysis.overall_score}/100`,
      html,
    });

    return NextResponse.json({
      score: analysis.overall_score,
      summary: analysis.summary,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
