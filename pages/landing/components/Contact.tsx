import React, { useEffect, useRef, useState } from 'react';
import { EnvelopeIcon, GlobeAltIcon, MapPinIcon } from '../../../components/icons';
import { Reveal, SectionHeading, SECTION_SPACING, prefersReducedMotion } from '../motion';
import { buttonPrimary, buttonSecondary, cardHover, cardInteractive, fieldInput } from '../ui';

interface ContactProps {
  /** Set when a visitor clicks "Enquire" on a program card; pre-fills the message. */
  enquiry?: { program: string; at: number } | null;
}

/**
 * Full-card confirmation after sending: a paper plane takes off (with a trail), then an emerald
 * circle and tick draw in its place and the thank-you copy rises in.
 */
const SentConfirmation: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div role="status" aria-live="polite" className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center">
      <div className="relative h-28 w-28">
        {/* Halo behind the tick */}
        <span className="absolute inset-3 rounded-full bg-emerald-400/30 animate-halo-late" aria-hidden="true" />

        <svg viewBox="0 0 112 112" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {/* Trail left behind by the plane */}
          <path
            d="M30 78 C 48 70, 62 56, 104 22"
            fill="none"
            stroke="url(#trail)"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            className="animate-plane-trail"
          />
          <defs>
            <linearGradient id="trail" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Tick: circle fill, circle stroke, check */}
          <g className="origin-center animate-pop-late" style={{ transformBox: 'fill-box' }}>
            <circle cx="56" cy="56" r="40" className="fill-emerald-400/10" />
          </g>
          <circle
            cx="56" cy="56" r="40" fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round"
            pathLength={1} strokeDasharray="1" transform="rotate(-90 56 56)" className="animate-draw-circle-late"
          />
          <path
            d="M38 57.5l12 12 24-26" fill="none" stroke="#34d399" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} strokeDasharray="1" className="animate-draw-check-late"
          />
        </svg>

        {/* Paper plane takes off and flies out of frame */}
        <svg viewBox="0 0 24 24" className="absolute left-[34px] top-[34px] h-11 w-11 text-emerald-300 drop-shadow-[0_0_14px_rgba(52,211,153,0.6)] animate-plane-fly" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      </div>

      <h3
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 text-2xl sm:text-3xl font-extrabold tracking-tight text-white outline-none animate-fade-in-up"
        style={{ animationDelay: '1.35s' }}
      >
        Thank you!
      </h3>
      <p className="mt-2 max-w-xs text-sm sm:text-base text-gray-400 animate-fade-in-up" style={{ animationDelay: '1.5s' }}>
        Thank you for your message! We will get back to you shortly.
      </p>
      <button
        type="button"
        onClick={onReset}
        className={`group/again ${buttonSecondary} mt-8 px-6 py-3 text-sm animate-fade-in-up`}
        style={{ animationDelay: '1.7s' }}
      >
        <svg className="h-4 w-4 transition-transform duration-500 ease-premium group-hover/again:-rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        Send another message
      </button>
    </div>
  );
};

const Contact: React.FC<ContactProps> = ({ enquiry }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enquiry) return;
    setSubmitted(false);
    setMessage(`Hi, I'd like to know more about the ${enquiry.program} program.`);
    // Focus once the smooth scroll has brought the form into view.
    const t = window.setTimeout(() => messageRef.current?.focus({ preventScroll: true }), 700);
    return () => window.clearTimeout(t);
  }, [enquiry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    // Make sure the whole confirmation is on screen (the card may be partly under the navbar).
    const card = formCardRef.current;
    if (card) {
      const r = card.getBoundingClientRect();
      if (r.top < 96 || r.bottom > window.innerHeight) {
        const top = window.scrollY + r.top - Math.max(96, (window.innerHeight - r.height) / 2);
        window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    }
    setName('');
    setEmail('');
    setPhone('');
    setMessage('');
  };

  const resetForm = () => {
    setSubmitted(false);
    // Hand focus back to the start of the form.
    window.setTimeout(() => document.getElementById('contact-name')?.focus({ preventScroll: true }), 50);
  };

  const contactLinks = [
    { href: 'mailto:contact@atlasclasses.com', label: 'Email Us', value: 'contact@atlasclasses.com', Icon: EnvelopeIcon, external: false },
    { href: 'https://www.atlasclasses.com', label: 'Visit Website', value: 'www.atlasclasses.com', Icon: GlobeAltIcon, external: true },
  ];

  return (
    <section className={`${SECTION_SPACING} bg-atlas-dark relative overflow-hidden`}>
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-[15%] right-[4%] w-96 h-96 bg-atlas-primary/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[12%] left-[4%] w-72 h-72 bg-emerald-600/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start lg:items-center">

            {/* Left Column: Contact Info & Intro */}
            <div className="order-2 lg:order-1 min-w-0">
                <SectionHeading
                    align="left"
                    eyebrow="Contact"
                    title={<>Get in <span className="text-atlas-primary">Touch</span></>}
                    subtitle="Have questions about our curriculum, faculty, or partnership model? We're here to answer all your queries and help you get started with Atlas Classes."
                    className="!mb-10"
                />

                <div data-spotlight-group className="space-y-4">
                    {contactLinks.map(({ href, label, value, Icon, external }, i) => (
                        <Reveal key={href} delay={i * 100}>
                            <a
                                href={href}
                                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                className={`group/card flex items-center p-5 ${cardInteractive}`}
                            >
                                <span className="mr-5 rounded-full bg-white/[0.05] p-3.5 text-atlas-primary shadow-inner transition-all duration-500 ease-premium group-hover/card:scale-110 group-hover/card:bg-atlas-primary group-hover/card:text-gray-950 group-hover/card:shadow-glow">
                                    <Icon className="h-6 w-6" />
                                </span>
                                <span className="min-w-0">
                                    <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
                                    <span className="block text-base sm:text-lg font-bold text-white transition-colors duration-300 group-hover/card:text-emerald-300 [overflow-wrap:anywhere]">{value}</span>
                                </span>
                            </a>
                        </Reveal>
                    ))}

                    <Reveal delay={200}>
                        <div className={`group/card flex items-center p-5 ${cardHover}`}>
                            <span className="mr-5 rounded-full bg-white/[0.05] p-3.5 text-atlas-primary shadow-inner transition-all duration-500 ease-premium group-hover/card:-translate-y-0.5 group-hover/card:scale-110 group-hover/card:shadow-glow">
                                <MapPinIcon className="h-6 w-6" />
                            </span>
                            <span>
                                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Headquarters</span>
                                <span className="block text-base sm:text-lg font-bold text-white">Bellari, Karnataka, India</span>
                            </span>
                        </div>
                    </Reveal>
                </div>
            </div>

            {/* Right Column: Contact Form */}
            <Reveal variant="right" delay={120} className="order-1 lg:order-2 min-w-0">
                <div ref={formCardRef} className={`${cardHover} spotlight-flat overflow-hidden rounded-3xl p-6 sm:p-8 md:p-10`}>
                     <div className="pointer-events-none absolute -inset-1 bg-gradient-to-br from-atlas-primary/15 to-transparent opacity-60 blur-2xl" aria-hidden="true" />

                    {/* The form steps back (blurs, dims, recedes) while the confirmation plays over it */}
                    <div
                        className={`relative z-10 transition-[filter,opacity,transform] duration-700 ease-premium ${submitted ? 'pointer-events-none select-none scale-[0.97] opacity-25 blur-md' : ''}`}
                        aria-hidden={submitted}
                        inert={submitted}
                    >
                        <h3 className="text-2xl font-bold text-white mb-2">Send us a Message</h3>
                        <p className="text-gray-400 mb-8 text-sm">Fill out the form below and we'll get back to you as soon as possible.</p>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label htmlFor="contact-name" className="ml-1 text-xs font-bold uppercase text-gray-400">Name</label>
                                    <input id="contact-name" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required className={fieldInput} placeholder="John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="contact-phone" className="ml-1 text-xs font-bold uppercase text-gray-400">Phone</label>
                                    <input id="contact-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required className={fieldInput} placeholder="+91 98765 43210" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="contact-email" className="ml-1 text-xs font-bold uppercase text-gray-400">Email</label>
                                <input id="contact-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className={fieldInput} placeholder="john@example.com" />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="contact-message" className="ml-1 text-xs font-bold uppercase text-gray-400">Message</label>
                                <textarea id="contact-message" ref={messageRef} rows={4} value={message} onChange={e => setMessage(e.target.value)} required className={`${fieldInput} resize-none`} placeholder="How can we help you?" />
                            </div>

                            <button type="submit" className={`${buttonPrimary} w-full rounded-xl py-4 text-sm uppercase tracking-wider`}>
                                Send Message
                            </button>
                        </form>
                    </div>

                    {submitted && <SentConfirmation onReset={resetForm} />}
                </div>
            </Reveal>
        </div>
      </div>
    </section>
  );
};

export default Contact;
