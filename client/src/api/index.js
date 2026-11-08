/**
 * ShopFinder — Centralized Client API Service Architecture Entry (Task 4.6)
 *
 * Re-exports the primary HTTP client implementation from client/src/services/api.js
 * ensuring alignment with docs/ARCHITECTURE.md while maintaining zero duplication.
 */
export * from '../services/api.js';
export { default } from '../services/api.js';

