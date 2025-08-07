const Stripe = require('stripe');
const { query, transaction } = require('../database/connection');
const logger = require('../utils/logger');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class PaymentService {
  // Create a payment intent for subscription
  static async createPaymentIntent(userId, countriesCount, countryList) {
    try {
      const pricePerCountry = 1.99; // $1.99 per country
      const totalAmount = Math.round(countriesCount * pricePerCountry * 100); // Convert to cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        metadata: {
          user_id: userId,
          countries_count: countriesCount.toString(),
          country_list: countryList.join(','),
          billing_cycle: '6_months'
        },
        description: `NextMatch Resume Service - ${countriesCount} ${countriesCount === 1 ? 'country' : 'countries'} for 6 months`
      });

      logger.info(`Payment intent created: ${paymentIntent.id} for user ${userId}`);
      return paymentIntent;

    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  // Create subscription after successful payment
  static async createSubscription(paymentIntentId) {
    try {
      // Retrieve payment intent to get metadata
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment not completed');
      }

      const { user_id, countries_count, country_list } = paymentIntent.metadata;
      const countryArray = country_list.split(',');

      return await transaction(async (client) => {
        // Create subscription record
        const subscriptionResult = await client.query(`
          INSERT INTO subscriptions (
            user_id, stripe_subscription_id, status, countries_count,
            price_per_country, total_amount, currency, billing_cycle_months,
            current_period_start, current_period_end
          ) VALUES ($1, $2, 'active', $3, $4, $5, 'USD', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '6 months')
          RETURNING *
        `, [
          user_id,
          paymentIntentId, // Using payment intent ID as subscription reference
          parseInt(countries_count),
          1.99,
          paymentIntent.amount / 100
        ]);

        const subscription = subscriptionResult.rows[0];

        // Add country access
        for (const countryCode of countryArray) {
          await client.query(`
            INSERT INTO subscription_countries (subscription_id, country_code)
            VALUES ($1, $2)
          `, [subscription.id, countryCode.trim()]);
        }

        logger.info(`Subscription created: ${subscription.id} for user ${user_id}`);
        return subscription;
      });

    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  // Handle Stripe webhooks
  static async handleWebhook(body, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      logger.info(`Stripe webhook received: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(event.data.object);
          break;
        
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      return { received: true };

    } catch (error) {
      logger.error('Webhook error:', error);
      throw error;
    }
  }

  static async handlePaymentSucceeded(paymentIntent) {
    try {
      logger.info(`Payment succeeded: ${paymentIntent.id}`);
      
      // The subscription creation is handled separately when the frontend confirms payment
      // This webhook can be used for additional processing like sending confirmation emails
      
    } catch (error) {
      logger.error('Error handling payment succeeded:', error);
    }
  }

  static async handlePaymentFailed(paymentIntent) {
    try {
      logger.error(`Payment failed: ${paymentIntent.id}`);
      
      // Update any pending subscriptions or notify user
      const { user_id } = paymentIntent.metadata;
      
      // Could send email notification here
      logger.info(`Payment failed for user ${user_id}`);
      
    } catch (error) {
      logger.error('Error handling payment failed:', error);
    }
  }

  static async handleInvoicePaymentSucceeded(invoice) {
    try {
      // Handle recurring payment success
      logger.info(`Invoice payment succeeded: ${invoice.id}`);
      
    } catch (error) {
      logger.error('Error handling invoice payment succeeded:', error);
    }
  }

  static async handleInvoicePaymentFailed(invoice) {
    try {
      // Handle recurring payment failure
      logger.error(`Invoice payment failed: ${invoice.id}`);
      
    } catch (error) {
      logger.error('Error handling invoice payment failed:', error);
    }
  }

  static async handleSubscriptionCanceled(subscription) {
    try {
      logger.info(`Subscription canceled: ${subscription.id}`);
      
      // Update subscription status in database
      await query(`
        UPDATE subscriptions 
        SET status = 'canceled', updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = $1
      `, [subscription.id]);
      
    } catch (error) {
      logger.error('Error handling subscription canceled:', error);
    }
  }

  // Get user's active subscription
  static async getUserSubscription(userId) {
    try {
      const result = await query(`
        SELECT s.*, 
               array_agg(sc.country_code) as country_codes,
               c.name as country_names
        FROM subscriptions s
        LEFT JOIN subscription_countries sc ON s.id = sc.subscription_id AND sc.is_active = true
        LEFT JOIN countries c ON sc.country_code = c.code
        WHERE s.user_id = $1 
        AND s.status = 'active'
        AND s.current_period_end > CURRENT_TIMESTAMP
        GROUP BY s.id, c.name
        ORDER BY s.created_at DESC
        LIMIT 1
      `, [userId]);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user subscription:', error);
      throw error;
    }
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionId, userId) {
    try {
      return await transaction(async (client) => {
        // Verify subscription belongs to user
        const subResult = await client.query(
          'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
          [subscriptionId, userId]
        );

        if (subResult.rows.length === 0) {
          throw new Error('Subscription not found');
        }

        const subscription = subResult.rows[0];

        // Cancel in Stripe if it's a recurring subscription
        if (subscription.stripe_subscription_id && subscription.stripe_subscription_id.startsWith('sub_')) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true
          });
        }

        // Update in database
        await client.query(`
          UPDATE subscriptions 
          SET cancel_at_period_end = true, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [subscriptionId]);

        logger.info(`Subscription ${subscriptionId} marked for cancellation`);
        return true;
      });

    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Upgrade subscription (add more countries)
  static async upgradeSubscription(userId, additionalCountries) {
    try {
      const currentSub = await this.getUserSubscription(userId);
      
      if (!currentSub) {
        throw new Error('No active subscription found');
      }

      const additionalAmount = additionalCountries.length * 1.99;
      
      // Create payment intent for upgrade
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(additionalAmount * 100),
        currency: 'usd',
        metadata: {
          user_id: userId,
          subscription_id: currentSub.id,
          additional_countries: additionalCountries.join(','),
          upgrade: 'true'
        },
        description: `NextMatch Subscription Upgrade - ${additionalCountries.length} additional countries`
      });

      return paymentIntent;

    } catch (error) {
      logger.error('Error upgrading subscription:', error);
      throw error;
    }
  }

  // Process subscription upgrade after payment
  static async processUpgrade(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment not completed');
      }

      const { user_id, subscription_id, additional_countries } = paymentIntent.metadata;
      const countryArray = additional_countries.split(',');

      return await transaction(async (client) => {
        // Update subscription
        await client.query(`
          UPDATE subscriptions 
          SET countries_count = countries_count + $1,
              total_amount = total_amount + $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [countryArray.length, paymentIntent.amount / 100, subscription_id]);

        // Add new countries
        for (const countryCode of countryArray) {
          await client.query(`
            INSERT INTO subscription_countries (subscription_id, country_code)
            VALUES ($1, $2)
            ON CONFLICT (subscription_id, country_code) 
            DO UPDATE SET is_active = true, added_at = CURRENT_TIMESTAMP
          `, [subscription_id, countryCode.trim()]);
        }

        logger.info(`Subscription ${subscription_id} upgraded with ${countryArray.length} countries`);
        return true;
      });

    } catch (error) {
      logger.error('Error processing upgrade:', error);
      throw error;
    }
  }

  // Get payment history
  static async getPaymentHistory(userId, limit = 10) {
    try {
      const result = await query(`
        SELECT s.*, 
               array_agg(sc.country_code) as countries
        FROM subscriptions s
        LEFT JOIN subscription_countries sc ON s.id = sc.subscription_id
        WHERE s.user_id = $1
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting payment history:', error);
      throw error;
    }
  }

  // Validate subscription access to country
  static async validateCountryAccess(userId, countryCode) {
    try {
      const result = await query(`
        SELECT 1 FROM subscriptions s
        JOIN subscription_countries sc ON s.id = sc.subscription_id
        WHERE s.user_id = $1 
        AND sc.country_code = $2
        AND sc.is_active = true
        AND s.status = 'active'
        AND s.current_period_end > CURRENT_TIMESTAMP
      `, [userId, countryCode]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error validating country access:', error);
      return false;
    }
  }
}

module.exports = PaymentService;