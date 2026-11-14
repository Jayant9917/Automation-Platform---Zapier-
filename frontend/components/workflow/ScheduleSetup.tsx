"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { apiMessage, apiOptions } from "@/lib/actions";
import { useToastFeedback } from "@/components/ui/toast";
import { Button } from "@/components/ui/Button";
export type ScheduleDraft = {
  frequency: "every_5_minutes" | "daily";
  hour: number;
  minute: number;
  enabled: boolean;
};
export const initialSchedule: ScheduleDraft = {
  frequency: "every_5_minutes",
  hour: 9,
  minute: 0,
  enabled: true,
};
export function ScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
}) {
  return (
    <div className="space-y-5">
      <label className="block text-body-sm font-medium">
        Repeat
        <select
          aria-label="Schedule frequency"
          value={value.frequency}
          onChange={(e) =>
            onChange({ ...value, frequency: e.target.value as ScheduleDraft["frequency"] })
          }
          className="mt-2 w-full rounded-xl border border-neutral-200 p-3"
        >
          <option value="every_5_minutes">Every 5 minutes</option>
          <option value="daily">Every day</option>
        </select>
      </label>
      {value.frequency === "daily" && (
        <label className="block text-body-sm font-medium">
          Time (UTC)
          <input
            aria-label="Daily time (UTC)"
            type="time"
            required
            value={`${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`}
            onChange={(e) => {
              if (e.target.value) {
                const [hour, minute] = e.target.value.split(":").map(Number);
                onChange({ ...value, hour, minute });
              }
            }}
            className="mt-2 w-full rounded-xl border border-neutral-200 p-3"
          />
        </label>
      )}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        Schedule enabled
      </label>
      <p className="text-body-sm text-neutral-500">
        Times use UTC. Every five minutes runs at :00, :05, :10 and so on. Docker must be running.
        After downtime, one overdue run is created; missed intervals are skipped.
      </p>
    </div>
  );
}
export function ScheduleSetup({ workflowId }: { workflowId: string }) {
  const [draft, setDraft] = useState(initialSchedule),
    [next, setNext] = useState(""),
    [loaded, setLoaded] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useToastFeedback(error, message);
  const url = `${BACKEND_URL}/api/v1/zap/${encodeURIComponent(workflowId)}/schedule`;
  useEffect(() => {
    let active = true;
    axios
      .get(url, apiOptions())
      .then(({ data }) => {
        if (active) {
          const s = data.schedule;
          setDraft({ frequency: s.frequency, hour: s.hour, minute: s.minute, enabled: s.enabled });
          setNext(s.nextRunAt);
          setLoaded(true);
        }
      })
      .catch((failure) => {
        if (active) setError(apiMessage(failure, "Could not load schedule."));
      });
    return () => {
      active = false;
    };
  }, [url]);
  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await axios.put(url, draft, apiOptions());
      setNext(data.schedule.nextRunAt);
      setMessage(
        draft.enabled
          ? "Schedule saved. Future runs use this timing."
          : "Schedule paused. Runs already started may finish.",
      );
    } catch (failure) {
      setError(apiMessage(failure, "Could not save schedule."));
    } finally {
      setSaving(false);
    }
  }
  if (!loaded) return <p>{error || "Loading schedule..."}</p>;
  return (
    <div className="space-y-5">
      <ScheduleFields value={draft} onChange={setDraft} />
      {draft.enabled && next && (
        <p className="text-body-sm">
          Saved next run: {new Date(next).toLocaleString()} (your local time)
        </p>
      )}
      <Button disabled={saving} onClick={() => void save()}>
        {saving ? "Saving..." : "Save schedule"}
      </Button>
    </div>
  );
}
