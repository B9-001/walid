// Paystack inline helper. The inline.js script is loaded once via <Script> in
// the checkout page. Amounts are passed in KOBO (Paystack's smallest unit for NGN).
//
// The public key + subaccount are hardcoded here (both are non-secret) so the
// checkout uses exactly these regardless of any stale NEXT_PUBLIC_PAYSTACK_*
// values in the hosting env. To switch between test/live or change the split,
// edit these two lines.
//   TEST key (pk_test_) → Paystack test cards only, no real charges.
//   LIVE key (pk_live_) → real money. Swap both key + subaccount together.
const PAYSTACK_PUBLIC_KEY = "pk_test_e77c32b2a3e592600f89c68321e3b5ec1d156946";
const PAYSTACK_SUBACCOUNT_CODE = "ACCT_uwdbq8slugisbkg";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: PaystackSetupOptions) => { openIframe: () => void };
    };
  }
}

type PaystackSetupOptions = {
  key: string;
  email: string;
  amount: number; // kobo
  currency: string;
  ref: string;
  subaccount?: string;
  bearer?: "account" | "subaccount";
  metadata?: Record<string, unknown>;
  callback: (response: { reference: string }) => void;
  onClose: () => void;
};

export type PayArgs = {
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
  onSuccess: (reference: string) => void;
  onClose?: () => void;
};

export function isPaystackReady() {
  return typeof window !== "undefined" && !!window.PaystackPop;
}

export function payWithPaystack({
  email,
  amountKobo,
  reference,
  metadata,
  onSuccess,
  onClose,
}: PayArgs): { ok: boolean; error?: string } {
  const key = PAYSTACK_PUBLIC_KEY;
  if (!key) return { ok: false, error: "Payment is not configured (missing Paystack key)." };
  if (!isPaystackReady()) return { ok: false, error: "Payment library still loading — try again in a moment." };

  const subaccount = PAYSTACK_SUBACCOUNT_CODE;

  const handler = window.PaystackPop!.setup({
    key,
    email,
    amount: Math.round(amountKobo),
    currency: "NGN",
    ref: reference,
    ...(subaccount ? { subaccount, bearer: "subaccount" } : {}),
    metadata,
    callback: (response) => onSuccess(response.reference),
    onClose: () => onClose?.(),
  });
  handler.openIframe();
  return { ok: true };
}

// Unique Paystack transaction reference (internal, not shown to customers).
export function generatePaymentRef(): string {
  return `DTPAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

// Random, customer-facing order number: DT-XXXXXX (no ambiguous 0/O/1/I/L).
// Not sequential, so order numbers can't be guessed/enumerated. Uniqueness is
// enforced by the unique column + insert retry in checkout.
const ORDER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars

export function generateOrderNumber(): string {
  let code = "";
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint32Array(6);
    cryptoObj.getRandomValues(arr);
    for (let i = 0; i < 6; i++) code += ORDER_ALPHABET[arr[i] % ORDER_ALPHABET.length];
  } else {
    for (let i = 0; i < 6; i++) code += ORDER_ALPHABET[Math.floor(Math.random() * ORDER_ALPHABET.length)];
  }
  return `DT-${code}`;
}
