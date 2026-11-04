# ShopFinder — Project Overview

## Description

ShopFinder is a commercial property marketplace and lead-generation SaaS platform that connects shop owners with customers searching for commercial spaces for rent or sale.

## Goals

- Provide a trusted, searchable marketplace for commercial property listings.
- Allow owners to publish and manage their properties.
- Allow customers to discover, save, and inquire about listings.
- Monetize through customer subscription plans (contact-reveal credits).
- Provide an admin control panel for platform governance.

## Primary User Roles

| Role     | Key Capabilities |
|----------|-----------------|
| CUSTOMER | Search listings, save favorites, purchase plans, reveal contacts |
| OWNER    | Create/manage listings, upload images, track activity |
| ADMIN    | Approve/reject listings, manage users, subscriptions, payments |

## Business Model

- Customers purchase credit packages (subscription plans).
- Each contact reveal costs **1 credit**.
- Owner listing submission is **free** at launch.
- Future owner subscription plans are architecturally planned but not yet implemented.

## Subscription Plans (Customer)

| Plan    | Price | Credits |
|---------|-------|---------|
| Starter | ৳299  | 10      |
| Pro     | ৳999  | 100     |

## Technology Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 18, JavaScript, Tailwind CSS, shadcn/ui, React Router |
| Backend    | Node.js, Express.js               |
| Database   | PocketBase (DB + Auth)            |

## Status

> **Phase 0 — Workspace Inspection Complete. Awaiting Phase 1 authorization.**

