import { createTestEventHandler } from "../test-event.js";
import { createTallySetupHandlers } from "../tally-setup.js";
import { Router } from "express";
import { authMiddleware } from "../middleware.js";
import { createWorkflowActionHandlers } from "../workflow-actions.js";
import { prismaClient } from "../db/index.js";
import { config } from "../config.js";
import { createGitHubSetupHandlers } from "../github-setup.js";
import { createExecutionHistoryHandler } from "../execution-history.js";

const router = Router();
router.post(
  "/:zapId/test-event",
  authMiddleware,
  createTestEventHandler(prismaClient, config.testEventsEnabled),
);
const tallySetup = createTallySetupHandlers(prismaClient, config.encryptionKey);
router.get("/:zapId/tally-trigger", authMiddleware, tallySetup.get);
router.put("/:zapId/tally-trigger", authMiddleware, tallySetup.save);
const githubSetup = createGitHubSetupHandlers(prismaClient, config);
router.get("/:zapId/github-trigger", authMiddleware, githubSetup.get);
router.put("/:zapId/github-trigger", authMiddleware, githubSetup.save);

const workflowActions = createWorkflowActionHandlers(prismaClient, config.encryptionKey);
router.post("/", authMiddleware, workflowActions.create);
router.put("/:zapId/actions", authMiddleware, workflowActions.update);

router.get("/", authMiddleware, async (req, res) => {
  const id = req.id;
  if (!id) {
    return res.status(403).json({
      message: "Unauthorized",
    });
  }

  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({
      message: "Invalid user ID",
    });
  }

  const zaps = await prismaClient.zap.findMany({
    where: {
      userId: userId,
    },
    include: {
      actions: {
        orderBy: { sortingOrder: "asc" },
        include: {
          type: true,
        },
      },
      trigger: {
        include: {
          type: true,
        },
      },
    },
  });

  return res.json({
    zaps,
  });
});

router.get("/:zapId/runs", authMiddleware, createExecutionHistoryHandler(prismaClient));

router.get("/:zapId", authMiddleware, async (req, res) => {
  const id = req.id;
  if (!id) {
    return res.status(403).json({
      message: "Unauthorized",
    });
  }

  const zapId = Array.isArray(req.params.zapId) ? req.params.zapId[0] : req.params.zapId;

  if (!zapId || typeof zapId !== "string") {
    return res.status(411).json({
      message: "Invalid zap ID",
    });
  }

  const zap = await prismaClient.zap.findFirst({
    where: {
      id: zapId,
      userId: parseInt(id, 10),
    },
    include: {
      actions: {
        orderBy: { sortingOrder: "asc" },
        include: {
          type: true,
        },
      },
      trigger: {
        include: {
          type: true,
        },
      },
    },
  });

  return res.json({
    testEventsEnabled: config.testEventsEnabled,
    zap,
  });
});

export const zapRouter = router;
