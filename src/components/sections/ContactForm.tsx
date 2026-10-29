"use client";

import { useActionState, useEffect, useRef } from "react";
import { badgeState, subscribeBadgeName } from "@/components/three/badgeState";
import { sendInquiry, type ContactState } from "@/app/actions/contact";
import { contact } from "@/content/site";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const initial: ContactState = { status: "idle" };

// Filled, rounded fields on a faint ink wash — reads on both faces because
// it is built from `--ink-rgb` rather than a fixed grey.
const field =
  "w-full rounded-xl border border-[rgba(var(--ink-rgb),0.1)] bg-[rgba(var(--ink-rgb),0.05)] px-4 py-3 font-sans text-base lg:py-3.5 text-ink-1 placeholder:text-ink-3 transition-[border-color,box-shadow] focus:border-[rgba(var(--ink-rgb),0.4)] focus:ring-2 focus:ring-[rgba(var(--ink-rgb),0.12)] focus:outline-none";

const { fields } = contact;

export function ContactForm() {
  const [state, action, pending] = useActionState(sendInquiry, initial);
  // Phones: no labels over the fields, just short placeholders.
  const compact = useMediaQuery("(max-width: 39.99rem)");
  const nameInput = useRef<HTMLInputElement>(null);
  // Set once the visitor types in Name themselves; from then on it is
  // theirs and the badge's name no longer writes into it.
  const nameTouched = useRef(false);

  // The name a visitor put on the hero's badge (BadgeNameField) carries into
  // Name, so "Start a project" arrives with it filled in. Written to the
  // uncontrolled input directly: the form posts FormData, so its fields stay
  // uncontrolled.
  useEffect(() => {
    const fill = () => {
      const el = nameInput.current;
      if (el && !nameTouched.current) el.value = badgeState.name.trim();
    };
    fill();
    return subscribeBadgeName(fill);
  }, []);

  if (state.status === "sent") {
    return (
      <p className="py-10 text-center font-display text-2xl font-medium lg:text-3xl">
        {contact.sent}
      </p>
    );
  }

  // Two columns everywhere; on phones Name, Email and the message run full
  // width and Company + Location pair up, so the card fits on one screen
  // (client request).
  return (
    <form action={action} className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-6 sm:gap-y-4 lg:gap-y-5" noValidate>
      <label className="col-span-2 flex flex-col gap-2 max-sm:gap-0 sm:col-span-1">
        <span className="eyebrow max-sm:sr-only">{fields.name.label}</span>
        <input
          ref={nameInput}
          name="name"
          type="text"
          onInput={() => (nameTouched.current = true)}
          autoComplete="name"
          placeholder={compact ? fields.name.short : fields.name.placeholder}
          required
          className={field}
        />
      </label>
      <label className="col-span-2 flex flex-col gap-2 max-sm:gap-0 sm:col-span-1">
        <span className="eyebrow max-sm:sr-only">{fields.email.label}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder={compact ? fields.email.short : fields.email.placeholder}
          required
          className={field}
        />
      </label>
      <label className="col-span-1 flex flex-col justify-end gap-2 max-sm:gap-0">
        <span className="eyebrow max-sm:sr-only">{fields.company.label}</span>
        <input
          name="company"
          type="text"
          autoComplete="organization"
          placeholder={compact ? fields.company.short : fields.company.placeholder}
          className={field}
        />
      </label>
      <label className="col-span-1 flex flex-col justify-end gap-2 max-sm:gap-0">
        <span className="eyebrow max-sm:sr-only">{fields.location.label}</span>
        <input
          name="location"
          type="text"
          autoComplete="address-level2"
          placeholder={compact ? fields.location.short : fields.location.placeholder}
          required
          className={field}
        />
      </label>
      <label className="col-span-2 flex flex-col gap-2 max-sm:gap-0">
        <span className="eyebrow max-sm:sr-only">{fields.message.label}</span>
        <textarea
          name="message"
          rows={3}
          placeholder={compact ? fields.message.short : fields.message.placeholder}
          required
          minLength={10}
          className={`${field} resize-none`}
        />
      </label>

      {state.status === "error" && state.message ? (
        <p role="alert" className="font-mono text-sm text-accent-ink col-span-2">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-full bg-ink-1 px-8 py-3.5 font-sans text-sm font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50 col-span-2 lg:text-base"
      >
        {pending ? contact.sending : contact.submit}
      </button>
    </form>
  );
}
