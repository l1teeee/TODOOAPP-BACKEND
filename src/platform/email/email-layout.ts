import { AppError } from "../errors/app-error.js";
import { escapeHtml } from "./escape-html.js";

export interface EmailContent {
  preheader: string;
  title: string;
  intro: string;
  code?: string;
  action?: { label: string; url: string };
  details?: readonly { label: string; value: string }[];
  outro?: string;
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  if (content.action) {
    const url = URL.canParse(content.action.url) ? new URL(content.action.url) : undefined;
    const allowed =
      url &&
      ((content.action.url.startsWith("https://") && url.protocol === "https:") ||
        (content.action.url.startsWith("http://localhost") &&
          url.protocol === "http:" &&
          url.hostname === "localhost"));
    if (!allowed) {
      throw new AppError("invalid", "INVALID_EMAIL_URL", "Email action URL is not allowed");
    }
  }

  const footer = "Sent by TODO App. You received this because of activity on your account.";
  const text = ["TODO App", content.preheader, content.title, content.intro];
  let codeHtml = "";
  if (content.code !== undefined) {
    codeHtml = `<tr><td style="padding:0 0 24px"><div style="padding:20px;text-align:center;letter-spacing:8px;font:700 28px monospace;color:#1E255E;background:#EDF2FE;border-radius:16px">${escapeHtml(content.code)}</div></td></tr>`;
    text.push(content.code);
  }
  let actionHtml = "";
  if (content.action) {
    actionHtml = `<tr><td style="padding:0 0 24px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#3B82F6" style="border-radius:12px"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#3B82F6;color:#FFFFFF;font-weight:700;text-decoration:none">${escapeHtml(content.action.label)}</a></td></tr></table></td></tr>`;
    text.push(`${content.action.label}: ${content.action.url}`);
  }
  let detailsHtml = "";
  if (content.details?.length) {
    let rows = "";
    for (const detail of content.details) {
      rows += `<tr><td style="padding:8px 16px 8px 0;vertical-align:top">${escapeHtml(detail.label)}</td><td style="padding:8px 0;color:#1A1D26;vertical-align:top">${escapeHtml(detail.value)}</td></tr>`;
      text.push(`${detail.label}: ${detail.value}`);
    }
    detailsHtml = `<tr><td style="padding:0 0 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:15px;line-height:1.6;color:#5F6B85">${rows}</table></td></tr>`;
  }
  let outroHtml = "";
  if (content.outro !== undefined) {
    outroHtml = `<tr><td style="padding:0 0 24px">${escapeHtml(content.outro)}</td></tr>`;
    text.push(content.outro);
  }
  text.push(footer);

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.title)}</title></head>
<body style="margin:0;padding:0;background:#EEF2F6;font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">
<span style="display:none;visibility:hidden;opacity:0;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all">${escapeHtml(content.preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#EEF2F6"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:480px;border-radius:24px"><tr><td style="padding:32px;font-size:15px;line-height:1.6;color:#5F6B85">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:0 0 24px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="24" height="3" bgcolor="#DE3B75" style="width:24px;height:3px;font-size:0;line-height:0">&nbsp;</td></tr></table><div style="padding-top:8px;font-size:18px;font-weight:700;color:#1E255E">TODO App</div></td></tr>
<tr><td style="padding:0 0 16px"><h1 style="margin:0;font-size:20px;font-weight:700;color:#1A1D26">${escapeHtml(content.title)}</h1></td></tr>
<tr><td style="padding:0 0 24px">${escapeHtml(content.intro)}</td></tr>
${codeHtml}${actionHtml}${detailsHtml}${outroHtml}
<tr><td style="font-size:12px;line-height:1.6;color:#8F9BB3">${escapeHtml(footer)}</td></tr>
</table></td></tr></table>
</td></tr></table>
</body></html>`;

  return { html, text: text.join("\n\n") };
}
