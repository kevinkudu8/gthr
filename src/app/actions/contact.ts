"use server";

import { site } from "@/content/site";

export type ContactState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends the inquiry through Resend's REST API. Needs RESEND_API_KEY (and
 * optionally CONTACT_TO / CONTACT_FROM) in the environment — see README.
 * Without a key it says so honestly rather than pretending to send.
 */
export async function sendInquiry(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !EMAIL.test(email) || !location || message.length < 10) {
    return {
      status: "error",
      message: "A name, a real email, a location, and a few words about what you need, please.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      status: "error",
      message: `The form isn't connected yet — write to ${site.email} instead.`,
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM ?? "GTHR <onboarding@resend.dev>",
      to: [process.env.CONTACT_TO ?? site.email],
      reply_to: email,
      subject: `Inquiry from ${name}${company ? ` (${company})` : ""}`,
      text: [
        `${name} <${email}>`,
        company ? `Company: ${company}` : null,
        `Location: ${location}`,
        "",
        message,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    }),
  });

  if (!response.ok) {
    return {
      status: "error",
      message: `That didn't send. Try again, or write to ${site.email}.`,
    };
  }

  return { status: "sent" };
}
