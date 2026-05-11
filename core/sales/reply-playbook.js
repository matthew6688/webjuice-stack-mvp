/**
 * Reply playbook — 12 reply classes → response template + recommended next phase.
 * DISCORD_OUTREACH_PRD.md §7.2.
 *
 * Each entry: { class, recommended_phase, recommended_action, draft_prompt_outline }.
 * `draft_prompt_outline` feeds a Claude/Codex CLI prompt; we render the actual
 * response via `core/llm/text-claude-cli.js` at call time.
 */

export const REPLY_CLASSES = [
  'interested',
  'question',
  'objection-price',
  'objection-timing',
  'objection-scope',
  'not-now',
  'wrong-person',
  'referred',
  'unsubscribe',
  'no',
  'bounced',
  'unclear',
];

export const PLAYBOOK = {
  interested: {
    recommended_phase: 'replied',
    recommended_action: 'send_discovery_questions_or_calendly',
    draft_prompt_outline: 'Client is interested. Send a short reply (≤120 words) thanking them, ask 2-3 discovery questions (current site pain points, timeline, budget hint), and offer Calendly. Tone: friendly, expert. Reference their business name + the strongest audit finding.',
  },
  question: {
    recommended_phase: 'replied',
    recommended_action: 'answer_with_audit_data',
    draft_prompt_outline: 'Client asked a specific question (price / timeline / scope / process). Draft a direct answer citing concrete numbers from master.md + audit. Then propose a 15-min Calendly call. Tone: concrete, no fluff.',
  },
  'objection-price': {
    recommended_phase: 'replied',
    recommended_action: 'reframe_value_or_offer_smaller_tier',
    draft_prompt_outline: 'Client thinks it is too expensive. Acknowledge, then reframe to ROI (1 new customer/month covers it). Offer downgrade path (T2 → T1, or one-time only without monthly). Don\'t discount; offer a smaller scope instead. Tone: confident, helpful.',
  },
  'objection-timing': {
    recommended_phase: 'nurture',
    recommended_action: 'agree_and_nurture_3mo',
    draft_prompt_outline: 'Client says "not now, busy / not the right time". Agree politely, ask 1 question about when timing would improve, then commit to following up in 3 months. Tone: low-pressure, professional.',
  },
  'objection-scope': {
    recommended_phase: 'replied',
    recommended_action: 'propose_alternate_smaller_scope',
    draft_prompt_outline: 'Client doesn\'t want the full package. Identify which part they DO need (just SEO? just contact form? just hero?). Propose a tier-1 single-page offering at lower price. Tone: flexible, accommodating.',
  },
  'not-now': {
    recommended_phase: 'nurture',
    recommended_action: 'confirm_and_schedule_followup',
    draft_prompt_outline: 'Client says "ask me in N months". Confirm the timeframe, send a brief value-add (1 link to relevant case study or article), commit to following up. Set nurture_due_at accordingly.',
  },
  'wrong-person': {
    recommended_phase: 'awaiting',
    recommended_action: 'extract_referral_and_reintro',
    draft_prompt_outline: 'Client says "contact our manager X / decision-maker Y". Thank them, ask for an intro or contact details. If you got name + email, draft a fresh intro to the new contact citing their colleague\'s referral.',
  },
  referred: {
    recommended_phase: 'replied',
    recommended_action: 'spawn_new_lead_from_referral',
    draft_prompt_outline: 'Client referred you to another business. Thank them. Note: caller will need to manually spawn a new lead entity for the referred business. Surface the referral details for operator to act on.',
  },
  unsubscribe: {
    recommended_phase: 'archived',
    recommended_action: 'confirm_unsubscribe_no_reply',
    draft_prompt_outline: 'Client explicitly asked to be removed. DO NOT auto-reply. Set entity.do_not_contact=true. Archive with reason "unsubscribe_request". Tone: silence.',
  },
  no: {
    recommended_phase: 'archived',
    recommended_action: 'polite_thanks_and_archive',
    draft_prompt_outline: 'Client explicitly said no. Send ONE polite "thanks for letting me know" reply (≤30 words). Then archive. Tone: professional, no salvage attempt.',
  },
  bounced: {
    recommended_phase: 'archived',
    recommended_action: 'try_backup_or_archive',
    draft_prompt_outline: 'Email bounced. Check entity.latest.backup_email; if present, re-send to backup. If no backup, archive with reason "email_bounced".',
  },
  unclear: {
    recommended_phase: 'needs-human',
    recommended_action: 'flag_for_operator',
    draft_prompt_outline: 'Reply ambiguous. Do NOT auto-draft. Flag for Matthew to read directly. Surface the reply text + suggested 2 possible interpretations.',
  },
};

export function lookupPlaybook(replyClass) {
  return PLAYBOOK[replyClass] || PLAYBOOK.unclear;
}
