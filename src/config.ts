/**
 * Site settings filled in by the owner. Leave a value empty to switch the feature off.
 * Both are read at build time (vite.config.ts uses GOATCOUNTER_CODE for the security policy).
 */

/** Link to the "interested in the team version" form (e.g. a Google Form). Empty = button hidden. */
export const TEAM_FORM_URL = '';

/**
 * GoatCounter site code for anonymous visit counting (https://www.goatcounter.com, free, no cookies).
 * Only the page name is sent (e.g. "/import") - never schedule data. Empty = no counting.
 */
export const GOATCOUNTER_CODE = '';
