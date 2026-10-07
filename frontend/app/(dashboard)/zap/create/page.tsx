"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { WorkflowNode } from "@/components/workflow/WorkflowNode";
import { WorkflowConnector } from "@/components/workflow/WorkflowConnector";

function useAvailableActionsAndTriggers() {
  const [availableActions, setAvailableActions] = useState<
    { id: string; name: string; image: string }[]
  >([]);
  const [availableTriggers, setAvailableTriggers] = useState<
    { id: string; name: string; image: string }[]
  >([]);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/api/v1/trigger/available`)
      .then((x) => setAvailableTriggers(x.data.availableTriggers))
      .catch((err) => console.error("Error fetching triggers:", err));
    axios
      .get(`${BACKEND_URL}/api/v1/action/available`)
      .then((x) => setAvailableActions(x.data.availableActions))
      .catch((err) => console.error("Error fetching actions:", err));
  }, []);

  return { availableActions, availableTriggers };
}

type SelectedAction = {
  index: number;
  availableActionId: string;
  availableActionName: string;
  metadata: Record<string, unknown>;
};

export default function CreateAutomationPage() {
  const router = useRouter();
  const { availableActions, availableTriggers } = useAvailableActionsAndTriggers();
  const [selectedTrigger, setSelectedTrigger] = useState<
    { id: string; name: string } | undefined
  >();
  const [selectedActions, setSelectedActions] = useState<SelectedAction[]>([]);
  const [modalOpen, setModalOpen] = useState<"trigger" | number | null>(null);

  const publish = async () => {
    if (!selectedTrigger?.id) return;
    try {
      await axios.post(
        `${BACKEND_URL}/api/v1/zap`,
        {
          availableTriggerId: selectedTrigger.id,
          triggerMetadata: {},
          actions: selectedActions.map((a) => ({
            availableActionId: a.availableActionId,
            actionMetadata: a.metadata,
          })),
        },
        {
          headers: (() => {
            const token = localStorage.getItem("token");
            if (token?.trim()) return { Authorization: `Bearer ${token}` };
            return {};
          })(),
        }
      );
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response
          ? (err.response as { data?: { message?: string } }).data?.message
          : null;
      alert(msg || "Failed to create automation. Please try again.");
    }
  };

  const openModal = (index: "trigger" | number) => setModalOpen(index);
  const closeModal = () => setModalOpen(null);

  const isTriggerModal = modalOpen === "trigger";
  const modalIndex = typeof modalOpen === "number" ? modalOpen : null;
  const availableItems = isTriggerModal
    ? availableTriggers
    : modalIndex !== null
      ? availableActions
      : [];
  const modalTitle = isTriggerModal ? "Select trigger" : "Select action";

  const handleSelect = (item: { id: string; name: string; metadata?: Record<string, unknown> } | null) => {
    if (item === null) {
      closeModal();
      return;
    }
    if (isTriggerModal) {
      setSelectedTrigger({ id: item.id, name: item.name });
    } else if (modalIndex !== null) {
      setSelectedActions((prev) => {
        const next = [...prev];
        const idx = next.findIndex((a) => a.index === modalIndex);
        if (idx >= 0) {
          next[idx] = {
            index: modalIndex,
            availableActionId: item.id,
            availableActionName: item.name,
            metadata: item.metadata ?? {},
          };
        }
        return next;
      });
    }
    closeModal();
  };

  const addStep = () => {
    setSelectedActions((prev) => [
      ...prev,
      {
        index: prev.length + 2,
        availableActionId: "",
        availableActionName: "",
        metadata: {},
      },
    ]);
  };

  return (
    <div className="min-h-full flex flex-col">
      <div className="border-b border-neutral-200 bg-white px-4 py-3 lg:px-6">
        <div className="container-content flex items-center justify-between gap-4">
          <h1 className="text-title text-neutral-900">Create automation</h1>
          <Button variant="primary" size="md" onClick={publish}>
            Publish
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-neutral-100/80 py-12">
        <div className="container-content flex flex-col items-center py-8">
          <div className="flex flex-col items-center gap-0">
            <WorkflowNode
              index={1}
              label={selectedTrigger?.name ?? "Trigger"}
              type="trigger"
              onClick={() => openModal("trigger")}
            />
            {selectedActions.map((action, i) => (
              <div key={action.index} className="flex flex-col items-center gap-0">
                <WorkflowConnector />
                <WorkflowNode
                  index={action.index}
                  label={action.availableActionName || "Action"}
                  type="action"
                  onClick={() => openModal(action.index)}
                />
              </div>
            ))}
            <WorkflowConnector />
            <button
              type="button"
              onClick={addStep}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-white text-neutral-400 transition-colors duration-fast hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              aria-label="Add step"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={modalOpen !== null}
        onClose={closeModal}
        title={modalTitle}
        size="lg"
      >
        <TriggerActionModalContent
          items={isTriggerModal ? availableTriggers : availableActions}
          isTrigger={isTriggerModal}
          onSelect={handleSelect}
          onClose={closeModal}
        />
      </Modal>
    </div>
  );
}

function TriggerActionModalContent({
  items,
  isTrigger,
  onSelect,
  onClose,
}: {
  items: { id: string; name: string; image: string }[];
  isTrigger: boolean;
  onSelect: (item: { id: string; name: string; metadata?: Record<string, unknown> } | null) => void;
  onClose: () => void;
}) {
  const [configStep, setConfigStep] = useState<{
    id: string;
    name: string;
  } | null>(null);

  if (configStep) {
    if (configStep.id === "email") {
      return (
        <EmailSelector
          setMetadata={(metadata) => {
            onSelect({ id: configStep.id, name: configStep.name, metadata });
            onClose();
          }}
        />
      );
    }
    if (configStep.id === "send-sol") {
      return (
        <SolanaSelector
          setMetadata={(metadata) => {
            onSelect({ id: configStep.id, name: configStep.name, metadata });
            onClose();
          }}
        />
      );
    }
  }

  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
      {items.map(({ id, name, image }) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            if (isTrigger) {
              onSelect({ id, name, metadata: {} });
              onClose();
            } else if (id === "email" || id === "send-sol") {
              setConfigStep({ id, name });
            } else {
              onSelect({ id, name });
              onClose();
            }
          }}
          className="flex w-full items-center gap-4 rounded-xl border border-neutral-200 p-4 text-left transition-colors duration-fast hover:border-neutral-300 hover:bg-neutral-50"
        >
          <img
            src={image}
            alt=""
            className="h-10 w-10 rounded-xl border border-neutral-200 object-cover"
          />
          <span className="text-body font-medium text-neutral-900">{name}</span>
        </button>
      ))}
    </div>
  );
}

function EmailSelector({
  setMetadata,
}: {
  setMetadata: (params: { email: string; body: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="space-y-4">
      <Input
        label="To"
        type="email"
        placeholder="Recipient email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Body"
        type="text"
        placeholder="Email body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button
        variant="primary"
        size="md"
        onClick={() => setMetadata({ email, body })}
      >
        Submit
      </Button>
    </div>
  );
}

function SolanaSelector({
  setMetadata,
}: {
  setMetadata: (params: { amount: string; address: string }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");

  return (
    <div className="space-y-4">
      <Input
        label="To"
        type="text"
        placeholder="Solana wallet address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <Input
        label="Amount"
        type="text"
        placeholder="e.g. 0.1 (in SOL)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Button
        variant="primary"
        size="md"
        onClick={() => setMetadata({ amount, address })}
      >
        Submit
      </Button>
    </div>
  );
}
