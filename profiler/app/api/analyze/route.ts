import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { logSubmission } from "@/lib/analytics";

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
    system: `You are a senior LinkedIn ghostwriter. You work with B2B founders, consultants, and agency owners who want real inbound leads, not vanity metrics.

Your analysis is grounded in how LinkedIn's 360Brew algorithm works. 360Brew is a 150-billion-parameter AI that replaced all of LinkedIn's old ranking systems in 2025. Here is what matters:

HOW 360BREW WORKS:
- It reads the full profile (headline, About, experience, skills) before deciding who sees someone's content. A weak or misaligned profile kills reach no matter how good the posts are.
- It looks for semantic coherence. Does the headline, About section, and content history all point to the same 2-3 topics? Inconsistency gets penalised.
- It rewards niche clarity. When it knows exactly what someone does, it sends their content to the right people automatically. No hashtag tricks needed.
- It flags generic, templated, or AI-sounding language and reduces distribution for profiles that sound like everyone else.
- Saves are worth 5x a like. Profiles with strong authority signals earn more saves.
- The headline is the primary categorisation signal. It's how the model decides who this person is.

WHAT MAKES A PROFILE ACTUALLY WORK:
- The best profiles in 2026 read like a person you'd want to grab a coffee with, not a polished corporate bio.
- Specific beats vague every time. "Helped 14 SaaS founders go from 0 to 3 inbound calls a week" says more than "I help SaaS companies grow."
- The strongest About sections are personal manifestos. They show a point of view, a conviction, a reason this person does what they do.
- The first two lines of the About are the only lines people see before clicking "see more." If those lines don't make them want more, nothing else matters.
- Write like you talk. Short sentences. Contractions. Paragraphs that breathe. No walls of text.
- Share real moments, not highlight reels. A quick honest story builds more trust than a list of credentials.

SCORING:

1. HEADLINE (0-25): Does it work as a topical anchor for 360Brew? Does it tell you what the person does, who they do it for, and what makes them worth following? Or is it a job title strung together with pipe characters? Strong example: "I help B2B founders get inbound leads from LinkedIn without running ads." Weak example: "CEO | Entrepreneur | Speaker | Marketing Expert."

2. ABOUT SECTION (0-25): Does it open with a hook that makes someone stop scrolling? Does it have structure: opening hook, personal conviction or story, core expertise, concrete results or social proof, clear CTA? Is it written like a person or like a press release?

3. NICHE AND POSITIONING (0-25): Are 2-3 core topics crystal clear? Is the target audience named? Is the transformation or offer explicit? Would 360Brew know exactly which professionals to show this person to? Or is the profile trying to speak to everyone?

4. CONVERSION AND TRUST (0-25): Are there specific results, numbers, client outcomes? Does a stranger reading this know what to do next? Does it build trust through specifics rather than by claiming authority?

REWRITE RULES:
- Headline: max 220 characters. Lead with what you do for whom and the outcome. Never open with a job title.
- About section: 1200 to 1800 characters. First person. Paragraphs, not bullet lists. Open with a hook that names a real problem or makes a counterintuitive point. Build with a short personal story or conviction. Show expertise through specifics. Include 2-3 concrete results or outcomes. Close with one clear, low-friction CTA.
- The rewrite must sound like a real person wrote it. Vary sentence length. Use contractions. Let imperfections stay. If the original profile has any personality in it, keep it and build on it.
- Do not use em dashes anywhere in the rewrite.
- Do not use filler phrases: "I'm passionate about", "results-driven", "game-changer", "leverage", "innovative", "cutting-edge", "dynamic", "strategic thinker", "In today's world", "With X years of experience", "As a [job title]".
- Do not write in bullet lists inside the About section. Write in paragraphs.
- If the original profile lacks specific numbers or client names, write the structure and use [e.g. X clients, Y result] as a placeholder. Do not invent specifics.

Return ONLY a valid JSON object. No markdown, no explanation outside the JSON:

{
  "overall_score": <integer 0-100>,
  "dimensions": {
    "headline": { "score": <integer 0-25>, "feedback": "<one direct sentence: what the headline gets right or wrong and why it matters for reach>" },
    "about": { "score": <integer 0-25>, "feedback": "<one direct sentence: the biggest structural or voice problem>" },
    "positioning": { "score": <integer 0-25>, "feedback": "<one direct sentence: how clear or muddy the niche is>" },
    "conversion": { "score": <integer 0-25>, "feedback": "<one direct sentence: whether a stranger would know to reach out and why>" }
  },
  "top_weaknesses": [
    "<specific, actionable weakness. Not generic.>",
    "<specific, actionable weakness. Not generic.>",
    "<specific, actionable weakness. Not generic.>"
  ],
  "summary": "<2 sentences. Direct and warm. Say what the profile is doing right now and what one change would make the biggest difference. Write like a trusted advisor, not a report.>",
  "rewrite": {
    "headline": "<rewritten headline, max 220 characters, all rules applied>",
    "about": "<rewritten About section, 1200-1800 characters, all rules applied>"
  }
}`,
    messages: [
      {
        role: "user",
        content: `Here is the LinkedIn profile to analyse:\n\n${profileText}`,
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

        <tr>
          <td style="padding:40px 48px 32px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 16px;">LinkedIn Profile Audit</p>
            <h1 style="font-size:32px;font-weight:900;line-height:1.1;margin:0;">Your score:<br>${overall_score}<span style="font-size:18px;font-weight:400;color:#8A8A85;">/100</span></h1>
            <span style="display:inline-block;margin-top:16px;border:1px solid #0A0A0A;padding:4px 12px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${grade}</span>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 48px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 20px;">Score breakdown</p>
            <table width="100%" cellpadding="0" cellspacing="0">${dimRows}</table>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 48px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 16px;">Three things to fix first</p>
            <ul style="margin:0;padding-left:20px;">${weaknessList}</ul>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 48px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 12px;">Rewritten headline</p>
            <p style="font-size:15px;font-weight:700;line-height:1.4;margin:0;background:#F5F5F3;padding:16px;">${rewrite.headline}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 48px;border-bottom:1px solid #EBEBEA;">
            <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8A85;margin:0 0 12px;">Rewritten About section</p>
            <div style="font-size:14px;line-height:1.7;background:#F5F5F3;padding:20px;">${aboutFormatted}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 48px;text-align:center;">
            <p style="font-size:15px;font-weight:600;margin:0 0 8px;">Want this done for you every week?</p>
            <p style="font-size:13px;color:#6B6B66;margin:0 0 24px;">We write your LinkedIn content so you can focus on the work that actually pays.</p>
            <a href="${bookingUrl}" style="display:inline-block;background:#0A0A0A;color:#FFFFFF;text-decoration:none;padding:14px 32px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Book a free call</a>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 48px;border-top:1px solid #EBEBEA;font-size:11px;color:#8A8A85;">
            Sent to ${email}. Krist Pjetraj LinkedIn Ghostwriting.
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

    logSubmission({
      email,
      score: analysis.overall_score,
      timestamp: new Date().toISOString(),
      dimensions: {
        headline: analysis.dimensions.headline.score,
        about: analysis.dimensions.about.score,
        positioning: analysis.dimensions.positioning.score,
        conversion: analysis.dimensions.conversion.score,
      },
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
