"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function SettingsPage() {
  return (
    <div className="container-content py-8">
      <div className="mb-8">
        <h1 className="text-display-sm text-neutral-900">Settings</h1>
        <p className="mt-1 text-body text-neutral-500">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-8 max-w-2xl">
        <Card padding="lg">
          <CardHeader
            title="Profile"
            subtitle="Update your personal information"
          />
          <div className="space-y-4">
            <Input label="Name" type="text" placeholder="Your name" value="" onChange={() => {}} />
            <Input label="Email" type="email" placeholder="you@example.com" value="" onChange={() => {}} />
            <Button variant="primary" size="md">
              Save changes
            </Button>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Password"
            subtitle="Change your password"
          />
          <div className="space-y-4">
            <Input label="Current password" type="password" placeholder="••••••••" value="" onChange={() => {}} />
            <Input label="New password" type="password" placeholder="••••••••" value="" onChange={() => {}} />
            <Input label="Confirm new password" type="password" placeholder="••••••••" value="" onChange={() => {}} />
            <Button variant="secondary" size="md">
              Update password
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
