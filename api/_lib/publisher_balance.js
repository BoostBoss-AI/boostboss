/**
 * Boost Boss — publisher balance accrual (Phase E Day 2, 2026-05-11).
 *
 * Every paid event (impression / click / video_complete / conversion with
 * developer_payout > 0) calls creditPublisherBalance() to:
 *
 *   1. Look up any pending clawbacks for this developer.
 *   2. Eat the incoming amount against those clawbacks oldest-first.
 *   3. Whatever's left over (if anything) lands in spendable balance +
 *      lifetime_earned.
 *
 * This closes the data-collection → spendable-balance loop. Without it,
 * the Friday cron has nothing to pay out.
 *
 * Sandbox events MUST skip this — callers gate with is_sandbox=false
 * before calling in. The function does NOT re-check that.
 *
 * The supabase path uses migration 13's RPCs for atomicity under concurrent
 * writes. The demo path maintains a parallel in-memory store so tests can
 * exercise the full clawback-satisfaction logic without a DB.
 */

// In-memory balance store used in demo mode (no Supabase). Keyed by developer_id.
//   { balance, lifetime_earned, lifetime_paid }
const DEMO_BALANCES = new Map();

// In-memory clawback ledger keyed by developer_id → array of pending rows.
//   [{ id, amount_usd, remaining_usd, status, ... }]
const DEMO_CLAWBACKS = new Map();

function getDemoBalance(devId) {
  if (!DEMO_BALANCES.has(devId)) {
    DEMO_BALANCES.set(devId, { balance: 0, lifetime_earned: 0, lifetime_paid: 0 });
  }
  return DEMO_BALANCES.get(devId);
}

function _pushDemoClawback(devId, claw) {
  if (!DEMO_CLAWBACKS.has(devId)) DEMO_CLAWBACKS.set(devId, []);
  DEMO_CLAWBACKS.get(devId).push(claw);
}

/**
 * Credit a developer's balance with `amount_usd`, satisfying any pending
 * clawbacks first. Returns an object describing what landed where:
 *
 *   {
 *     applied_to_clawbacks_usd: number,
 *     added_to_balance_usd:     number,
 *     new_balance:              number | null,   // may be null in fallback paths
 *     mode:                     'supabase-rpc' | 'supabase-fallback' | 'demo',
 *   }
 *
 * Never throws — failures are logged with the bbx:balance:* prefix.
 */
async function creditPublisherBalance(sb, developerId, amount_usd) {
  if (!developerId) {
    return { applied_to_clawbacks_usd: 0, added_to_balance_usd: 0, new_balance: null, mode: "noop" };
  }
  const amount = Number(amount_usd);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { applied_to_clawbacks_usd: 0, added_to_balance_usd: 0, new_balance: null, mode: "noop" };
  }

  // ── Demo path ────────────────────────────────────────────────────────
  if (!sb) return _demoCredit(developerId, amount);

  // ── Supabase path (RPCs from migration 13) ──────────────────────────
  let leftover = amount;
  let appliedToClawbacks = 0;
  try {
    const { data: leftoverRpc, error: cbErr } = await sb.rpc(
      "bbx_satisfy_pending_clawbacks",
      { p_developer_id: developerId, p_incoming_amount: amount },
    );
    if (cbErr) {
      console.error("bbx:balance:clawback_rpc_fail", JSON.stringify({
        developer_id: developerId, amount, message: cbErr.message,
      }));
      // Fall through with leftover=amount; if the RPC genuinely doesn't
      // exist we still want the credit to land.
    } else if (Number.isFinite(Number(leftoverRpc))) {
      leftover = Number(leftoverRpc);
      appliedToClawbacks = amount - leftover;
    }
  } catch (e) {
    console.error("bbx:balance:clawback_throw", JSON.stringify({
      developer_id: developerId, amount, message: e && e.message,
    }));
  }

  // If everything was eaten by clawbacks, nothing further to do.
  if (leftover <= 0) {
    return {
      applied_to_clawbacks_usd: appliedToClawbacks,
      added_to_balance_usd:     0,
      new_balance:              null,
      mode:                     "supabase-rpc",
    };
  }

  // Credit the leftover. Try the atomic RPC; fall back to read-modify-write
  // if the RPC isn't deployed (transitional period before migration 13 lands).
  try {
    const { data: newBalance, error: creditErr } = await sb.rpc(
      "bbx_credit_publisher_balance",
      { p_developer_id: developerId, p_amount_usd: leftover },
    );
    if (creditErr) throw creditErr;
    return {
      applied_to_clawbacks_usd: appliedToClawbacks,
      added_to_balance_usd:     leftover,
      new_balance:              Number(newBalance),
      mode:                     "supabase-rpc",
    };
  } catch (rpcErr) {
    console.warn("bbx:balance:credit_rpc_unavailable_falling_back",
      JSON.stringify({ developer_id: developerId, message: rpcErr.message }));
    return await _supabaseFallbackCredit(sb, developerId, leftover, appliedToClawbacks);
  }
}

/**
 * When a transfer to a publisher succeeds, debit their balance and
 * increment lifetime_paid. Atomic via RPC when available.
 */
async function debitPublisherBalance(sb, developerId, amount_usd) {
  if (!developerId) return 0;
  const amount = Number(amount_usd);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  if (!sb) {
    const b = getDemoBalance(developerId);
    const deducted = Math.min(b.balance, amount);
    b.balance      -= deducted;
    b.lifetime_paid += deducted;
    return deducted;
  }

  try {
    const { data: deducted, error } = await sb.rpc(
      "bbx_decrement_publisher_balance",
      { p_developer_id: developerId, p_amount_usd: amount },
    );
    if (error) throw error;
    const deductedNum = Number(deducted) || 0;
    if (deductedNum > 0) {
      // Bump lifetime_paid manually — the RPC only touches balance so the
      // semantic split between "balance" and "lifetime totals" stays clean.
      try {
        const { data: cur } = await sb.from("publisher_balance")
          .select("lifetime_paid").eq("developer_id", developerId).single();
        const newLifetime = (parseFloat(cur && cur.lifetime_paid) || 0) + deductedNum;
        await sb.from("publisher_balance")
          .update({ lifetime_paid: newLifetime, updated_at: new Date().toISOString() })
          .eq("developer_id", developerId);
      } catch (_) { /* non-fatal */ }
    }
    return deductedNum;
  } catch (e) {
    console.error("bbx:balance:debit_fail",
      JSON.stringify({ developer_id: developerId, amount, message: e && e.message }));
    return 0;
  }
}

// ── Demo-mode implementations ─────────────────────────────────────────

function _demoCredit(developerId, amount) {
  let leftover = amount;
  let appliedToClawbacks = 0;
  const clawbacks = DEMO_CLAWBACKS.get(developerId) || [];
  // Oldest-first; mirror SQL ORDER BY created_at asc.
  for (const cb of clawbacks) {
    if (leftover <= 0) break;
    if (cb.status !== "pending" || cb.remaining_usd <= 0) continue;
    const consumed = Math.min(leftover, cb.remaining_usd);
    cb.remaining_usd -= consumed;
    leftover -= consumed;
    appliedToClawbacks += consumed;
    if (cb.remaining_usd <= 0) {
      cb.status     = "applied";
      cb.applied_at = new Date().toISOString();
    }
  }
  const b = getDemoBalance(developerId);
  if (leftover > 0) {
    b.balance         += leftover;
    b.lifetime_earned += leftover;
  }
  return {
    applied_to_clawbacks_usd: +appliedToClawbacks.toFixed(4),
    added_to_balance_usd:     +leftover.toFixed(4),
    new_balance:              +b.balance.toFixed(4),
    mode:                     "demo",
  };
}

async function _supabaseFallbackCredit(sb, developerId, amount, appliedToClawbacks) {
  // Read-modify-write fallback when migration 13's RPC isn't present.
  // This is racey under concurrent writes — only used until the RPC lands.
  try {
    const { data: cur } = await sb.from("publisher_balance")
      .select("balance, lifetime_earned").eq("developer_id", developerId).maybeSingle();
    const curBalance = parseFloat(cur && cur.balance) || 0;
    const curEarned  = parseFloat(cur && cur.lifetime_earned) || 0;
    const newBalance = curBalance + amount;
    const newEarned  = curEarned  + amount;
    if (cur) {
      await sb.from("publisher_balance").update({
        balance: newBalance, lifetime_earned: newEarned, updated_at: new Date().toISOString(),
      }).eq("developer_id", developerId);
    } else {
      await sb.from("publisher_balance").insert({
        developer_id: developerId, balance: amount, lifetime_earned: amount,
      });
    }
    return {
      applied_to_clawbacks_usd: appliedToClawbacks,
      added_to_balance_usd:     amount,
      new_balance:              newBalance,
      mode:                     "supabase-fallback",
    };
  } catch (e) {
    console.error("bbx:balance:fallback_fail",
      JSON.stringify({ developer_id: developerId, amount, message: e && e.message }));
    return {
      applied_to_clawbacks_usd: appliedToClawbacks,
      added_to_balance_usd:     0,
      new_balance:              null,
      mode:                     "fail",
    };
  }
}

// ── Test hooks ─────────────────────────────────────────────────────────
function _addDemoClawback(developerId, amount_usd, opts = {}) {
  const claw = {
    id: opts.id || ("claw_" + Math.random().toString(36).slice(2, 10)),
    developer_id: developerId,
    amount_usd, remaining_usd: amount_usd,
    status: "pending",
    created_at: opts.created_at || new Date().toISOString(),
    applied_at: null,
    source_event_type: opts.source_event_type || "refund",
  };
  _pushDemoClawback(developerId, claw);
  return claw;
}
function _getDemoBalance(devId)   { return getDemoBalance(devId); }
function _getDemoClawbacks(devId) { return DEMO_CLAWBACKS.get(devId) || []; }
function _reset() {
  DEMO_BALANCES.clear();
  DEMO_CLAWBACKS.clear();
}

module.exports = {
  creditPublisherBalance,
  debitPublisherBalance,
  _addDemoClawback,
  _getDemoBalance,
  _getDemoClawbacks,
  _reset,
};
