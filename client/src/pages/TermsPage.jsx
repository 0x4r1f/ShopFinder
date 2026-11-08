import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileTextIcon,
  AlertCircleIcon,
  MailIcon,
} from '../components/common/Icons.jsx';
import { SUPPORT_EMAIL } from '../config/constants.js';

/**
 * ShopFinder — Terms and Conditions Page (Phase 12, Task 12.4)
 *
 * Transparent, plain-language terms of service articulating platform rules,
 * D-001 credit policies, D-002 moderation rules, and D-014 privacy protections.
 */
export default function TermsPage() {
  return (
    <div className="py-10 md:py-16">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <header className="space-y-4 border-b border-border pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <FileTextIcon className="w-4 h-4" />
            <span>Platform Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Please read these terms carefully before using ShopFinder. By registering, browsing listings, or purchasing credits, you agree to be bound by these policies.
          </p>
          <div className="text-xs text-muted-foreground">
            <span>Last Updated: November 2026 &bull; Version 1.0</span>
          </div>
        </header>

        {/* Section 1: Platform Overview */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            1. Platform Purpose &amp; Scope
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ShopFinder is a commercial property discovery and lead-generation marketplace operating in Bangladesh. The platform enables commercial space owners and authorized landlords to publish commercial property listings and enables prospective tenants and buyers to search, evaluate, and unlock direct owner contact information.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ShopFinder is exclusively designed for commercial properties, including retail shops, corporate offices, restaurants, warehouses, showrooms, commercial floors, and industrial facilities. Residential rentals and sales are not supported.
          </p>
        </section>

        {/* Section 2: Account Registration & Governance */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            2. User Accounts &amp; Roles
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To unlock owner contact numbers or create property listings, you must create a registered account. Users may register as a <strong>Customer</strong> (commercial property seekers) or as a <strong>Property Owner</strong> (landlords and leasing agents).
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              You agree to provide accurate, truthful, and up-to-date registration information.
            </li>
            <li>
              You are responsible for maintaining the confidentiality of your account credentials. All actions performed through your authenticated session are your responsibility.
            </li>
            <li>
              Administrative roles are strictly assigned by platform operations and cannot be self-selected.
            </li>
          </ul>
        </section>

        {/* Section 3: Listing Submission & Moderation (D-002) */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            3. Property Listings &amp; Moderation Policy (D-002)
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To ensure high catalog quality and prevent fraud, all property listings submitted to ShopFinder are subject to administrative review before being published publicly:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              <strong>Initial Moderation:</strong> All newly created property listings default to a <code>pending</code> status and are reviewed in the Admin moderation queue prior to publication.
            </li>
            <li>
              <strong>Re-Approval on Major Edits (D-002):</strong> Any substantive modification to an approved listing—including changes to title, description, price, square footage, address, city, category, or photos—automatically resets the listing to <code>pending</code> status for administrator re-verification.
            </li>
            <li>
              <strong>Truth in Advertising:</strong> Property owners must possess legitimate authority to lease or sell the listed property. Fictitious pricing, deceptive square footage, misleading photos, or duplicate listing spam will result in listing rejection or account deactivation.
            </li>
          </ul>
        </section>

        {/* Section 4: Contact Reveal Credits & Billing (D-001) */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            4. Contact Reveal Credits &amp; Payments (D-001)
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ShopFinder operates an upfront, credit-based reveal model rather than a recurring subscription:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              <strong>One-Time Packages:</strong> Customers purchase credits through one-time packages (Starter Plan: ৳299 for 10 credits; Pro Plan: ৳999 for 100 credits). There are zero recurring monthly charges, automatic renewals, or hidden auto-debits.
            </li>
            <li>
              <strong>Non-Expiring Credits:</strong> In accordance with policy D-001, purchased contact reveal credits never expire. Unused credits remain in your account indefinitely until used.
            </li>
            <li>
              <strong>Credit Stacking:</strong> Purchasing additional packages stacks with any existing unused balance.
            </li>
            <li>
              <strong>Reveal Mechanics:</strong> Unlocking an owner&apos;s phone number consumes exactly 1 credit. Once revealed, that specific listing&apos;s contact details remain accessible in your Reveal History permanently at zero additional cost.
            </li>
            <li>
              <strong>Refund Policy:</strong> Credits that have been successfully consumed to reveal valid owner contact numbers are non-refundable. Unconsumed credit packages may be reviewed on a case-by-case basis.
            </li>
          </ul>
        </section>

        {/* Section 5: Permitted Use of Revealed Information */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            5. Permitted Use of Owner Contact Information
          </h2>
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <AlertCircleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Strict Protection of Private Contact Details (D-014)
              </p>
              <p className="leading-relaxed">
                Owner contact numbers are provided strictly to facilitate commercial space inquiries between prospective tenants and landlords.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You agree not to use revealed owner numbers for telemarketing, bulk SMS advertising, commercial solicitation unrelated to the property, automated data harvesting, or public resale. Violations of this policy will result in immediate and permanent account termination.
          </p>
        </section>

        {/* Section 6: Marketplace Disclaimer */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            6. Marketplace Relationship &amp; Disclaimers
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ShopFinder is an independent commercial property marketplace and technology platform:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              ShopFinder is not a real estate agency, property broker, or legal party to any lease agreement, tenancy contract, or deed of sale negotiated between users.
            </li>
            <li>
              While all listings undergo moderation review, users are advised to conduct their own independent due diligence, title verification, and physical on-site inspections prior to signing leases or transferring funds.
            </li>
            <li>
              ShopFinder is not liable for disputes, rent defaults, property damage, or contractual disagreements arising between tenants and property owners.
            </li>
          </ul>
        </section>

        {/* Section 7: Prohibited Conduct */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            7. Prohibited Conduct
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Users may not engage in any of the following activities on ShopFinder:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>Automated scraping, bot-crawling, or data extraction without prior written authorization.</li>
            <li>Circumventing platform security, authentication barriers, or payment verification endpoints.</li>
            <li>Submitting malicious software, false reports, or abusive communications.</li>
            <li>Interfering with the operational availability of the marketplace or backend APIs.</li>
          </ul>
        </section>

        {/* Section 8: Inquiries */}
        <section className="space-y-3 border-t border-border pt-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            8. Contact &amp; Inquiries
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For questions or legal inquiries regarding these Terms and Conditions, please contact our support team at:
          </p>
          <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
            <MailIcon className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Demo Support Contact</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            You may also submit inquiries through our <Link to="/contact" className="text-primary hover:underline font-medium">Contact Page</Link>.
          </p>
        </section>
      </article>
    </div>
  );
}
