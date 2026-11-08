import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MailIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  InfoIcon,
  ArrowRightIcon,
} from '../components/common/Icons.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { SUPPORT_EMAIL } from '../config/constants.js';

/**
 * ShopFinder — Contact Page (Phase 12, Task 12.4)
 *
 * Provides platform support contact channels and a client-side demo inquiry form.
 * Uses support@example.com as a placeholder demo email without inventing fake phone
 * numbers or physical office addresses.
 */
export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'general',
    subject: '',
    message: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lastSubmissionName, setLastSubmissionName] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = 'Full name is required.';
    }
    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please provide a valid email address.';
    }
    if (!formData.subject.trim()) {
      errs.subject = 'Subject is required.';
    }
    if (!formData.message.trim()) {
      errs.message = 'Message is required.';
    } else if (formData.message.trim().length < 10) {
      errs.message = 'Please provide at least 10 characters in your message.';
    }
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLastSubmissionName(formData.name.trim());
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setFormData({
      name: '',
      email: '',
      category: 'general',
      subject: '',
      message: '',
    });
    setErrors({});
    setIsSubmitted(false);
  };

  return (
    <div className="py-10 md:py-16 space-y-12">
      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          <MailIcon className="w-4 h-4" />
          <span>Support &amp; Inquiries</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
          Get in Touch
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Have questions about commercial listings, contact reveals, or platform moderation? Reach out to our team.
        </p>
      </section>

      {/* Main Grid: Channels + Form */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Direct Channels & Operational Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-xs">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Support Channels
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Direct channels for commercial space seekers, landlords, and partners.
                </p>
              </div>

              <div className="space-y-4">
                {/* Email Channel */}
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <MailIcon className="w-4 h-4 text-primary" />
                    <span>Email Support</span>
                  </div>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-base font-bold text-primary hover:underline block pt-1"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  <p className="text-[11px] text-muted-foreground">
                    (Temporary placeholder demo address)
                  </p>
                </div>

                {/* Operating Hours */}
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <ClockIcon className="w-4 h-4 text-primary" />
                    <span>Operational Hours</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground pt-1">
                    Sunday – Thursday
                  </p>
                  <p className="text-xs text-muted-foreground">
                    9:00 AM – 6:00 PM BST (Bangladesh Standard Time)
                  </p>
                </div>

                {/* Location */}
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <MapPinIcon className="w-4 h-4 text-primary" />
                    <span>Operating Region</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground pt-1">
                    Bangladesh
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Online commercial property marketplace operations
                  </p>
                </div>
              </div>

              {/* Demo Notice Callout */}
              <div className="p-4 rounded-xl border border-border/80 bg-card text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <InfoIcon className="w-4 h-4 text-primary shrink-0" />
                  <span>Demonstration Environment</span>
                </p>
                <p>
                  ShopFinder is currently operating in a demonstration environment. Contact channels and messaging features provide client-side interactive feedback.
                </p>
              </div>
            </div>

            {/* Quick Link Card to FAQ */}
            <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-foreground">Looking for instant answers?</h3>
                <p className="text-xs text-muted-foreground">Browse common questions regarding credits, reveals, and listings.</p>
              </div>
              <Link to="/faq" className="shrink-0">
                <Button variant="outline" size="sm">
                  <span>View FAQ</span>
                  <ArrowRightIcon className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  Send Us a Message
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Fill out the form below and our team will get back to you during business hours.
                </p>
              </div>

              {isSubmitted ? (
                /* Frontend-Only Success State */
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 sm:p-8 space-y-4 animate-in fade-in zoom-in-95"
                  data-testid="contact-success-state"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                    <CheckCircleIcon className="w-6 h-6" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                      Message Received (Frontend Demo)
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
                      Thank you for your message{lastSubmissionName ? `, ${lastSubmissionName}` : ''}!
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                      <strong>Please note:</strong> This is a client-side frontend demonstration. Your message was processed locally and no actual email was transmitted over the network. In production, this inquiry will be routed to <code className="bg-emerald-500/20 px-1.5 py-0.5 rounded font-mono">{SUPPORT_EMAIL}</code>.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="border-emerald-500/30 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-500/20"
                    >
                      <span>Send Another Message</span>
                    </Button>
                  </div>
                </div>
              ) : (
                /* Interactive Form */
                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className="space-y-4"
                  data-testid="contact-form"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-name">
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-name"
                        name="name"
                        type="text"
                        placeholder="e.g. Tanvir Ahmed"
                        value={formData.name}
                        onChange={handleChange}
                        aria-invalid={errors.name ? 'true' : 'false'}
                        aria-describedby={errors.name ? 'contact-name-error' : undefined}
                      />
                      {errors.name && (
                        <p id="contact-name-error" className="text-xs text-destructive">
                          {errors.name}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-email">
                        Email Address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-email"
                        name="email"
                        type="email"
                        placeholder="e.g. tanvir@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        aria-invalid={errors.email ? 'true' : 'false'}
                        aria-describedby={errors.email ? 'contact-email-error' : undefined}
                      />
                      {errors.email && (
                        <p id="contact-email-error" className="text-xs text-destructive">
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Category */}
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-category">Inquiry Topic</Label>
                      <select
                        id="contact-category"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="general">General Marketplace Inquiry</option>
                        <option value="listings">Listing &amp; Moderation (Owner)</option>
                        <option value="billing">Pricing &amp; Reveal Credits (Customer)</option>
                        <option value="technical">Technical Support / Account Issue</option>
                      </select>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-subject">
                        Subject <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-subject"
                        name="subject"
                        type="text"
                        placeholder="e.g. Inquiry regarding Gulshan showroom"
                        value={formData.subject}
                        onChange={handleChange}
                        aria-invalid={errors.subject ? 'true' : 'false'}
                        aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
                      />
                      {errors.subject && (
                        <p id="contact-subject-error" className="text-xs text-destructive">
                          {errors.subject}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-message">
                      Message <span className="text-destructive">*</span>
                    </Label>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={5}
                      placeholder="Please provide details about your commercial property inquiry..."
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full p-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                      aria-invalid={errors.message ? 'true' : 'false'}
                      aria-describedby={errors.message ? 'contact-message-error' : undefined}
                    />
                    {errors.message && (
                      <p id="contact-message-error" className="text-xs text-destructive">
                        {errors.message}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      * Required fields
                    </p>
                    <Button type="submit" className="font-semibold shadow-xs">
                      <span>Submit Inquiry</span>
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
