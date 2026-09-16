"use client";

import { useActionState } from "react";
import { sendInquiry, type ContactState } from "@/app/actions/contact";
import { contact } from "@/content/site";

const initial: ContactState = { status: "idle" };

const field =
  "w-full border-0 border-b border-line bg-transparent py-3 font-sans text-base text-ink-1 placeholder:text-ink-3 transition-colors focus:border-brand focus:outline-none";

export function ContactForm() {
  const [state, action, pending] = useActionState(sendInquiry, initial);

  if (state.status === "sent") {
    return (
      <p className="py-10 text-center font-display text-2xl font-medium lg:text-3xl">
        {contact.sent}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <label className="block">
        <span className="eyebrow">{contact.fields.name}</span>
        <input name="name" type="text" autoComplete="name" required className={field} />
      </label>
      <label className="block">
        <span className="eyebrow">{contact.fields.email}</span>
        <input name="email" type="email" autoComplete="email" required className={field} />
      </label>
      <label className="block">
        <span className="eyebrow">{contact.fields.message}</span>
        <textarea
          name="message"
          rows={4}
          required
          minLength={10}
          className={`${field} resize-none`}
        />
      </label>

      {state.status === "error" && state.message ? (
        <p role="alert" className="font-mono text-sm text-accent">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="outline-box outline-box--dotted w-fit font-mono text-sm text-ink-1 disabled:opacity-50 lg:text-base"
      >
        {pending ? contact.sending : contact.submit}
      </button>
    </form>
  );
}
