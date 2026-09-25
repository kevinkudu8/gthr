"use client";

import { useActionState } from "react";
import { sendInquiry, type ContactState } from "@/app/actions/contact";
import { contact } from "@/content/site";

const initial: ContactState = { status: "idle" };

// Filled, rounded fields on a faint ink wash — reads on both faces because
// it is built from `--ink-rgb` rather than a fixed grey.
const field =
  "w-full rounded-xl border border-[rgba(var(--ink-rgb),0.1)] bg-[rgba(var(--ink-rgb),0.05)] px-4 py-3.5 font-sans text-base text-ink-1 placeholder:text-ink-3 transition-[border-color,box-shadow] focus:border-[rgba(var(--ink-rgb),0.4)] focus:ring-2 focus:ring-[rgba(var(--ink-rgb),0.12)] focus:outline-none";

const { fields } = contact;

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
    <form action={action} className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2" noValidate>
      <label className="flex flex-col gap-2.5">
        <span className="eyebrow">{fields.name.label}</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          placeholder={fields.name.placeholder}
          required
          className={field}
        />
      </label>
      <label className="flex flex-col gap-2.5">
        <span className="eyebrow">{fields.email.label}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder={fields.email.placeholder}
          required
          className={field}
        />
      </label>
      <label className="flex flex-col gap-2.5">
        <span className="eyebrow">{fields.company.label}</span>
        <input
          name="company"
          type="text"
          autoComplete="organization"
          placeholder={fields.company.placeholder}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-2.5">
        <span className="eyebrow">{fields.location.label}</span>
        <input
          name="location"
          type="text"
          autoComplete="address-level2"
          placeholder={fields.location.placeholder}
          required
          className={field}
        />
      </label>
      <label className="flex flex-col gap-2.5 sm:col-span-2">
        <span className="eyebrow">{fields.message.label}</span>
        <textarea
          name="message"
          rows={4}
          placeholder={fields.message.placeholder}
          required
          minLength={10}
          className={`${field} resize-none`}
        />
      </label>

      {state.status === "error" && state.message ? (
        <p role="alert" className="font-mono text-sm text-accent-ink sm:col-span-2">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-full bg-ink-1 px-8 py-3.5 font-sans text-sm font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50 sm:col-span-2 lg:text-base"
      >
        {pending ? contact.sending : contact.submit}
      </button>
    </form>
  );
}
