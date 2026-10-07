"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function BillingPage() {
  return (
    <div className="container-content py-8">
      <div className="mb-8">
        <h1 className="text-display-sm text-neutral-900">Billing</h1>
        <p className="mt-1 text-body text-neutral-500">
          Manage your subscription and payment methods
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 max-w-4xl">
        <Card padding="lg">
          <CardHeader
            title="Current plan"
            subtitle="Free forever for core features"
          />
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-title-sm text-neutral-900">Free</p>
            <p className="mt-1 text-body-sm text-neutral-500">
              Unlimited automations. Upgrade for premium apps and support.
            </p>
          </div>
          <Button variant="secondary" size="md" className="mt-6">
            Upgrade plan
          </Button>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Payment method"
            subtitle="No payment method on file"
          />
          <p className="text-body-sm text-neutral-500">
            Add a payment method to upgrade or pay for usage.
          </p>
          <Button variant="secondary" size="md" className="mt-6">
            Add payment method
          </Button>
        </Card>
      </div>
    </div>
  );
}
