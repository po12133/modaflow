-- AlterEnum (own migration: new enum values cannot be used in the transaction that adds them)
ALTER TYPE "SubscriptionStatus" ADD VALUE 'SUSPENDED';
