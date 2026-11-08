import { site } from "@/content/site";

export type ContactState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

/**
 * Web3Forms access key for the GTHR form. Inquiries go to info@gthr.agency
 * (the address the key was made with). The key is public by design: it only
 * lets someone submit to the form, and Web3Forms' free plan only accepts
 * submissions from the visitor's browser, so it has to live in client code.
 */
const ACCESS_KEY = "3db8f89a-ba12-4fd6-9329-a57aca43e488";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sends the inquiry from the browser to Web3Forms (used with useActionState). */
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

  // Honeypot: hidden from people, so only bots tick it. Pretend it sent.
  if (formData.get("botcheck")) return { status: "sent" };

  const failed: ContactState = {
    status: "error",
    message: `That didn't send. Try again, or write to ${site.email}.`,
  };

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: ACCESS_KEY,
        subject: `Inquiry from ${name}${company ? ` (${company})` : ""}`,
        from_name: "GTHR website",
        replyto: email,
        name,
        email,
        company: company || "(none)",
        location,
        message,
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
    return response.ok && result?.success ? { status: "sent" } : failed;
  } catch {
    return failed;
  }
}
