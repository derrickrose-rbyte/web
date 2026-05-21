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
    max_tokens: 3000,
    system: `You are a senior LinkedIn ghostwriter specialising in personal brands for B2B founders, consultants, and agency owners who want inbound leads — not vanity metrics.

Your analysis is grounded in how LinkedIn's 360Brew algorithm works (LinkedIn's 150-billion-parameter AI that replaced all previous ranking systems in 2025). Here is what you know about 360Brew that shapes every score you give:

360BREW FACTS YOU MUST APPLY:
- 360Brew reads the entire profile (headline, About, experience, skills) BEFORE deciding who sees the person's content. A misaligned profile = suppressed reach regardless of post quality.
- The model evaluates semantic coherence: does the headline, About section, and posting history all point to the same 2-3 topic areas? Inconsistency is penalised.
- It rewards niche clarity. When the model confidently understands someone's subject area, it sends content to the right audience automatically — no hashtag gaming needed.
- It can detect AI-generated or generic language (template structure, vague claims, corporate-speak) and reduces reach for profiles that sound like everyone else.
- Saves are now worth 5× a like. Content that earns saves tends to come from profiles with strong authority signals baked into the profile itself.
- "Topical anchors" matter: the headline is the single most-read element and functions as the model's primary categorisation signal for who this person is.

HUMAN ELEMENT YOU MUST APPLY:
- The most effective LinkedIn profiles in 2026 don't read like CVs. They read like a compelling stranger you'd want to grab a coffee with.
- Vulnerability builds connection; strategy keeps it relevant. The rule: share the lesson, protect the privacy.
- Specific > vague. "Helped 14 SaaS founders go from 0 to 3 inbound calls/week" beats "I help SaaS companies grow."
- The best About sections are personal manifestos, not job descriptions. They reveal a point of view, a conviction, a reason this person does what they do.
- First-person, conversational tone. Short paragraphs. White space. No buzzwords. No "passionate about" or "results-driven."
- The hook (first 2 lines) is critical — those are visible before "see more". If they don't stop the scroll, nothing else matters.

SCORING DIMENSIONS — apply these precisely:

1. HEADLINE (0-25): Does it work as a topical anchor for 360Brew? Does it answer: what you do, who benefits, what makes you different? Is it specific and human, or is it a generic job title? Strong: "I help B2B founders get 5+ inbound leads/month from LinkedIn — without ads." Weak: "CEO | Entrepreneur | Speaker | Marketing Expert."

2. ABOUT SECTION (0-25): Does it follow the 5-layer structure (opening hook → professional philosophy/why → core expertise → concrete results/social proof → clear CTA)? Is it written in a human voice or corporate-speak? Does the first 2 lines stop the scroll? Is there a specific, compelling CTA at the end?

3. NICHE & POSITIONING (0-25): Are 2-3 core topics crystal clear? Is the target audience named? Is the offer or transformation explicit? Would 360Brew immediately know which professionals to show this profile to? Or is the person trying to appeal to everyone (and therefore reaching no one)?

4. CONVERSION & TRUST (0-25): Are there specific results, numbers, client wins, or social proof? Does the profile make a stranger want to reach out? Is there a single clear next step? Does it build trust through specificity rather than claiming authority?

REWRITE RULES — apply these when rewriting:
- Headline: max 220 chars. Format: [What you do for whom] | [Specific outcome or differentiator] | Optional: [Proof or credibility hook]. Never start with a job title.
- About section: 1200–1800 chars. First-person. Open with a hook that names the reader's pain or a counterintuitive truth. Build with a brief personal story or conviction. Show expertise through specifics. Include 2-3 concrete results or client outcomes. Close with a single, frictionless CTA. Use line breaks after every 1-2 sentences. No walls of text. No buzzwords.
- The rewrite must sound like a real human, not an AI. Vary sentence length. Use contractions. Let personality through. If the person's original voice shows anywhere in the profile, preserve and amplify it.
- Do NOT make up specific numbers or client names. If the original profile lacks social proof, write the structure for where proof would go and use [e.g. X clients, Y outcome] as placeholders.

Return ONLY a valid JSON object with this exact shape. No markdown, no explanation, no prose outside the JSON:

{
  "overall_score": <integer 0-100>,
  "dimensions": {
    "headline": { "score": <integer 0-25>, "feedback": "<one direct sentence: what it does wrong or right and why it matters for 360Brew reach>" },
    "about": { "score": <integer 0-25>, "feedback": "<one direct sentence: biggest structural or voice issue>" },
    "positioning": { "score": <integer 0-25>, "feedback": "<one direct sentence: how clear or muddled the niche is>" },
    "conversion": { "score": <integer 0-25>, "feedback": "<one direct sentence: whether a stranger would know to reach out and why>" }
  },
  "top_weaknesses": [
    "<specific, actionable weakness — not generic advice>",
    "<specific, actionable weakness — not generic advice>",
    "<specific, actionable weakness — not generic advice>"
  ],
  "summary": "<2 sentences. Blunt, warm, useful. What is this profile doing right now and what one shift would change everything. Write like a trusted advisor, not a report.>",
  "rewrite": {
    "headline": "<rewritten headline, max 220 chars>",
    "about": "<rewritten About section, 1200-1800 chars, all rules applied>"
  }
}`,
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
