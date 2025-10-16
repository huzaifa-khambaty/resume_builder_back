const Stripe = require("stripe");
const logger = require("../config/logger");

const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
let stripe = null;
if (!stripeSecret) {
  logger?.warn?.(
    "Stripe secret key missing. Set STRIPE_SECRET_KEY in environment."
  );
} else {
  stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });
}

function requireStripe() {
  if (!stripe)
    throw new Error("Stripe not configured. Please set STRIPE_SECRET_KEY.");
  return stripe;
}

async function getOrCreateCustomer({ candidateId, email, name }) {
  const s = requireStripe();
  // Try to find existing customer by metadata.candidate_id
  let customer = null;
  try {
    const search = await s.customers.search({
      query: `metadata['candidate_id']:'${candidateId}'`,
    });
    if (search?.data?.length) customer = search.data[0];
  } catch (e) {
    // ignore search errors, proceed to create by idempotency key
  }

  if (!customer) {
    customer = await s.customers.create({
      email: email || undefined,
      name: name || undefined,
      metadata: { candidate_id: String(candidateId) },
    });
  }
  return customer;
}

async function attachPaymentMethod({ customerId, paymentMethodId }) {
  const s = requireStripe();
  // Attach and set as default
  await s.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await s.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
  return paymentMethodId;
}

async function createAndConfirmPaymentIntent({
  amountCents,
  currency = "usd",
  customerId,
  paymentMethodId,
  description,
  metadata,
}) {
  const s = requireStripe();
  const pi = await s.paymentIntents.create({
    amount: amountCents,
    currency,
    customer: customerId,
    payment_method: paymentMethodId,
    confirm: true,
    off_session: false,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
    description,
    metadata,
  });
  return pi;
}

function mapDurationToRecurring(durationDays) {
  // Map days to Stripe recurring interval + interval_count
  // Stripe supports: day (max 365), week (max 52), month (max 12), year (max 1)
  const days = Math.max(1, Number(durationDays) || 1);

  // Exact daily for short durations
  if (days < 7) {
    return { interval: "day", interval_count: days };
  }

  // Prefer weekly if divisible by 7 and within Stripe limits
  if (days % 7 === 0 && days / 7 <= 52) {
    return { interval: "week", interval_count: days / 7 };
  }

  // Yearly if clean multiples of 365 (Stripe caps interval_count for year at 1)
  if (days >= 365 && days % 365 === 0) {
    return { interval: "year", interval_count: 1 };
  }

  // Fallback to months, bounded to Stripe limits
  const months = Math.max(1, Math.round(days / 30));
  return { interval: "month", interval_count: Math.min(months, 12) };
}

async function createPriceForPlan({
  unitAmountCents,
  currency = "usd",
  planName,
  durationDays,
}) {
  const s = requireStripe();
  const recurring = mapDurationToRecurring(durationDays);

  // First, check if a product with this name already exists
  const existingProducts = await s.products.list({
    limit: 100,
  });

  let product = existingProducts.data.find((p) => p.name === planName);

  if (!product) {
    // Create a new product only if it doesn't exist
    product = await s.products.create({
      name: planName || "Subscription",
      type: "service",
    });
  }

  // Create price using the existing or new product
  const price = await s.prices.create({
    unit_amount: unitAmountCents,
    currency,
    recurring: {
      interval: recurring.interval,
      interval_count: recurring.interval_count,
    },
    product: product.id,
  });

  return price;
}

async function cleanupDuplicateProducts() {
  const s = requireStripe();

  try {
    // Get all products
    const products = await s.products.list({ limit: 100 });

    // Group products by name
    const productsByName = {};
    products.data.forEach((product) => {
      if (!productsByName[product.name]) {
        productsByName[product.name] = [];
      }
      productsByName[product.name].push(product);
    });

    // Archive duplicates (keep the first one)
    const duplicatesArchived = [];
    for (const [name, productList] of Object.entries(productsByName)) {
      if (productList.length > 1) {
        // Keep the first product, archive the rest
        for (let i = 1; i < productList.length; i++) {
          await s.products.update(productList[i].id, { active: false });
          duplicatesArchived.push({ name, id: productList[i].id });
        }
      }
    }

    return {
      duplicatesArchived,
      message: `Archived ${duplicatesArchived.length} duplicate products`,
    };
  } catch (error) {
    throw new Error(`Failed to cleanup duplicate products: ${error.message}`);
  }
}

async function createSubscriptionAnchored({
  customerId,
  priceId,
  anchorDate,
  prorationBehavior = "none",
  metadata,
}) {
  const s = requireStripe();
  const trialEnd = Math.floor(new Date(anchorDate).getTime() / 1000);
  const sub = await s.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    // Defer first invoice to current period end by using a trial until anchor date
    trial_end: trialEnd,
    proration_behavior: prorationBehavior,
    collection_method: "charge_automatically",
    metadata,
  });
  return sub;
}

async function updateSubscriptionPrice({
  subscriptionId,
  newPriceId,
  prorationBehavior = "none",
}) {
  const s = requireStripe();
  const subscription = await s.subscriptions.retrieve(subscriptionId);
  const primaryItem = subscription.items.data[0];
  const updated = await s.subscriptions.update(subscriptionId, {
    proration_behavior: prorationBehavior,
    items: [
      {
        id: primaryItem.id,
        price: newPriceId,
      },
    ],
  });
  return updated;
}

async function cancelSubscription(subscriptionId) {
  const s = requireStripe();
  return await s.subscriptions.cancel(subscriptionId);
}

function getPublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY || "";
}

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || "";
}

function constructWebhookEvent({ payload, signature }) {
  const s = requireStripe();
  const secret = getWebhookSecret();
  if (!secret)
    throw new Error("Stripe webhook secret (STRIPE_WEBHOOK_SECRET) is not set");
  return s.webhooks.constructEvent(payload, signature, secret);
}

module.exports = {
  getOrCreateCustomer,
  attachPaymentMethod,
  createAndConfirmPaymentIntent,
  createPriceForPlan,
  cleanupDuplicateProducts,
  createSubscriptionAnchored,
  updateSubscriptionPrice,
  cancelSubscription,
  getPublishableKey,
  constructWebhookEvent,
  mapDurationToRecurring,
};
