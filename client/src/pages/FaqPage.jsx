import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRightIcon,
  StoreIcon,
  BuildingIcon,
  SparklesIcon,
  ShieldCheckIcon,
  MailIcon,
  ArrowRightIcon,
} from '../components/common/Icons.jsx';
import { Button } from '../components/ui/button.jsx';
import { SUPPORT_EMAIL } from '../config/constants.js';

const FAQ_CATEGORIES = [
  {
    id: 'general',
    title: 'General & Commercial Spaces',
    icon: StoreIcon,
    questions: [
      {
        q: 'What makes ShopFinder different from other property portals?',
        a: 'Unlike general real estate websites that mix residential apartments, houses, and land plots, ShopFinder is 100% dedicated to commercial property. Every feature, filter, and specification is designed specifically for business owners, retailers, corporate tenants, and commercial landlords in Bangladesh.',
      },
      {
        q: 'What types of commercial properties can I find on ShopFinder?',
        a: 'We support seven official commercial property categories: Retail Shops, Commercial Offices, Restaurants & Cafes, Warehouses & Godowns, Showrooms, Commercial Floors, and Industrial Spaces. Each listing includes specific commercial attributes such as floor area in square feet, rental/sale terms, and precise location.',
      },
      {
        q: 'In which cities does ShopFinder operate?',
        a: 'ShopFinder currently features commercial spaces across major economic and municipal centers in Bangladesh, including Dhaka (Gulshan, Banani, Motijheel, Uttara, Dhanmondi, Mirpur), Chittagong (Agrabad, GEC, Nasirabad), Sylhet, Rajshahi, Khulna, and Gazipur.',
      },
    ],
  },
  {
    id: 'seekers',
    title: 'For Space Seekers & Tenants',
    icon: BuildingIcon,
    questions: [
      {
        q: 'Is it free to browse and search commercial properties?',
        a: 'Yes. Searching, filtering by city or size, reviewing high-resolution photo galleries, reading full commercial specifications, and saving favorites to your account are completely free. You only need credits when you decide to reveal and contact a property owner directly.',
      },
      {
        q: 'How do I contact a property owner?',
        a: 'On any approved property details page, click the "Reveal Contact" button. If you have an active credit balance, confirming the reveal atomically deducts exactly 1 credit and instantly unlocks the verified telephone number of the property owner or leasing agent.',
      },
      {
        q: 'What happens after I reveal an owner&apos;s phone number?',
        a: 'Once unlocked, that property&apos;s contact details remain permanently in your Customer Reveal History at zero additional cost. You can return to your dashboard and view the unlocked number whenever you need it without spending another credit.',
      },
      {
        q: 'How does the Saved Properties feature work?',
        a: 'Registered customers can bookmark any property by clicking the bookmark or heart icon. You can manage, filter, and revisit your saved inventory at any time from your Customer Dashboard at /dashboard/saved.',
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing, Packages & Reveal Credits',
    icon: SparklesIcon,
    questions: [
      {
        q: 'Do contact reveal credits expire?',
        a: 'No. In strict accordance with approved decision D-001, purchased contact reveal credits never expire. Unused credits remain safely in your account ledger indefinitely until you choose to unlock owner contacts.',
      },
      {
        q: 'Can I purchase multiple credit packages?',
        a: 'Yes. You can purchase additional Starter (10 credits) or Pro (100 credits) packages at any time. All newly purchased credits automatically stack with your existing credit balance without overwriting previous history.',
      },
      {
        q: 'Is this a recurring monthly subscription?',
        a: 'No. ShopFinder operates purely on a one-time prepaid package model. There are no monthly subscriptions, automatic recurring renewals, or unexpected auto-debit charges.',
      },
      {
        q: 'What is the cost per contact reveal?',
        a: 'Exactly 1 credit unlocks 1 property owner contact. With the Starter package (৳299 / 10 credits), each reveal is approximately ৳29.9. With the Pro package (৳999 / 100 credits), each reveal drops to just ৳10.0, offering best value for active business seekers.',
      },
    ],
  },
  {
    id: 'owners',
    title: 'For Property Owners & Landlords',
    icon: ShieldCheckIcon,
    questions: [
      {
        q: 'Is it free to list my commercial property?',
        a: 'Yes. Under platform decision D-005, property owners can list commercial spaces for rent or sale completely free of charge at launch.',
      },
      {
        q: 'How does the listing moderation process work?',
        a: 'All newly submitted properties default to pending status and enter our Admin Review Queue. Platform moderators verify the commercial authenticity, pricing reasonableness, and image quality before approving the listing for public marketplace display.',
      },
      {
        q: 'What happens when I edit an already approved listing?',
        a: 'Under our D-002 listing re-approval policy, any significant edit to a property (such as price, area, title, address, or photos) automatically resets the listing to pending review. This prevents deceptive bait-and-switch modifications and keeps marketplace inventory trustworthy.',
      },
      {
        q: 'How is my private telephone number protected from spam?',
        a: 'Under our D-014 privacy policy, owner telephone numbers are stored in a dedicated, isolated database collection. They are never rendered in public HTML, never included in search payloads, and cannot be harvested by automated web scrapers. Only authenticated customers with active credits can unlock your number.',
      },
    ],
  },
];

/**
 * ShopFinder — Frequently Asked Questions (FAQ) Page (Phase 12, Task 12.4)
 *
 * Categorized, expandable FAQ answering questions across general features,
 * space discovery, pricing & D-001 credit rules, and D-002/D-014 owner policies.
 */
export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [openItems, setOpenItems] = useState({
    'general-0': true, // Open the first item by default
  });

  const toggleItem = (key) => {
    setOpenItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const filteredCategories =
    activeCategory === 'all'
      ? FAQ_CATEGORIES
      : FAQ_CATEGORIES.filter((cat) => cat.id === activeCategory);

  return (
    <div className="py-10 md:py-16 space-y-12">
      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          <StoreIcon className="w-4 h-4" />
          <span>Help &amp; Knowledge Base</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Everything you need to know about commercial listings, contact reveal credits, property moderation, and owner privacy in Bangladesh.
        </p>
      </section>

      {/* Category Filter Pills */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All Questions
          </button>
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>
      </section>

      {/* Accordion FAQ Groups */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {filteredCategories.map((cat) => {
          const CategoryIcon = cat.icon;
          return (
            <div key={cat.id} className="space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border">
                <CategoryIcon className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">
                  {cat.title}
                </h2>
              </div>

              <div className="space-y-3">
                {cat.questions.map((item, idx) => {
                  const key = `${cat.id}-${idx}`;
                  const isOpen = !!openItems[key];

                  return (
                    <div
                      key={key}
                      className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs transition-colors"
                      data-testid={`faq-item-${key}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(key)}
                        aria-expanded={isOpen}
                        className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="text-sm sm:text-base font-semibold text-foreground">
                          {item.q}
                        </span>
                        <ChevronRightIcon
                          className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-90 text-primary' : ''
                          }`}
                        />
                      </button>

                      <div
                        id={`faq-answer-container-${key}`}
                        aria-hidden={!isOpen}
                        className={`px-5 sm:px-6 pb-5 sm:pb-6 pt-0 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-4 ${
                          isOpen ? 'block animate-in fade-in duration-150' : 'hidden'
                        }`}
                        data-testid={`faq-answer-${key}`}
                      >
                        <p>{item.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* Bottom Still Have Questions Card */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <MailIcon className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Still have questions?
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Can&apos;t find what you&apos;re looking for? Reach out to our team at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary hover:underline">
              {SUPPORT_EMAIL}
            </a>{' '}
            and we will be happy to assist you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/contact">
              <Button className="font-semibold shadow-xs">
                <span>Contact Support</span>
                <ArrowRightIcon className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline">
                <span>View Credit Plans</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
