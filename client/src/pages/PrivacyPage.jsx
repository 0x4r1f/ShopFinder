import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheckIcon,
  LockIcon,
  MailIcon,
  CheckCircleIcon,
} from '../components/common/Icons.jsx';
import { SUPPORT_EMAIL } from '../config/constants.js';

/**
 * ShopFinder — Privacy Policy Page (Phase 12, Task 12.4)
 *
 * Articulates data privacy practices, emphasizing the D-014 privacy architecture
 * for protected owner phone numbers and D-010 httpOnly cookie security.
 */
export default function PrivacyPage() {
  return (
    <div className="py-10 md:py-16">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <header className="space-y-4 border-b border-border pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <ShieldCheckIcon className="w-4 h-4" />
            <span>Data Protection &amp; Privacy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Your privacy is fundamental to our platform design. This policy explains what information we collect, how it is safeguarded, and how our architecture protects private contact details.
          </p>
          <div className="text-xs text-muted-foreground">
            <span>Last Updated: November 2026 &bull; Version 1.0</span>
          </div>
        </header>

        {/* Highlight Banner: Architectural Privacy (D-014) */}
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg">
            <LockIcon className="w-5 h-5 shrink-0" />
            <span>Architectural Privacy: Protected Contact Numbers (D-014)</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Unlike traditional listing directories that expose owner telephone numbers directly in public web pages—inviting automated web scraping, telemarketing calls, and spam—ShopFinder enforces a strict database isolation policy.
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Owner telephone numbers are stored in a dedicated, access-restricted database collection (<code className="text-xs bg-muted px-1.5 py-0.5 rounded">owner_contacts</code>) and are <strong>never</strong> included in public marketplace queries, listing details, or search payloads. Numbers are unlocked exclusively through an authenticated, credit-verified reveal transaction initiated by a genuine space seeker.
          </p>
        </section>

        {/* Section 1: Information We Collect */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            1. Information We Collect
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We collect only the minimum information necessary to operate our commercial real estate marketplace:
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-primary" />
                <span>Account Information</span>
              </h3>
              <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
                When you create an account, we store your full name, email address, role selection (Customer or Property Owner), and a cryptographically salted password hash. Passwords are never stored in plaintext.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-primary" />
                <span>Commercial Listing Information</span>
              </h3>
              <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
                When an owner submits a listing, we collect property attributes including title, description, category, rental or sale price, floor area in square feet, city, neighborhood, and uploaded property photographs.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-primary" />
                <span>Customer Reveal &amp; Saved Data</span>
              </h3>
              <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
                We maintain your saved property bookmarks and a permanent history of listings for which you have unlocked owner contact numbers, allowing you to access unlocked details at any time without re-spending credits.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-primary" />
                <span>Technical &amp; Analytics Data</span>
              </h3>
              <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
                To prevent fraud and aggregate listing view metrics for landlords, we process anonymized IP address hashes (using SHA-256) for a 30-minute deduplication window. We do not track users across external third-party websites.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Session Security (D-010) */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            2. Authentication &amp; Session Security (D-010)
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We adhere to strict modern session protection standards:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              <strong>httpOnly Cookies:</strong> Authentication tokens are transmitted strictly via server-set <code>httpOnly</code> cookies. They cannot be read or extracted by client-side JavaScript, mitigating Cross-Site Scripting (XSS) risks.
            </li>
            <li>
              <strong>CSRF Defense:</strong> All state-changing actions (such as contact reveals, listing submissions, and profile updates) verify origin and referer headers against our authorized frontend domain.
            </li>
            <li>
              <strong>Zero Browser Storage Tokens:</strong> Tokens are never stored in browser <code>localStorage</code> or <code>sessionStorage</code>.
            </li>
          </ul>
        </section>

        {/* Section 3: How We Use Your Data */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            3. How We Use Information
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Collected data is used strictly for legitimate marketplace functions:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>Facilitating commercial property discovery and connecting tenants with landlords.</li>
            <li>Processing one-time credit package purchases and maintaining accurate credit ledgers.</li>
            <li>Delivering in-app notifications regarding listing review statuses and credit balances.</li>
            <li>Monitoring and maintaining platform security, detecting fraud, and enforcing terms.</li>
          </ul>
        </section>

        {/* Section 4: Third-Party Sharing */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            4. Information Sharing &amp; Third Parties
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>We do not sell, rent, or trade your personal data to third parties.</strong>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We disclose information only in the following limited circumstances:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              <strong>Authorized Contact Reveals:</strong> When a customer explicitly uses a credit to reveal a property&apos;s contact information, the owner&apos;s phone number is provided to that verified customer.
            </li>
            <li>
              <strong>Payment Gateways:</strong> For payment processing, required transaction metadata is securely transmitted to authorized payment gateways (e.g., SSLCommerz, bKash) under industry-standard encryption.
            </li>
            <li>
              <strong>Legal Compliance:</strong> If required by applicable laws or regulatory authorities in Bangladesh to comply with valid legal processes.
            </li>
          </ul>
        </section>

        {/* Section 5: Data Rights */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            5. Your Privacy Rights
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You maintain full control over your profile information:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>You can inspect and update your name and profile details at any time from your account settings.</li>
            <li>Property owners can update or remove their private phone numbers from their owner profile.</li>
            <li>You may request account deactivation and removal of your personal records by contacting support.</li>
          </ul>
        </section>

        {/* Section 6: Contact */}
        <section className="space-y-3 border-t border-border pt-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            6. Privacy Inquiries
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you have questions or concerns regarding this Privacy Policy or our data handling practices, please contact our team:
          </p>
          <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
            <MailIcon className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Demo Privacy Contact</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            You can also submit inquiries via our <Link to="/contact" className="text-primary hover:underline font-medium">Contact Page</Link>.
          </p>
        </section>
      </article>
    </div>
  );
}
